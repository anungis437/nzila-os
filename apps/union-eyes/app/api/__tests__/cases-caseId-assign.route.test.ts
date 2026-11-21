/**
 * Step 1 S1-A06 / C09: POST /api/cases/[caseId]/assign refuses every caller the kernel does not authorize for case:assign,
 * the case's own member, and an ineligible assignee — before any assignment, mirror write or audit — and an authority
 * store denial surfaces as 403, never 200.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  getCaseActor: vi.fn(),
  findReadableCase: vi.fn(),
  caseAssigneeEligible: vi.fn(),
  assignPrimaryRepresentative: vi.fn(),
  automaticallyAssignRepresentative: vi.fn(),
  requireEntitlement: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auditLog: vi.fn(),
  tx: { update: vi.fn(), insert: vi.fn(), select: vi.fn() },
}))

vi.mock('@/lib/cases/case-authorization', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cases/case-authorization')>()
  return { ...actual, getCaseActor: m.getCaseActor, findReadableCase: m.findReadableCase, caseAssigneeEligible: m.caseAssigneeEligible }
})
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.auditLog, AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }))
vi.mock('@/lib/services/case-access-service', () => ({ assignPrimaryRepresentative: m.assignPrimaryRepresentative }))
vi.mock('@/lib/cases/automatic-assignment', () => ({
  automaticallyAssignRepresentative: m.automaticallyAssignRepresentative,
  AssignmentMatchingError: class AssignmentMatchingError extends Error { code = 'NO_MATCH' },
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (fn: (tx: unknown) => unknown) => fn(m.tx) }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }))
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseAssigned: vi.fn().mockResolvedValue(undefined) }))

const actor = { userId: 'issuer-1', organizationId: 'org-1', role: 'steward' }
const post = async (body: unknown, caseId = 'case-1') => {
  const { POST } = await import('../cases/[caseId]/assign/route')
  return POST(new Request(`http://localhost/api/cases/${caseId}/assign`, { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ caseId }) })
}
const nothingWritten = () => {
  expect(m.assignPrimaryRepresentative).not.toHaveBeenCalled()
  expect(m.tx.update).not.toHaveBeenCalled()
  expect(m.tx.insert).not.toHaveBeenCalled()
  expect(m.persistAtomicAudit).not.toHaveBeenCalled()
}

describe('POST /api/cases/[caseId]/assign refusals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.getCaseActor.mockResolvedValue(actor)
    m.requireEntitlement.mockResolvedValue(undefined)
    m.caseAssigneeEligible.mockResolvedValue(true)
  })

  it('refuses an unauthenticated caller with 401', async () => {
    const { ApiError } = await import('@/lib/api/errors')
    m.getCaseActor.mockRejectedValueOnce(ApiError.unauthorized())
    expect((await post({ assigneeId: 'rep-1' })).status).toBe(401)
    expect(m.findReadableCase).not.toHaveBeenCalled()
    nothingWritten()
  })

  it('asks the kernel for case:assign as a write and refuses with 403 when it denies (title or seniority alone)', async () => {
    const { ApiError } = await import('@/lib/api/errors')
    m.findReadableCase.mockRejectedValueOnce(ApiError.forbidden('This action is not permitted for this case.'))
    expect((await post({ assigneeId: 'rep-1' })).status).toBe(403)
    expect(m.findReadableCase).toHaveBeenCalledWith(m.tx, actor, 'case-1', true, 'case:assign')
    nothingWritten()
  })

  it('refuses the case member routing their own matter', async () => {
    m.findReadableCase.mockResolvedValueOnce({ claimId: 'case-1', memberId: actor.userId, assignedTo: null, claimType: 'grievance' })
    expect((await post({ assigneeId: 'rep-1' })).status).toBe(403)
    nothingWritten()
  })

  it('refuses an assignee who is not an active canonical representative', async () => {
    m.findReadableCase.mockResolvedValueOnce({ claimId: 'case-1', memberId: 'member-9', assignedTo: null, claimType: 'grievance' })
    m.caseAssigneeEligible.mockResolvedValueOnce(false)
    expect((await post({ assigneeId: 'not-a-rep' })).status).toBe(403)
    nothingWritten()
  })

  it('refuses giving the member their own matter', async () => {
    m.findReadableCase.mockResolvedValueOnce({ claimId: 'case-1', memberId: 'member-9', assignedTo: null, claimType: 'grievance' })
    expect((await post({ assigneeId: 'member-9' })).status).toBe(403)
    nothingWritten()
  })

  it('maps an authority store denial of the governed assignment to 403', async () => {
    const { AuthorityStoreError } = await import('@/lib/authority/store/executor')
    m.findReadableCase.mockResolvedValueOnce({ claimId: 'case-1', memberId: 'member-9', assignedTo: null, claimType: 'grievance' })
    m.assignPrimaryRepresentative.mockRejectedValueOnce(new AuthorityStoreError('DENIED', 'kernel denied'))
    expect((await post({ assigneeId: 'rep-1' })).status).toBe(403)
    expect(m.persistAtomicAudit).not.toHaveBeenCalled()
  })

  it('refuses a missing case with 404 without writing', async () => {
    m.findReadableCase.mockResolvedValueOnce(null)
    expect((await post({ assigneeId: 'rep-1' })).status).toBe(404)
    nothingWritten()
  })
})
