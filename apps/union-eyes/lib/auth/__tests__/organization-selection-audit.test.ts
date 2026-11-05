import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ audit: vi.fn(), logError: vi.fn(), tx: { tx: true } }))

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx) }))
vi.mock('@/lib/logger', () => ({ logger: { error: m.logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { recordOrganizationSelection, recordOrganizationSelectionOutcome } from '../organization-selection-audit'

const ORG = '11111111-1111-4111-8111-111111111111'
const PREVIOUS = '22222222-2222-4222-8222-222222222222'

describe('organization selection audit — intent and outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.audit.mockResolvedValue(undefined)
  })

  it('records who selected which organization, from which, and on what authority', async () => {
    await recordOrganizationSelection({ organizationId: ORG, userId: 'u1', authority: 'membership', mode: 'canonical_session', previousOrganizationId: PREVIOUS })

    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      organizationId: ORG,
      userId: 'u1',
      action: 'organization.select',
      details: { authority: 'membership', mode: 'canonical_session', fromOrganizationId: PREVIOUS },
    }))
  })

  it('says so when the previous organization is not known', async () => {
    await recordOrganizationSelection({ organizationId: ORG, userId: 'u1', authority: 'platform_administrator', mode: 'legacy' })

    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ details: expect.objectContaining({ fromOrganizationId: null }) }))
  })

  it('refuses the selection when its intent cannot be recorded', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit down'))

    await expect(
      recordOrganizationSelection({ organizationId: ORG, userId: 'u1', authority: 'membership', mode: 'canonical_session' }),
    ).rejects.toThrow('audit down')
  })

  it('records that the selection took effect, with the organization it left', async () => {
    const recorded = await recordOrganizationSelectionOutcome({ organizationId: ORG, userId: 'u1', outcome: 'applied', mode: 'canonical_session', previousOrganizationId: PREVIOUS })

    expect(recorded).toBe(true)
    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      action: 'organization.selected',
      details: { mode: 'canonical_session', fromOrganizationId: PREVIOUS },
    }))
  })

  it('records that the session store refused the selection', async () => {
    await recordOrganizationSelectionOutcome({ organizationId: ORG, userId: 'u1', outcome: 'failed', mode: 'canonical_session' })

    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'organization.select_failed' }))
  })

  it('logs, and reports false, when the outcome cannot be recorded: the session change already happened and the intent record stays', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit down'))

    const recorded = await recordOrganizationSelectionOutcome({ organizationId: ORG, userId: 'u1', outcome: 'applied', mode: 'canonical_preference' })

    expect(recorded).toBe(false)
    expect(m.logError).toHaveBeenCalledWith('organization_selection_outcome_not_recorded', expect.objectContaining({ outcome: 'applied' }))
  })
})
