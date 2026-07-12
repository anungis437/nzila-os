import { describe, it, expect } from 'vitest'
import {
  resolveSagePermission,
  canAccessEvidenceLevel,
  canApproveExport,
  isExternalReviewerEnabled,
  rolePermissions,
  type SageAccessContext,
} from './access-model.js'
import { SAGE_PERMISSIONS } from './permissions.js'

function ctx(partial: Partial<SageAccessContext>): SageAccessContext {
  return {
    hasMembership: true,
    activeRoles: [],
    evidenceAuthorizations: [],
    exportAuthority: 'none',
    ...partial,
  }
}

describe('membership vs. permission', () => {
  it('grants no permission from membership alone', () => {
    const c = ctx({ hasMembership: true, activeRoles: [] })
    expect(resolveSagePermission(c, SAGE_PERMISSIONS.EVIDENCE_CREATE)).toBe(false)
    expect(resolveSagePermission(c, SAGE_PERMISSIONS.WORKSPACE_READ)).toBe(false)
  })

  it('grants permission only through an assigned role', () => {
    const c = ctx({ activeRoles: ['evidence_contributor'] })
    expect(resolveSagePermission(c, SAGE_PERMISSIONS.EVIDENCE_CREATE)).toBe(true)
    expect(resolveSagePermission(c, SAGE_PERMISSIONS.DECISION_RECORD)).toBe(false)
  })

  it('denies all permissions without membership even if a role is present', () => {
    const c = ctx({ hasMembership: false, activeRoles: ['workspace_owner'] })
    expect(resolveSagePermission(c, SAGE_PERMISSIONS.WORKSPACE_READ)).toBe(false)
  })
})

describe('external reviewer default posture', () => {
  it('has no permissions by default', () => {
    expect(rolePermissions('external_reviewer')).toEqual([])
  })

  it('is disabled unless an explicit scoped role is assigned', () => {
    expect(isExternalReviewerEnabled(ctx({ activeRoles: [] }))).toBe(false)
    expect(isExternalReviewerEnabled(ctx({ activeRoles: ['external_reviewer'] }))).toBe(true)
  })

  it('can never approve an export', () => {
    const c = ctx({ exportAuthority: 'approve', activeRoles: ['external_reviewer'] })
    expect(canApproveExport(c, 'external_reviewer')).toBe(false)
  })
})

describe('export authority separation', () => {
  it('requires explicit approve authority to approve exports', () => {
    expect(canApproveExport(ctx({ exportAuthority: 'none' }), 'workspace_owner')).toBe(false)
    expect(canApproveExport(ctx({ exportAuthority: 'request' }), 'workspace_owner')).toBe(false)
    expect(canApproveExport(ctx({ exportAuthority: 'approve' }), 'workspace_owner')).toBe(true)
  })

  it('platform admin does not automatically approve exports (no export authority by default)', () => {
    const c = ctx({ activeRoles: ['platform_admin'], exportAuthority: 'none' })
    expect(canApproveExport(c, 'platform_admin')).toBe(false)
  })

  it('organization admin does not automatically approve exports', () => {
    const c = ctx({ activeRoles: ['organization_admin'], exportAuthority: 'none' })
    expect(canApproveExport(c, 'organization_admin')).toBe(false)
  })
})

describe('evidence authorization separation', () => {
  it('allows public/administrative/internal with membership', () => {
    const c = ctx({ evidenceAuthorizations: [] })
    expect(canAccessEvidenceLevel(c, 'public')).toBe(true)
    expect(canAccessEvidenceLevel(c, 'internal')).toBe(true)
  })

  it('blocks sensitive/authorized_only/excluded without an explicit grant', () => {
    const c = ctx({ evidenceAuthorizations: [] })
    expect(canAccessEvidenceLevel(c, 'authorized_only')).toBe(false)
    expect(canAccessEvidenceLevel(c, 'sensitive')).toBe(false)
    expect(canAccessEvidenceLevel(c, 'excluded')).toBe(false)
  })

  it('platform admin does not automatically get sensitive evidence access', () => {
    const c = ctx({ activeRoles: ['platform_admin'], evidenceAuthorizations: [] })
    expect(canAccessEvidenceLevel(c, 'sensitive')).toBe(false)
  })

  it('allows a level only when explicitly granted', () => {
    const c = ctx({ evidenceAuthorizations: ['sensitive'] })
    expect(canAccessEvidenceLevel(c, 'sensitive')).toBe(true)
  })
})
