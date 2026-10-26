import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  requireUserForOrganization: vi.fn(),
  appendMandatoryAudit: vi.fn(),
  insertValues: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: vi.fn(async () => ({ userId: 'admin_1' })),
}))
vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/db/schema', () => ({ organizationMembers: {} }))
vi.mock('@/lib/api-auth-guard', () => ({
  requireUserForOrganization: m.requireUserForOrganization,
  ROLE_HIERARCHY: { member: 1, steward: 2, admin: 3 },
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.appendMandatoryAudit }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      insert: () => ({
        values: (v: unknown) => ({ returning: async () => [m.insertValues(v)] }),
      }),
    }),
}))

async function loadRoute() {
  return import('../organizations/[id]/members/route')
}

const body = {
  user_id: 'ue-v2-closure-member-1',
  role: 'member',
  name: 'Synthetic Member',
  email: 'member@example.invalid',
}
const post = (payload: unknown) =>
  new Request('http://localhost/api/organizations/org_1/members', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

describe('organizations/[id]/members POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requireUserForOrganization.mockResolvedValue({ userId: 'admin_1', roles: ['admin'] })
    m.insertValues.mockImplementation((v: Record<string, unknown>) => ({ id: 'row_1', ...v }))
    m.appendMandatoryAudit.mockResolvedValue(undefined)
  })

  it('accepts a non-UUID application user id and audits the membership in the same transaction', async () => {
    const { POST } = await loadRoute()
    const response = await POST(post(body) as never, { params: Promise.resolve({ id: 'org_1' }) })
    expect(response.status).toBe(201)
    expect(m.insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: body.user_id }))
    expect(m.appendMandatoryAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: 'org_1',
        action: 'membership.create',
        userId: 'admin_1',
      }),
    )
  })

  it('fails the request when the mandatory audit write fails', async () => {
    const { POST } = await loadRoute()
    m.appendMandatoryAudit.mockRejectedValueOnce(new Error('audit unavailable'))
    await expect(
      POST(post(body) as never, { params: Promise.resolve({ id: 'org_1' }) }),
    ).rejects.toThrow('audit unavailable')
  })

  it('rejects callers below steward', async () => {
    const { POST } = await loadRoute()
    m.requireUserForOrganization.mockResolvedValue({ userId: 'u1', roles: ['member'] })
    const response = await POST(post(body) as never, { params: Promise.resolve({ id: 'org_1' }) })
    expect(response.status).toBe(403)
    expect(m.insertValues).not.toHaveBeenCalled()
  })
})
