import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  persistAtomicAudit: vi.fn(),
  withRLSContext: vi.fn(),
  insertValues: vi.fn(),
}))

const tx = {
  insert: vi.fn(() => ({
    values: (v: unknown) => ({ returning: async () => (m.insertValues(v), [{ id: 'evt-1' }]) }),
  })),
}

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (req: Request, ctx: any) => Promise<Response>) => (req: Request, ctx: any) => handler(req, ctx),
}))
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }))
vi.mock('@/db/schema', () => ({ pilotEvents: { id: 'id' } }))

const ctx = { organizationId: 'org_1', userId: 'u1' }
const post = async (body: unknown, route: 'events' | 'transfers' = 'events') => {
  const { POST } = await (route === 'events' ? import('../events/route') : import('../transfers/route'))
  return POST(
    new Request('http://localhost/api/onboarding/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
    ctx as never,
  )
}

describe('onboarding/events route — event and audit commit together', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.hasMinRole.mockResolvedValue(true)
    m.persistAtomicAudit.mockResolvedValue(undefined)
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx))
  })

  it('records the event and the audit on the same transaction, scoped to the caller organization', async () => {
    const res = await post({ eventType: 'role_assigned', targetUserId: 'u2', role: 'steward' })

    expect(res.status).toBe(200)
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function))
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', eventType: 'role_assigned' }),
    )
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'u1',
        action: 'onboarding.event.role_assigned',
        resourceType: 'pilot_events',
        resourceId: 'evt-1',
      }),
    )
  })

  it('fails when the audit cannot be written, so the event does not commit', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'))

    await expect(post({ eventType: 'org_created' })).rejects.toThrow('audit down')
  })

  it('refuses a caller below steward and writes nothing', async () => {
    m.hasMinRole.mockResolvedValueOnce(false)

    const res = await post({ eventType: 'org_created' })

    expect(res.status).toBe(403)
    expect(m.withRLSContext).not.toHaveBeenCalled()
    expect(m.persistAtomicAudit).not.toHaveBeenCalled()
  })

  it('rejects an unknown event type before any write', async () => {
    const res = await post({ eventType: 'user_login' })

    expect(res.status).toBe(400)
    expect(m.withRLSContext).not.toHaveBeenCalled()
  })

  it('the transfers route delegates to the same audited handler', async () => {
    const res = await post({ eventType: 'user_invited', targetUserId: 'u3' }, 'transfers')

    expect(res.status).toBe(200)
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1)
  })
})
