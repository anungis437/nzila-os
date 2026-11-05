import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  persistAtomicAudit: vi.fn(),
  withRLSContext: vi.fn(),
  insertValues: vi.fn(),
  verify: vi.fn(),
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
vi.mock('@/lib/pilot/onboarding-event-evidence', () => ({ verifyOnboardingMilestone: m.verify }))

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
    m.verify.mockResolvedValue({ ok: true, evidence: { memberRole: 'steward' } })
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

  it('F06 A4: records nothing when the organization data does not show the milestone the caller asserts', async () => {
    m.verify.mockResolvedValueOnce({ ok: false, reason: 'the target member does not hold that role' })

    const res = await post({ eventType: 'role_assigned', targetUserId: 'u2', role: 'admin' })

    expect(res.status).toBe(409)
    expect(JSON.stringify(await res.json())).toContain('does not hold that role')
    expect(m.insertValues).not.toHaveBeenCalled()
    expect(m.persistAtomicAudit).not.toHaveBeenCalled()
    expect(m.verify).toHaveBeenCalledWith(tx, 'org_1', 'role_assigned', 'u2', 'admin')
  })

  it('F06 A4: stamps the event and audit with what was verified', async () => {
    await post({ eventType: 'role_assigned', targetUserId: 'u2', role: 'steward' })

    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ verifiedAgainst: 'organization_members' }) }),
    )
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ details: expect.objectContaining({ evidence: { memberRole: 'steward' } }) }),
    )
  })

  it('the transfers route no longer reuses the audited handler: it answers 501 and records nothing', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../transfers/route.ts'), 'utf8')

    expect(source).toContain('ApiError.notImplemented')
    expect(source).not.toContain('persistAtomicAudit')
    expect(source).not.toContain('events/route')
  })
})
