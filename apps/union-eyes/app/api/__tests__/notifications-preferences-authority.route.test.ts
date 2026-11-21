/** Step 1 S1-A06 / C17: notification preferences are written only for the authenticated caller in their own organization, with audit. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ withApi: vi.fn(), audit: vi.fn(), where: vi.fn(), values: vi.fn(), configs: [] as unknown[] }))
vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: (col: unknown, value: unknown) => ({ eq: value }), and: (...parts: unknown[]) => ({ and: parts }),
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (fn: (tx: unknown) => unknown) => fn({
    select: () => ({ from: () => ({ where: (w: unknown) => { m.where(w); return { limit: async () => [] } } }) }),
    insert: () => ({ values: (v: unknown) => { m.values(v); return { returning: async () => [{ id: 'pref-1' }] } } }),
  }),
}))

describe('PUT /api/notifications/preferences authority', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks(); m.configs = []
    m.withApi.mockImplementation((cfg: unknown, handler: (c: unknown) => Promise<unknown>) => { m.configs.push(cfg); return (c: unknown) => handler(c) })
  })
  it('requires authentication and a strict body that cannot name another user or organization', async () => {
    const { PUT } = await import('../notifications/preferences/route')
    void PUT
    const put = m.configs[1] as { auth: { required: boolean }; body: { safeParse: (v: unknown) => { success: boolean } } }
    expect(put.auth).toMatchObject({ required: true, minRole: 'member' })
    expect(put.body.safeParse({ emailEnabled: true }).success).toBe(true)
    expect(put.body.safeParse({ emailEnabled: true, userId: 'someone-else' }).success).toBe(false)
    expect(put.body.safeParse({ emailEnabled: true, organizationId: 'org-2' }).success).toBe(false)
  })
  it("reads and writes only the bound caller's own row in their own organization, with its audit", async () => {
    const { PUT } = await import('../notifications/preferences/route')
    await (PUT as unknown as (c: unknown) => Promise<unknown>)({ body: { emailEnabled: false, email: 'u1@example.test' }, user: {}, userId: 'u1', organizationId: 'org-1' })
    expect(JSON.stringify(m.where.mock.calls[0][0])).toContain('"eq":"u1"')
    expect(JSON.stringify(m.where.mock.calls[0][0])).toContain('"eq":"org-1"')
    expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', organizationId: 'org-1' }))
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'u1', organizationId: 'org-1', action: 'notification_preferences.update' }))
  })
})
