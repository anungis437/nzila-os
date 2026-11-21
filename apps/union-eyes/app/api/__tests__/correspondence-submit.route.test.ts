/** Step 1 S1-A06 / C16: submitting correspondence for review is steward-only, tenant-bound, and never touches another organization's letter. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ withApi: vi.fn(), getCorrespondenceById: vi.fn(), submitForReview: vi.fn() }))
vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }))
vi.mock('@/lib/services/correspondence-service', () => ({ getCorrespondenceById: m.getCorrespondenceById, submitForReview: m.submitForReview }))

const ID = '9f2c4b6e-1111-4222-8333-444455556677'
const ctx = (over: Record<string, unknown> = {}) => ({
  params: { id: ID }, organizationId: 'org_1', userId: 'u1', user: { name: 'Ada', role: 'steward' },
  request: new Request(`http://localhost/api/correspondence/${ID}/submit`, { method: 'POST' }), ...over,
})

describe('POST /api/correspondence/[id]/submit authority', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks()
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c))
    m.getCorrespondenceById.mockResolvedValue({ id: ID, organizationId: 'org_1' })
    m.submitForReview.mockResolvedValue({ id: ID, status: 'pending_review' })
  })
  it('requires an authenticated steward inside the caller tenant transaction', async () => {
    await import('../correspondence/[id]/submit/route')
    expect(m.withApi).toHaveBeenCalledWith(
      expect.objectContaining({ rlsOrgContext: true, auth: expect.objectContaining({ required: true, minRole: 'steward' }) }), expect.any(Function))
  })
  it("refuses another organization's correspondence as not found and submits nothing", async () => {
    m.getCorrespondenceById.mockResolvedValue({ id: ID, organizationId: 'org_2' })
    const { POST } = await import('../correspondence/[id]/submit/route')
    await expect((POST as unknown as (c: unknown) => Promise<unknown>)(ctx())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.submitForReview).not.toHaveBeenCalled()
  })
  it('refuses a missing record or id and submits nothing', async () => {
    m.getCorrespondenceById.mockResolvedValue(null)
    const { POST } = await import('../correspondence/[id]/submit/route')
    const call = POST as unknown as (c: unknown) => Promise<unknown>
    await expect(call(ctx())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(call(ctx({ params: {} }))).rejects.toBeTruthy()
    expect(m.submitForReview).not.toHaveBeenCalled()
  })
  it('submits as the bound actor for the own-tenant letter', async () => {
    const { POST } = await import('../correspondence/[id]/submit/route')
    expect(await (POST as unknown as (c: unknown) => Promise<unknown>)(ctx())).toEqual({ data: { id: ID, status: 'pending_review' } })
    expect(m.submitForReview).toHaveBeenCalledWith(ID, expect.objectContaining({ actorUserId: 'u1' }))
  })
})
