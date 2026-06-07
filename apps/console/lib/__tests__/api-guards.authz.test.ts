import { afterEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const authMock = vi.fn()
  const headersMock = vi.fn()
  const getUserRoleMock = vi.fn()

  const eqMock = vi.fn((...args: unknown[]) => ({ op: 'eq', args }))
  const andMock = vi.fn((...args: unknown[]) => ({ op: 'and', args }))

  const platformDbMock = {
    select: vi.fn(),
  }

  return {
    authMock,
    headersMock,
    getUserRoleMock,
    eqMock,
    andMock,
    platformDbMock,
  }
})

vi.mock('@nzila/db', () => ({
  createScopedDb: vi.fn(),
  createAuditedScopedDb: vi.fn(),
  withAudit: vi.fn(),
}))

vi.mock('@nzila/db/platform', () => ({ platformDb: h.platformDbMock }))

vi.mock('@nzila/db/schema', () => ({
  orgMembers: {
    id: 'id',
    orgId: 'orgId',
    userId: 'userId',
    role: 'role',
    status: 'status',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: h.eqMock,
  and: h.andMock,
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: h.authMock,
}))

vi.mock('next/headers', () => ({
  headers: h.headersMock,
}))

vi.mock('@/lib/rbac', () => ({
  getUserRole: h.getUserRoleMock,
}))

vi.mock('@nzila/os-core', () => ({
  createRequestContext: vi.fn(() => ({ requestId: 'req_1' })),
  runWithContext: vi.fn(async (_ctx, fn: () => Promise<unknown>) => fn()),
}))

import { authenticateUser, requireOrgAccess, requirePlatformRole } from '../api-guards'

function membershipSelectChain(rows: Array<unknown>) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  }
}

describe('api-guards authz boundaries', () => {
  afterEach(() => {
    delete process.env.AI_SERVICE_KEY
    vi.clearAllMocks()
  })

  it('returns unauthorized when no service key and no user session', async () => {
    h.authMock.mockResolvedValueOnce({ userId: null })

    const result = await authenticateUser()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it('authenticates service caller when bearer key matches', async () => {
    process.env.AI_SERVICE_KEY = 'svc-key'
    h.headersMock.mockResolvedValueOnce({
      get: (name: string) => (name === 'authorization' ? 'Bearer svc-key' : null),
    })

    const result = await authenticateUser()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.isService).toBe(true)
      expect(result.userId).toBe('svc:ai-gateway')
      expect(result.platformRole).toBe('app_owner')
    }
  })

  it('denies org access when membership is missing', async () => {
    h.authMock.mockResolvedValueOnce({ userId: 'user_1' })
    h.getUserRoleMock.mockResolvedValueOnce('org_member')
    h.platformDbMock.select.mockImplementationOnce(() => membershipSelectChain([]))

    const result = await requireOrgAccess('org_1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it('allows org access with active membership and sufficient role', async () => {
    h.authMock.mockResolvedValueOnce({ userId: 'user_1' })
    h.getUserRoleMock.mockResolvedValueOnce('org_member')
    h.platformDbMock.select.mockImplementationOnce(() =>
      membershipSelectChain([
        {
          id: 'm_1',
          orgId: 'org_1',
          userId: 'user_1',
          role: 'org_admin',
          status: 'active',
        },
      ]),
    )

    const result = await requireOrgAccess('org_1', { minRole: 'org_secretary' })
    expect(result.ok).toBe(true)
  })

  it('denies org access when member role is below required minimum', async () => {
    h.authMock.mockResolvedValueOnce({ userId: 'user_1' })
    h.getUserRoleMock.mockResolvedValueOnce('org_member')
    h.platformDbMock.select.mockImplementationOnce(() =>
      membershipSelectChain([
        {
          id: 'm_1',
          orgId: 'org_1',
          userId: 'user_1',
          role: 'org_viewer',
          status: 'active',
        },
      ]),
    )

    const result = await requireOrgAccess('org_1', { minRole: 'org_secretary' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it('allows explicit platform bypass but not implicit service bypass', async () => {
    h.authMock.mockResolvedValueOnce({ userId: 'admin_1' })
    h.getUserRoleMock.mockResolvedValueOnce('platform_admin')

    const bypassed = await requireOrgAccess('org_1', { platformBypass: ['platform_admin'] })
    expect(bypassed.ok).toBe(true)

    process.env.AI_SERVICE_KEY = 'svc-key'
    h.headersMock.mockResolvedValueOnce({
      get: (name: string) => (name === 'authorization' ? 'Bearer svc-key' : null),
    })
    h.platformDbMock.select.mockImplementationOnce(() => membershipSelectChain([]))

    const serviceAttempt = await requireOrgAccess('org_1')
    expect(serviceAttempt.ok).toBe(false)
  })

  it('enforces allowed platform roles', async () => {
    h.authMock.mockResolvedValueOnce({ userId: 'user_1' })
    h.getUserRoleMock.mockResolvedValueOnce('org_member')

    const denied = await requirePlatformRole('platform_admin')
    expect(denied.ok).toBe(false)

    h.authMock.mockResolvedValueOnce({ userId: 'admin_1' })
    h.getUserRoleMock.mockResolvedValueOnce('platform_admin')

    const allowed = await requirePlatformRole('platform_admin')
    expect(allowed.ok).toBe(true)
  })
})
