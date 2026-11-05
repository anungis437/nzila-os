import { beforeEach, describe, expect, it, vi } from 'vitest'

// The organization read authority is exercised in organizations-read-authority.pglite.test.ts; these tests exercise the
// route's own behaviour as a caller who administers the organization through a direct membership (or does not).
const m = vi.hoisted(() => ({
  administers: true,
  appendMandatoryAudit: vi.fn(),
  insertValues: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: vi.fn(async () => ({ userId: 'admin_1' })),
}))
vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/db/schema', () => ({ organizationMembers: {} }))
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: async () => ({ direct: new Map(), affiliated: new Set() }),
  canAdministerOrganization: () => m.administers,
  UUID_PATTERN: /^[0-9a-fA-F-]{36}$/,
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

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const body = {
  user_id: 'ue-v2-closure-member-1',
  role: 'member',
  name: 'Synthetic Member',
  email: 'member@example.invalid',
}
const post = (payload: unknown) =>
  new Request('http://localhost/api/organizations/${ORG_ID}/members', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

describe('organizations/[id]/members POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.administers = true
    m.insertValues.mockImplementation((v: Record<string, unknown>) => ({ id: 'row_1', ...v }))
    m.appendMandatoryAudit.mockResolvedValue(undefined)
  })

  it('accepts a non-UUID application user id and audits the membership in the same transaction', async () => {
    const { POST } = await loadRoute()
    const response = await POST(post(body) as never, { params: Promise.resolve({ id: ORG_ID }) })
    expect(response.status).toBe(201)
    expect(m.insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: body.user_id, status: 'pending' }))
    expect(m.appendMandatoryAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_ID,
        action: 'membership.create',
        userId: 'admin_1',
      }),
    )
  })

  it('fails the request when the mandatory audit write fails', async () => {
    const { POST } = await loadRoute()
    m.appendMandatoryAudit.mockRejectedValueOnce(new Error('audit unavailable'))
    await expect(
      POST(post(body) as never, { params: Promise.resolve({ id: ORG_ID }) }),
    ).rejects.toThrow('audit unavailable')
  })

  it('rejects a caller without a direct administrative role in the organization (steward, ancestor administrator, platform title)', async () => {
    const { POST } = await loadRoute()
    m.administers = false
    const response = await POST(post(body) as never, { params: Promise.resolve({ id: ORG_ID }) })
    expect(response.status).toBe(403)
    expect(m.insertValues).not.toHaveBeenCalled()
  })

  it('refuses to grant a privileged role (admin, executive) even to the organization\'s administrator', async () => {
    const { POST } = await loadRoute()
    for (const role of ['admin', 'executive']) {
      const response = await POST(post({ ...body, role }) as never, { params: Promise.resolve({ id: ORG_ID }) })
      expect(response.status, role).toBe(403)
    }
    expect(m.insertValues).not.toHaveBeenCalled()
  })
})
