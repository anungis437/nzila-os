import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAuth,
  mockCurrentUser,
  mockResolveInternalOrgId,
  mockIsSuperAdmin,
  mockGetOrgCommerceConfig,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCurrentUser: vi.fn(),
  mockResolveInternalOrgId: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
  mockGetOrgCommerceConfig: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mockAuth,
  currentUser: mockCurrentUser,
}))

vi.mock('@/lib/org-resolver', () => ({
  resolveInternalOrgId: mockResolveInternalOrgId,
}))

vi.mock('@nzila/os-core', () => ({
  isSuperAdmin: mockIsSuperAdmin,
}))

vi.mock('@nzila/platform-commerce-org/service', () => ({
  getOrgCommerceConfig: mockGetOrgCommerceConfig,
}))

describe('resolve-org slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveInternalOrgId.mockResolvedValue('int-org-1')
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'user@example.com' },
      emailAddresses: [{ emailAddress: 'user@example.com' }],
    })
    mockIsSuperAdmin.mockReturnValue(false)
    mockGetOrgCommerceConfig.mockResolvedValue({ locale: 'en-CA' })
  })

  it('throws when unauthenticated or missing org selection', async () => {
    const { resolveOrgContext } = await import('@/lib/resolve-org')

    mockAuth.mockResolvedValueOnce({ userId: null, orgId: 'org-1', orgRole: 'org:member' })
    await expect(resolveOrgContext()).rejects.toThrow('Unauthorized')

    mockAuth.mockResolvedValueOnce({ userId: 'u-1', orgId: null, orgRole: 'org:member' })
    await expect(resolveOrgContext()).rejects.toThrow('No active organization')
  })

  it('maps org roles and derives expected permissions', async () => {
    const { resolveOrgContext } = await import('@/lib/resolve-org')

    mockAuth.mockResolvedValueOnce({ userId: 'u-o', orgId: 'org-1', orgRole: 'org:owner' })
    const owner = await resolveOrgContext()
    expect(owner.role).toBe('owner')
    expect(owner.permissions).toContain('quote:delete')

    mockAuth.mockResolvedValueOnce({ userId: 'u-a', orgId: 'org-1', orgRole: 'org:admin' })
    const admin = await resolveOrgContext()
    expect(admin.role).toBe('admin')
    expect(admin.permissions).toContain('quote:delete')

    mockAuth.mockResolvedValueOnce({ userId: 'u-m', orgId: 'org-1', orgRole: 'org_manager' })
    const manager = await resolveOrgContext()
    expect(manager.role).toBe('manager')
    expect(manager.permissions).toContain('quote:approve')

    mockAuth.mockResolvedValueOnce({ userId: 'u-m2', orgId: 'org-1', orgRole: 'org:member' })
    const salesFromMember = await resolveOrgContext()
    expect(salesFromMember.role).toBe('sales')
    expect(salesFromMember.permissions).toContain('quote:send')

    mockAuth.mockResolvedValueOnce({ userId: 'u-s', orgId: 'org-1', orgRole: 'org_secretary' })
    const sales = await resolveOrgContext()
    expect(sales.role).toBe('sales')
    expect(sales.permissions).toContain('quote:send')

    mockAuth.mockResolvedValueOnce({ userId: 'u-v', orgId: 'org-1', orgRole: 'unknown' })
    const viewer = await resolveOrgContext()
    expect(viewer.role).toBe('viewer')
    expect(viewer.permissions).toEqual(['quote:read'])
  })

  it('elevates to admin when super-admin email is detected', async () => {
    const { resolveOrgContext } = await import('@/lib/resolve-org')

    mockAuth.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1', orgRole: 'org:member' })
    mockCurrentUser.mockResolvedValueOnce({
      primaryEmailAddress: null,
      emailAddresses: [{ emailAddress: 'superadmin@example.com' }],
    })
    mockIsSuperAdmin.mockReturnValueOnce(true)
    const ctx = await resolveOrgContext()

    expect(ctx.role).toBe('admin')
    expect(ctx.permissions).toContain('quote:delete')
  })

  it('resolveOrgCommerceContext returns context plus commerce config', async () => {
    const { resolveOrgCommerceContext } = await import('@/lib/resolve-org')

    mockAuth.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1', orgRole: 'org:admin' })
    const result = await resolveOrgCommerceContext()

    expect(result.ctx.orgId).toBe('int-org-1')
    expect(result.config).toEqual({ locale: 'en-CA' })
    expect(mockGetOrgCommerceConfig).toHaveBeenCalledWith('int-org-1')
  })
})
