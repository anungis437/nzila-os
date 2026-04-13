/**
 * Cora — Org Context Resolution Tests
 *
 * Tests the mapAuthRoleToAgriRole logic (through resolveOrgContext)
 * and error handling for unauthenticated / no-org states.
 *
 * @see lib/resolve-org.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock platform auth
const mockAuth = vi.fn()
const mockCurrentUser = vi.fn()
const mockIsSuperAdmin = vi.fn()
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}))
vi.mock('@nzila/os-core/config/super-admins', () => ({
  isSuperAdmin: (email: string | undefined) => mockIsSuperAdmin(email),
}))

import { resolveOrgContext } from '../resolve-org'
import { locales, defaultLocale } from '../locales'

describe('resolveOrgContext', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })
    mockCurrentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'regular@example.com' }, emailAddresses: [] })
    mockIsSuperAdmin.mockReturnValue(false)
  })

  it('throws Unauthorized when userId is missing', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null, sessionClaims: null })
    await expect(resolveOrgContext()).rejects.toThrow('Unauthorized')
  })

  it('throws when no active organization', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-1', orgId: null, orgRole: null, sessionClaims: null })
    await expect(resolveOrgContext()).rejects.toThrow('No active organization')
  })

  it('resolves context with viewer role for org:member', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      orgId: 'org-001',
      orgRole: 'org:member',
      sessionClaims: null,
    })

    const ctx = await resolveOrgContext()
    expect(ctx.orgId).toBe('org-001')
    expect(ctx.actorId).toBe('user-1')
    expect(ctx.role).toBe('viewer')
  })

  it('resolves context with admin role for org:admin', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-2',
      orgId: 'org-001',
      orgRole: 'org:admin',
      sessionClaims: null,
    })

    const ctx = await resolveOrgContext()
    expect(ctx.role).toBe('admin')
  })

  it('prefers publicMetadata.agriRole over orgRole', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-3',
      orgId: 'org-001',
      orgRole: 'org:member',
      sessionClaims: { publicMetadata: { agriRole: 'cooperative_manager' } },
    })

    const ctx = await resolveOrgContext()
    expect(ctx.role).toBe('cooperative_manager')
  })

  it('ignores invalid agriRole from session claims', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-4',
      orgId: 'org-001',
      orgRole: 'org:admin',
      sessionClaims: { publicMetadata: { agriRole: 'superuser' } },
    })

    const ctx = await resolveOrgContext()
    // 'superuser' is not in the valid list, falls back to orgRole mapping
    expect(ctx.role).toBe('admin')
  })

  it('returns read-only permissions for Cora', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-5',
      orgId: 'org-001',
      orgRole: 'org:admin',
      sessionClaims: null,
    })

    const ctx = await resolveOrgContext()
    expect(ctx.permissions).toEqual([
      'agri:read',
      'agri:dashboard:view',
      'agri:intelligence:view',
      'agri:evidence:view',
    ])
  })

  it('defaults unknown orgRole to viewer', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-6',
      orgId: 'org-001',
      orgRole: 'org:custom_role',
      sessionClaims: null,
    })

    const ctx = await resolveOrgContext()
    expect(ctx.role).toBe('viewer')
  })

  it('elevates member role to admin for super-admin email', async () => {
    mockIsSuperAdmin.mockReturnValue(true)
    mockAuth.mockResolvedValue({
      userId: 'user-7',
      orgId: 'org-001',
      orgRole: 'org:member',
      sessionClaims: null,
    })

    const ctx = await resolveOrgContext()
    expect(ctx.role).toBe('admin')
  })

  it('uses fallback emailAddresses value for super-admin check', async () => {
    mockIsSuperAdmin.mockImplementation((email) => email === 'fallback@example.com')
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: null,
      emailAddresses: [{ emailAddress: 'fallback@example.com' }],
    })
    mockAuth.mockResolvedValue({
      userId: 'user-8',
      orgId: 'org-001',
      orgRole: 'org:member',
      sessionClaims: null,
    })

    const ctx = await resolveOrgContext()
    expect(ctx.role).toBe('admin')
  })

  it('exports locale constants', () => {
    expect(locales).toEqual(['en-CA', 'fr-CA'])
    expect(defaultLocale).toBe('en-CA')
  })
})
