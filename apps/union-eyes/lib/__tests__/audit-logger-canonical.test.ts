import { beforeEach, describe, expect, it, vi } from 'vitest'

const enabled = vi.hoisted(() => vi.fn(() => true))
const withRLS = vi.hoisted(() => vi.fn())
const append = vi.hoisted(() => vi.fn())
const withSystem = vi.hoisted(() => vi.fn())
const appendPlatform = vi.hoisted(() => vi.fn())
const legacyInsert = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: enabled }))
vi.mock('../auth/canonical-bootstrap', () => ({ currentStateContextEnabled: enabled }))
vi.mock('../db/with-rls-context', () => ({ withRLSContext: withRLS, withSystemContext: withSystem }))
vi.mock('../audit/canonical-audit-chain', () => ({ appendCanonicalAuditLog: append, appendCanonicalPlatformAuditLog: appendPlatform }))
vi.mock('@/db', () => ({ db: { insert: legacyInsert } }))
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { AuditEventType, AuditSeverity, auditLog } from '../audit-logger'

describe('auditLog canonical V2 persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enabled.mockReturnValue(true)
    withRLS.mockImplementation(async (_context: unknown, operation: (tx: unknown) => unknown) =>
      operation({ tx: true }),
    )
    append.mockResolvedValue({ contentHash: 'h', previousHash: null })
    withSystem.mockImplementation(async (operation: (tx: unknown) => unknown) => operation({ system: true }))
  })

  it('writes the canonical chain under the entry organization and never touches the excluded legacy relation', async () => {
    await auditLog({
      eventType: AuditEventType.SYSTEM_SECURITY_ALERT,
      severity: AuditSeverity.HIGH,
      organizationId: 'org-1',
      userId: 'user-1',
      resource: 'entitlement',
      action: 'entitlement_check_failed',
      outcome: 'failure',
      metadata: { featureKey: 'grievance_case_suite' },
    })

    expect(withRLS).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function))
    expect(append).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({
        organizationId: 'org-1',
        action: 'entitlement_check_failed',
        resourceType: 'entitlement',
        userId: 'user-1',
        details: expect.objectContaining({
          eventType: 'system.security_alert',
          severity: 'error',
          outcome: 'failure',
          metadata: { featureKey: 'grievance_case_suite' },
        }),
      }),
    )
    expect(legacyInsert).not.toHaveBeenCalled()
  })

  it('does not swallow a persistence failure so the protected operation fails safely', async () => {
    append.mockRejectedValueOnce(new Error('audit persistence failed'))
    await expect(
      auditLog({ eventType: AuditEventType.DATA_UPDATE, organizationId: 'org-1' }),
    ).rejects.toThrow('audit persistence failed')
  })

  it('persists unattributed platform events on the dedicated SYSTEM connection', async () => {
    await auditLog({ eventType: AuditEventType.AUTH_FAILED })
    expect(withRLS).not.toHaveBeenCalled()
    expect(append).not.toHaveBeenCalled()
    expect(appendPlatform).toHaveBeenCalledWith({ system: true }, expect.objectContaining({ action: AuditEventType.AUTH_FAILED }))
  })

  it('propagates a failed platform audit write', async () => {
    appendPlatform.mockRejectedValueOnce(new Error('platform audit failed'))
    await expect(auditLog({ eventType: AuditEventType.AUTH_FAILED })).rejects.toThrow('platform audit failed')
  })
})
