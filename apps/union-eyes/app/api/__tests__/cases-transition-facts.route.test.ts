import { beforeEach, describe, expect, it, vi } from 'vitest'

// Infrastructure boundaries are controlled here; the production validator,
// status bridge, fact loader and signal calculation all execute unchanged.
const m = vi.hoisted(() => ({
  stored: {} as Record<string, unknown>,
  role: 'steward',
  update: vi.fn(),
  inserted: vi.fn(),
  authorized: vi.fn(),
  audit: vi.fn(),
}))
vi.mock('@/lib/cases/case-authorization', () => ({
  getCaseActor: async () => ({
    userId: 'unit-handler',
    organizationId: 'b96359c3-a8de-458c-8469-afc084b7fbc0',
    role: m.role,
  }),
  findReadableCase: m.authorized,
  caseAuthorizationResponse: () => null,
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (run: (tx: unknown) => unknown) =>
    run({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [m.stored] }) }) }),
      update: () => ({
        set: (values: unknown) => {
          m.update(values)
          return { where: async () => undefined }
        },
      }),
      insert: () => ({ values: m.inserted }),
    }),
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: async () => undefined,
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('@/lib/audit-logger', () => ({
  auditLog: async () => undefined,
  AuditEventType: {},
  AuditSeverity: {},
}))
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: async () => undefined }))
vi.mock('@/lib/authority/store/route-adapter', () => ({
  decideCaseCapabilitiesBatch: async (_tx: unknown, input: { caseIds: string[] }) =>
    new Map(
      input.caseIds.map((id) => [
        id,
        { 'case:transition': { effect: 'allow' }, 'case:close': { effect: 'deny' } },
      ]),
    ),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  m.role = 'steward'
  m.stored = {
    claimId: '22222222-2222-4222-8222-222222222222',
    claimNumber: 'SYNTHETIC-UNIT',
    organizationId: 'b96359c3-a8de-458c-8469-afc084b7fbc0',
    status: 'investigation',
    assignedTo: 'unit-handler',
    memberId: 'unit-member',
    priority: 'medium',
    description: 'Recorded synthetic investigation narrative.',
    createdAt: new Date(Date.now() - 12 * 86400000),
    updatedAt: new Date(),
    statusChangedAt: new Date(Date.now() - 9 * 86400000),
  }
  m.authorized.mockImplementation(async () => m.stored)
  m.audit.mockResolvedValue(undefined)
  m.inserted.mockResolvedValue(undefined)
})
async function request(body: Record<string, unknown>) {
  const { PATCH } = await import('../cases/[caseId]/transition/route')
  return PATCH(
    new Request('http://localhost/api/cases/unit/transition', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ caseId: String(m.stored.claimId) }) },
  )
}
describe('actual transition route and real validator fact plumbing', () => {
  it('resolves an authorized matured investigation and writes its history and audit', async () => {
    expect((await request({ targetStatus: 'resolved' })).status).toBe(200)
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved', resolvedAt: expect.any(Date) }),
    )
    expect(m.inserted).toHaveBeenCalled()
    expect(m.audit).toHaveBeenCalled()
  })
  it('refuses absent documentation even if the body asserts it exists', async () => {
    m.stored.description = 'Short'
    const r = await request({ targetStatus: 'resolved', hasRequiredDocumentation: true })
    expect(r.status).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })
  it('uses the stored status clock despite a forged old client clock', async () => {
    m.stored.statusChangedAt = new Date()
    expect(
      (await request({ targetStatus: 'resolved', statusChangedAt: '2000-01-01T00:00:00Z' })).status,
    ).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('preserves document waiting and allows the return to investigation', async () => {
    expect((await request({ targetStatus: 'pending_documentation' })).status).toBe(200)
    expect(m.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'pending_documentation' }),
    )
    m.stored.status = 'pending_documentation'
    m.update.mockClear()
    expect((await request({ targetStatus: 'investigation' })).status).toBe(200)
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'investigation' }))
  })
  it('checks the separate close power before closing a documented matured resolution', async () => {
    m.role = 'admin'
    m.stored.status = 'resolved'
    expect((await request({ targetStatus: 'closed' })).status).toBe(200)
    expect(m.authorized).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      m.stored.claimId,
      true,
      'case:close',
    )
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'closed', closedAt: expect.any(Date) }),
    )
  })
  it('refuses an unrepresentable arbitration without changing a claim to investigation', async () => {
    expect((await request({ targetStatus: 'arbitration' })).status).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
  })
})
