import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ withApi: vi.fn(), review: vi.fn(), authority: vi.fn() }))

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod')
  const err = (status: number) => (message: string) => Object.assign(new Error(message), { status })
  return {
    withApi: m.withApi,
    z,
    ApiError: { forbidden: err(403), badRequest: err(400), notFound: err(404), conflict: err(409) },
  }
})
vi.mock('@/lib/services/precedent-review-authority', () => ({ resolvePrecedentReviewerAuthority: m.authority }))
vi.mock('@/lib/services/precedent-audited-service', () => ({ reviewPrecedentAudited: m.review }))

const ID = '22222222-2222-4222-8222-222222222222'
const body = { outcome: 'share', redactionConfirmed: true, consentConfirmed: true }

// DEF-0B11-PRP-PRECEDENT-POST-PUBLISHES-INTO-THE-SHARED-LIBRARY-WITH-NO-REVIEW-PROVENANCE-OR-OWNING-ORGANIZATION
describe('POST /api/precedents/drafts/[id]/review', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => handler)
  })
  const call = async (ctx: Record<string, unknown>) => {
    const { POST } = await import('../precedents/drafts/[id]/review/route')
    return (POST as unknown as (c: unknown) => Promise<unknown>)({ organizationId: 'o1', userId: 'u1', params: { id: ID }, body, ...ctx })
  }

  it('refuses every review while no reviewer authority is designated, and changes nothing', async () => {
    m.authority.mockResolvedValue({ allowed: false, reason: 'reviewer_authority_not_designated' })
    await expect(call({})).rejects.toMatchObject({ status: 403 })
    expect(m.review).not.toHaveBeenCalled()
  })

  it('runs the review once an authority allows it, and maps a self-review to 403', async () => {
    m.authority.mockResolvedValue({ allowed: true, reason: 'allowed' })
    m.review.mockResolvedValueOnce({ ok: true, precedent: { id: ID }, publicationStatus: 'shared' })
    await expect(call({})).resolves.toEqual({ precedent: { id: ID }, publicationStatus: 'shared' })
    expect(m.review).toHaveBeenCalledWith({ organizationId: 'o1', userId: 'u1' }, { id: ID, ...body })
    m.review.mockResolvedValueOnce({ ok: false, kind: 'self_review' })
    await expect(call({})).rejects.toMatchObject({ status: 403 })
  })

  it('the body is strict: an attempt to set publication fields directly is rejected', async () => {
    await import('../precedents/drafts/[id]/review/route')
    const schema = (m.withApi.mock.calls.at(-1)![0] as { body: { safeParse: (v: unknown) => { success: boolean } } }).body
    expect(schema.safeParse(body).success).toBe(true)
    expect(schema.safeParse({ ...body, outcome: 'revoke' }).success).toBe(true)
    expect(schema.safeParse({ ...body, isPublic: true }).success).toBe(false)
  })
})
