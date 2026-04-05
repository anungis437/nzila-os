import { describe, it, expect } from 'vitest'
import {
  hasPlatformRole,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canAccessModule,
  isOrgMember,
  meetsOrgRoleRequirement,
  checkPrivilegedAction,
} from './authorization'
import type { OrgContext } from '@nzila/org'

function makeCtx(overrides?: Partial<OrgContext>): OrgContext {
  return {
    orgId: 'org-1',
    actorId: 'user-1',
    role: 'org_admin',
    permissions: ['read', 'write', 'manage_users'],
    requestId: 'req-1',
    ...overrides,
  }
}

describe('hasPlatformRole', () => {
  it('returns true when role is sufficient', () => {
    expect(hasPlatformRole('platform_admin', 'org_admin')).toBe(true)
  })

  it('returns false when role is insufficient', () => {
    expect(hasPlatformRole('org_viewer', 'org_admin')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('returns true for present permission', () => {
    expect(hasPermission(makeCtx(), 'read')).toBe(true)
  })

  it('returns false for missing permission', () => {
    expect(hasPermission(makeCtx(), 'delete')).toBe(false)
  })
})

describe('hasAllPermissions', () => {
  it('returns true when all present', () => {
    expect(hasAllPermissions(makeCtx(), ['read', 'write'])).toBe(true)
  })

  it('returns false when one is missing', () => {
    expect(hasAllPermissions(makeCtx(), ['read', 'delete'])).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('returns true when at least one present', () => {
    expect(hasAnyPermission(makeCtx(), ['delete', 'read'])).toBe(true)
  })

  it('returns false when none present', () => {
    expect(hasAnyPermission(makeCtx(), ['delete', 'archive'])).toBe(false)
  })
})

describe('canAccessModule', () => {
  it('grants access when module is enabled and no role required', () => {
    const result = canAccessModule(
      { userRole: 'org_member', permissions: [], enabledModules: ['flow'] },
      'flow',
      {},
    )
    expect(result.granted).toBe(true)
  })

  it('denies access when module is not enabled', () => {
    const result = canAccessModule(
      { userRole: 'org_admin', permissions: [], enabledModules: [] },
      'flow',
      {},
    )
    expect(result.granted).toBe(false)
  })

  it('denies access when role is insufficient', () => {
    const result = canAccessModule(
      { userRole: 'org_member', permissions: [], enabledModules: ['console'] },
      'console',
      { requiredRoles: ['org_admin'] },
    )
    expect(result.granted).toBe(false)
  })
})

describe('isOrgMember', () => {
  it('returns true for active status', () => {
    expect(isOrgMember({ status: 'active' })).toBe(true)
  })

  it('returns false for inactive', () => {
    expect(isOrgMember({ status: 'suspended' })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isOrgMember(null)).toBe(false)
  })
})

describe('meetsOrgRoleRequirement', () => {
  it('org_admin meets org_viewer', () => {
    expect(meetsOrgRoleRequirement('org_admin', 'org_viewer')).toBe(true)
  })

  it('org_viewer does not meet org_admin', () => {
    expect(meetsOrgRoleRequirement('org_viewer', 'org_admin')).toBe(false)
  })
})

describe('checkPrivilegedAction', () => {
  it('returns null when all checks pass', () => {
    const result = checkPrivilegedAction(makeCtx(), 'manage_users')
    expect(result).toBeNull()
  })

  it('returns denial for missing permission', () => {
    const result = checkPrivilegedAction(makeCtx(), 'delete_org')
    expect(result).toContain('Missing permission')
  })

  it('blocks service accounts by default', () => {
    const result = checkPrivilegedAction(
      makeCtx({ actorId: 'svc:cron-job' }),
      'read',
    )
    expect(result).toContain('Service accounts')
  })

  it('allows service accounts when explicitly permitted', () => {
    const result = checkPrivilegedAction(
      makeCtx({ actorId: 'svc:cron-job' }),
      'read',
      { allowServiceAccounts: true },
    )
    expect(result).toBeNull()
  })
})
