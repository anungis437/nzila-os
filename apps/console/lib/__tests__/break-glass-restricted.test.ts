import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({ auth: vi.fn(), policy: vi.fn(), audit: vi.fn(), activate: vi.fn(), revoke: vi.fn() }))
vi.mock('@/lib/api-guards', () => ({ authenticateUser: h.auth }))
vi.mock('@/lib/policy-enforcement', () => ({ enforcePolicies: h.policy }))
vi.mock('@/lib/audit-db', () => ({ recordAuditEvent: h.audit }))
vi.mock('@nzila/os-core', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }))
vi.mock('@nzila/platform-restricted-data', async (importOriginal) => ({
  ...await importOriginal<typeof import('@nzila/platform-restricted-data')>(),
  activateBreakGlass: h.activate,
  revokeBreakGlass: h.revoke,
}))

import { POST } from '../../app/api/admin/break-glass/route'

const orgId = '00000000-0000-4000-8000-000000000001'
const boundedScope = { orgId, appDomain: 'synthetic-app', resource: 'resource-synthetic', action: 'read' }
function activate(scope: unknown = boundedScope) {
  return POST(new NextRequest('http://console.test/api/admin/break-glass', { method: 'POST', body: JSON.stringify({ reason: 'synthetic bounded emergency', durationMinutes: 15, scope }) }))
}

describe('Console scoped Restricted break-glass wiring', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    h.auth.mockResolvedValue({ ok: true, userId: 'admin-synthetic', platformRole: 'platform_admin' })
    h.policy.mockResolvedValue({ blocked: false, needsApproval: false })
    h.audit.mockResolvedValue({ id: 'audit-synthetic' })
    h.activate.mockImplementation((input: Record<string, unknown>) => ({ ...input, id: 'activation-synthetic' }))
  })

  it('uses the authenticated actor and explicitly bounded target org in policy and audit', async () => {
    const response = await activate()
    expect(response.status).toBe(201)
    const activation = await response.json()
    expect(activation.actorId).toBe('admin-synthetic')
    expect(h.activate).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'admin-synthetic', scope: boundedScope }))
    expect(h.policy).toHaveBeenCalledWith(expect.objectContaining({ orgId }))
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ orgId, actorClerkUserId: 'admin-synthetic' }))
  })

  it('rejects full or missing-org scope before policy or activation', async () => {
    expect((await activate('full')).status).toBe(400)
    expect((await activate({ appDomain: 'synthetic-app', resource: 'resource-synthetic', action: 'read' })).status).toBe(400)
    expect(h.activate).not.toHaveBeenCalled()
    expect(h.policy).not.toHaveBeenCalled()
  })

  it('does not create activation state when policy denies or requires approval', async () => {
    h.policy.mockResolvedValueOnce({ blocked: true, reason: 'synthetic denial' })
    expect((await activate()).status).toBe(403)
    h.policy.mockResolvedValueOnce({ blocked: false, needsApproval: true, approverRoles: ['platform_admin'], requiredApprovers: 2 })
    expect((await activate()).status).toBe(202)
    expect(h.activate).not.toHaveBeenCalled()
  })

  it('revokes activation if durable audit persistence fails', async () => {
    h.audit.mockRejectedValueOnce(new Error('synthetic unavailable audit'))
    expect((await activate()).status).toBe(500)
    expect(h.activate).toHaveBeenCalledTimes(1)
    expect(h.revoke).toHaveBeenCalledWith('activation-synthetic')
  })
})
