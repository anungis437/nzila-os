import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NacpRole } from '@nzila/nacp-core/enums'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
  isSuperAdmin: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@nzila/os-core/config/super-admins', () => ({
  isSuperAdmin: mocks.isSuperAdmin,
}))

import { resolveOrgContext } from './resolve-org'

describe('resolveOrgContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('req-id')
    mocks.currentUser.mockResolvedValue(null)
    mocks.isSuperAdmin.mockReturnValue(false)
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org_member',
      sessionClaims: null,
    })
  })

  it('redirects to sign-in when unauthenticated', async () => {
    mocks.auth.mockResolvedValue({ userId: null, orgId: 'org_1' })

    await expect(resolveOrgContext()).rejects.toThrow('REDIRECT:/sign-in')
  })

  it('redirects to select-org when org is missing', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1', orgId: null })

    await expect(resolveOrgContext()).rejects.toThrow('REDIRECT:/select-org')
  })

  it('maps org_admin to admin role', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org_admin',
      sessionClaims: null,
    })

    const result = await resolveOrgContext()

    expect(result.role).toBe(NacpRole.ADMIN)
    expect(result.permissions).toContain('nacp:settings:manage')
    expect(result.requestId).toBe('req-id')
  })

  it('maps org:admin to admin role', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org:admin',
      sessionClaims: null,
    })

    const result = await resolveOrgContext()

    expect(result.role).toBe(NacpRole.ADMIN)
  })

  it('maps org_secretary to invigilator role', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org_secretary',
      sessionClaims: null,
    })

    const result = await resolveOrgContext()

    expect(result.role).toBe(NacpRole.INVIGILATOR)
    expect(result.permissions).toContain('nacp:candidate:manage')
    expect(result.permissions).not.toContain('nacp:session:create')
  })

  it('maps org:member to invigilator role', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org:member',
      sessionClaims: null,
    })

    const result = await resolveOrgContext()

    expect(result.role).toBe(NacpRole.INVIGILATOR)
  })

  it('uses publicMetadata nacpRole when valid', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org_member',
      sessionClaims: {
        publicMetadata: {
          nacpRole: NacpRole.EXAMINER,
        },
      },
    })

    const result = await resolveOrgContext()

    expect(result.role).toBe(NacpRole.EXAMINER)
    expect(result.permissions).toContain('nacp:session:create')
    expect(result.permissions).not.toContain('nacp:settings:manage')
  })

  it('falls back to viewer role for unknown org role', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'unknown_role',
      sessionClaims: null,
    })

    const result = await resolveOrgContext()

    expect(result.role).toBe(NacpRole.VIEWER)
    expect(result.permissions).toEqual(['nacp:read', 'nacp:session:list'])
  })

  it('upgrades to admin role for super admin email', async () => {
    mocks.isSuperAdmin.mockReturnValue(true)
    mocks.currentUser.mockResolvedValue({
      primaryEmailAddress: {
        emailAddress: 'admin@nzila.test',
      },
      emailAddresses: [],
    })
    mocks.auth.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org_member',
      sessionClaims: null,
    })

    const result = await resolveOrgContext()

    expect(result.role).toBe(NacpRole.ADMIN)
    expect(result.permissions).toContain('nacp:settings:manage')
  })
})
