/**
 * Step 1 S1-A06 / C20: privacy request actions require authentication and always hand the authenticated actor and the exact
 * request/thread id to the privacy service, whose requester/assigned-handler authority is proven in lib/privacy/requests.pglite.test.ts
 * and db/__tests__/privacy-requests.postgres.test.ts. The route never acts on an id or actor of its own choosing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ configs: [] as Record<string, unknown>[], ack: vi.fn(), respond: vi.fn(), reply: vi.fn(), get: vi.fn(), getConv: vi.fn() }))
vi.mock('@/lib/api/framework', () => ({
  withApi: (cfg: Record<string, unknown>, handler: (c: unknown) => Promise<unknown>) => { m.configs.push(cfg); return (c: unknown) => handler(c) },
}))
vi.mock('@/lib/privacy/api', () => ({
  withPrivacyDatabase: (context: { userId: string }, fn: (tx: unknown, actor: unknown) => unknown) => fn({ tx: true }, { userId: context.userId }),
}))
vi.mock('@/lib/privacy/requests', () => ({
  acknowledgePrivacyRequest: m.ack, getPrivacyRequest: m.get, respondToPrivacyRequest: m.respond,
  replyToPrivacyConversation: m.reply, getPrivacyConversation: m.getConv,
}))

const REQ = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000b1'
describe('privacy request action routes', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); m.configs = [] })

  it('POST /api/privacy/dsar/[requestId] requires an authenticated member and acknowledges as the bound actor, for that request only', async () => {
    const { POST } = await import('../privacy/dsar/[requestId]/route')
    const cfg = m.configs[1] as { auth: unknown; body: { safeParse: (v: unknown) => { success: boolean } } }
    expect(cfg.auth).toMatchObject({ required: true, minRole: 'member' })
    m.ack.mockResolvedValue({ acknowledged: true })
    await (POST as unknown as (c: unknown) => Promise<unknown>)({ userId: 'member-1', params: { requestId: REQ }, body: { kind: 'x' } })
    expect(m.ack).toHaveBeenCalledWith({ tx: true }, { userId: 'member-1' }, REQ, { kind: 'x' })
  })

  it('POST /api/privacy/threads/[threadId] requires authentication and records the response as the bound handler for that thread only', async () => {
    const { POST } = await import('../privacy/threads/[threadId]/route')
    const cfg = m.configs[1] as { auth: unknown }
    expect(cfg.auth).toMatchObject({ required: true, minRole: 'member' })
    m.respond.mockResolvedValue({ responded: true })
    await (POST as unknown as (c: unknown) => Promise<unknown>)({ userId: 'handler-1', params: { threadId: REQ }, body: { scope: 'full' } })
    expect(m.respond).toHaveBeenCalledWith({ tx: true }, { userId: 'handler-1' }, REQ, { scope: 'full' })
  })

  it('a service refusal (not the requester, not the assigned handler) propagates; the route never substitutes success', async () => {
    const { POST } = await import('../privacy/threads/[threadId]/route')
    m.respond.mockRejectedValue(Object.assign(new Error('not the assigned handler'), { code: 'FORBIDDEN' }))
    await expect((POST as unknown as (c: unknown) => Promise<unknown>)({ userId: 'other-1', params: { threadId: REQ }, body: {} }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('the member clarification (PATCH) is strictly validated and bound to the actor and thread', async () => {
    const { PATCH } = await import('../privacy/threads/[threadId]/route')
    const cfg = m.configs[2] as { auth: unknown; body: { safeParse: (v: unknown) => { success: boolean } } }
    expect(cfg.auth).toMatchObject({ required: true })
    expect(cfg.body.safeParse({ body: 'More detail', clientRequestId: REQ }).success).toBe(true)
    expect(cfg.body.safeParse({ body: 'More detail', clientRequestId: REQ, userId: 'someone-else' }).success).toBe(false)
    m.reply.mockResolvedValue({ replied: true })
    await (PATCH as unknown as (c: unknown) => Promise<unknown>)({ userId: 'member-1', params: { threadId: REQ }, body: { body: 'More detail', clientRequestId: REQ } })
    expect(m.reply).toHaveBeenCalledWith({ tx: true }, { userId: 'member-1' }, REQ, expect.objectContaining({ body: 'More detail' }))
  })
})
