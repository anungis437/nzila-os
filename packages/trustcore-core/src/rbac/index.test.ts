import { describe, it, expect } from 'vitest'
import {
  TRUSTCORE_PERMISSIONS,
  TRUSTCORE_ROLES,
  getPermissionsForRole,
  hasPermission,
} from './index'

describe('TRUSTCORE_PERMISSIONS', () => {
  it('contains the expected permission keys', () => {
    expect(TRUSTCORE_PERMISSIONS).toContain('view_dashboard')
    expect(TRUSTCORE_PERMISSIONS).toContain('write_risks')
    expect(TRUSTCORE_PERMISSIONS).toContain('manage_billing')
    expect(TRUSTCORE_PERMISSIONS).toContain('manage_leads')
  })
})

describe('TRUSTCORE_ROLES', () => {
  it('includes all expected TrustCore roles', () => {
    const expected = [
      'platform_admin',
      'org_admin',
      'privacy_officer',
      'security_officer',
      'compliance_officer',
      'legal_reviewer',
      'auditor',
      'external_auditor',
      'org_member',
      'read_only',
    ]
    for (const r of expected) {
      expect(TRUSTCORE_ROLES).toContain(r)
    }
  })
})

describe('getPermissionsForRole', () => {
  it('platform_admin has all permissions', () => {
    const perms = getPermissionsForRole('platform_admin')
    for (const p of TRUSTCORE_PERMISSIONS) {
      expect(perms).toContain(p)
    }
  })

  it('read_only has only view_dashboard and view_compliance', () => {
    const perms = getPermissionsForRole('read_only')
    expect(perms).toContain('view_dashboard')
    expect(perms).toContain('view_compliance')
    expect(perms).not.toContain('write_risks')
    expect(perms).not.toContain('manage_billing')
  })

  it('external_auditor has limited read permissions', () => {
    const perms = getPermissionsForRole('external_auditor')
    expect(perms).toContain('view_compliance')
    expect(perms).toContain('read_risks')
    expect(perms).not.toContain('write_risks')
    expect(perms).not.toContain('manage_billing')
    expect(perms).not.toContain('manage_leads')
  })

  it('auditor has view_audit_trail but not write permissions', () => {
    const perms = getPermissionsForRole('auditor')
    expect(perms).toContain('view_audit_trail')
    expect(perms).toContain('export_evidence')
    expect(perms).not.toContain('write_pias')
    expect(perms).not.toContain('write_risks')
  })

  it('privacy_officer can manage privacy program and export', () => {
    const perms = getPermissionsForRole('privacy_officer')
    expect(perms).toContain('manage_privacy_program')
    expect(perms).toContain('approve_pias')
    expect(perms).toContain('export_evidence')
    expect(perms).not.toContain('manage_billing')
    expect(perms).not.toContain('manage_leads')
  })

  it('org_admin can manage billing', () => {
    const perms = getPermissionsForRole('org_admin')
    expect(perms).toContain('manage_billing')
    expect(perms).not.toContain('manage_leads')
  })

  it('returns empty array for unrecognised role', () => {
    const perms = getPermissionsForRole('unknown_role')
    expect(perms).toHaveLength(0)
  })
})

describe('hasPermission', () => {
  it('returns true when role has the permission', () => {
    expect(hasPermission('org_admin', 'manage_billing')).toBe(true)
    expect(hasPermission('privacy_officer', 'write_pias')).toBe(true)
    expect(hasPermission('platform_admin', 'manage_leads')).toBe(true)
  })

  it('returns false when role lacks the permission', () => {
    expect(hasPermission('read_only', 'write_risks')).toBe(false)
    expect(hasPermission('external_auditor', 'manage_billing')).toBe(false)
    expect(hasPermission('legal_reviewer', 'write_pias')).toBe(false)
  })

  it('returns false for unrecognised role', () => {
    expect(hasPermission('hacker', 'view_dashboard')).toBe(false)
  })

  it('compliance_officer can write risks but not manage billing', () => {
    expect(hasPermission('compliance_officer', 'write_risks')).toBe(true)
    expect(hasPermission('compliance_officer', 'manage_billing')).toBe(false)
  })

  it('security_officer can write incidents but not approve PIAs', () => {
    expect(hasPermission('security_officer', 'write_incidents')).toBe(true)
    expect(hasPermission('security_officer', 'approve_pias')).toBe(false)
  })
})
