import { describe, it, expect } from 'vitest'
import {
  meetsRoleRequirement,
  type PlatformRole,
} from './role.js'

describe('meetsRoleRequirement', () => {
  it('app_owner meets any role', () => {
    const roles: PlatformRole[] = [
      'platform_admin',
      'org_admin',
      'org_member',
      'org_viewer',
    ]
    for (const r of roles) {
      expect(meetsRoleRequirement('app_owner', r)).toBe(true)
    }
  })

  it('org_viewer does not meet org_admin', () => {
    expect(meetsRoleRequirement('org_viewer', 'org_admin')).toBe(false)
  })

  it('org_admin meets org_member', () => {
    expect(meetsRoleRequirement('org_admin', 'org_member')).toBe(true)
  })

  it('same role meets itself', () => {
    const roles: PlatformRole[] = [
      'app_owner',
      'platform_admin',
      'org_admin',
      'org_member',
      'org_viewer',
      'service_account',
    ]
    for (const r of roles) {
      expect(meetsRoleRequirement(r, r)).toBe(true)
    }
  })

  it('service_account meets org_admin (level 80 >= 70)', () => {
    expect(meetsRoleRequirement('service_account', 'org_admin')).toBe(true)
  })
})
