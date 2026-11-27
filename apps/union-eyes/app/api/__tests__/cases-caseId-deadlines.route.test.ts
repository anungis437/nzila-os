/**
 * Step 1 S1-A06 / C21: POST and PATCH /api/cases/[caseId]/deadlines refuse an unauthenticated caller, a caller without the
 * case module, and any caller the deadline service's authority check refuses (member, other tenant), and never answer
 * 200/201 for a refused or malformed change.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  getCaseActor: vi.fn(), requireEntitlement: vi.fn(),
  createCaseDeadline: vi.fn(), changeCaseDeadline: vi.fn(), listCaseDeadlines: vi.fn(),
}))
vi.mock('@/lib/cases/case-authorization', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cases/case-authorization')>()
  return { ...actual, getCaseActor: m.getCaseActor }
})
vi.mock('@/lib/cases/case-deadlines', () => ({
  createCaseDeadline: m.createCaseDeadline, changeCaseDeadline: m.changeCaseDeadline, listCaseDeadlines: m.listCaseDeadlines,
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (fn: (tx: unknown) => unknown) => fn({}) }))

const actor = { userId: 'member-1', organizationId: 'org-1', role: 'member' }
const call = async (method: 'POST' | 'PATCH', body: unknown) => {
  const route = await import('../cases/[caseId]/deadlines/route')
  const request = new Request('http://localhost/api/cases/case-1/deadlines', { method, body: typeof body === 'string' ? body : JSON.stringify(body) })
  return route[method](request, { params: Promise.resolve({ caseId: 'case-1' }) })
}
const create = { id: '0b7c5a3e-1f2d-4c3b-9a8e-0000000000e1', title: 'Synthetic deadline', dueDay: '2026-12-01' }

describe('case deadline mutations refuse unauthorized callers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.getCaseActor.mockResolvedValue(actor)
    m.requireEntitlement.mockResolvedValue(undefined)
  })

  it('refuses an unauthenticated caller with 401 before any write', async () => {
    const { ApiError } = await import('@/lib/api/errors')
    m.getCaseActor.mockRejectedValue(ApiError.unauthorized())
    for (const method of ['POST', 'PATCH'] as const) expect((await call(method, create)).status).toBe(401)
    expect(m.createCaseDeadline).not.toHaveBeenCalled()
    expect(m.changeCaseDeadline).not.toHaveBeenCalled()
  })

  it('refuses an organization without the case module with 403 before any write', async () => {
    m.requireEntitlement.mockRejectedValue(Object.assign(new Error('entitlement'), { code: 'ENTITLEMENT_REQUIRED' }))
    expect((await call('POST', create)).status).toBe(403)
    expect(m.createCaseDeadline).not.toHaveBeenCalled()
  })

  it('surfaces the deadline authority refusal (e.g. a member or another tenant) as 403, for create and change', async () => {
    const { ApiError } = await import('@/lib/api/errors')
    m.createCaseDeadline.mockRejectedValue(ApiError.forbidden('This action is not permitted for this case.'))
    m.changeCaseDeadline.mockRejectedValue(ApiError.forbidden('This action is not permitted for this case.'))
    expect((await call('POST', create)).status).toBe(403)
    expect((await call('PATCH', { id: create.id, version: 'v1', action: 'complete' })).status).toBe(403)
    expect(m.changeCaseDeadline).toHaveBeenCalledTimes(1)
  })

  it('refuses malformed input with 400 without reaching the service', async () => {
    expect((await call('POST', '{not json')).status).toBe(400)
    expect((await call('POST', { title: '' })).status).toBe(400)
    expect(m.createCaseDeadline).not.toHaveBeenCalled()
  })

  it('reports a duplicate deadline id as 409, never as success', async () => {
    m.createCaseDeadline.mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' }))
    expect((await call('POST', create)).status).toBe(409)
  })
})
