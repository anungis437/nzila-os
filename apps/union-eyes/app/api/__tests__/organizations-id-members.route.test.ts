import { beforeEach, describe, expect, it, vi } from 'vitest'

// The organization read authority is proven in organizations-read-authority.route.test.ts; these tests exercise the
// route's own behaviour as a caller who may read and administer the organization.
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveOrganizationAccess,
  isAdministrativeRole: (role?: string) => role === 'admin',
  UUID_PATTERN: /^[0-9a-fA-F-]{36}$/,
}));
const m = vi.hoisted(() => ({
  requireUserForOrganization: vi.fn(),
  appendMandatoryAudit: vi.fn(),
  insertValues: vi.fn(),
  resolveOrganizationAccess: vi.fn(),
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
    m.requireUserForOrganization.mockResolvedValue({ userId: 'admin_1', roles: ['admin'] })
    m.resolveOrganizationAccess.mockResolvedValue({ platform: false, direct: new Map([[ORG_ID, 'admin']]), descendants: new Set() })
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

  it('rejects callers below steward', async () => {
    const { POST } = await loadRoute()
    m.requireUserForOrganization.mockResolvedValue({ userId: 'u1', roles: ['member'] })
    const response = await POST(post(body) as never, { params: Promise.resolve({ id: ORG_ID }) })
    expect(response.status).toBe(403)
    expect(m.insertValues).not.toHaveBeenCalled()
  })
  it('denies an active steward attempting to create a membership even with the member role', async () => {
    m.requireUserForOrganization.mockResolvedValue({ userId: 'steward_1', roles: ['steward'] })
    m.resolveOrganizationAccess.mockResolvedValue({ platform: false, direct: new Map([[ORG_ID, 'steward']]), descendants: new Set() })
    const { POST } = await loadRoute()
    const response = await POST(post(body) as never, { params: Promise.resolve({ id: ORG_ID }) })
    expect(response.status).toBe(403)
    expect(m.insertValues).not.toHaveBeenCalled()
  })

  it('does not treat a platform-wide role or hierarchy admin as membership-grant authority', async () => {
    m.resolveOrganizationAccess.mockResolvedValue({ platform: true, direct: new Map(), descendants: new Set([ORG_ID]) })
    const { POST } = await loadRoute()
    const response = await POST(post(body) as never, { params: Promise.resolve({ id: ORG_ID }) })
    expect(response.status).toBe(403)
    expect(m.insertValues).not.toHaveBeenCalled()
  })

  it('denies privileged executive grants without an independent approval workflow', async () => {
    const { POST } = await loadRoute()
    const response = await POST(post({ ...body, role: 'executive' }) as never, { params: Promise.resolve({ id: ORG_ID }) })
    expect(response.status).toBe(403)
    expect(m.insertValues).not.toHaveBeenCalled()
  })

  it('denies full roster GET to stewards and platform-only users', async () => {
    const { GET } = await loadRoute()
    for (const access of [
      { platform: false, direct: new Map([[ORG_ID, 'steward']]), descendants: new Set() },
      { platform: true, direct: new Map(), descendants: new Set() },
    ]) {
      m.resolveOrganizationAccess.mockResolvedValueOnce(access)
      const response = await GET(new Request('http://localhost/api/organizations/' + ORG_ID + '/members') as never, { params: Promise.resolve({ id: ORG_ID }) })
      expect(response.status).toBe(403)
    }
  })

})
