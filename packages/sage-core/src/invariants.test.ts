import { describe, it, expect } from 'vitest'
import {
  SageInvariantError,
  assertWorkspaceHasOrg,
  assertWorkspaceHasInstitutionType,
  assertWorkspaceHasRiskSurface,
  assertWorkspaceHasBoundaryProfile,
  assertWorkspaceUsable,
  assertRoleAssignmentRequiresMembership,
  memberHasEffectivePermissions,
  assertEvidenceLinkRequiresClassifiedSource,
  assertAuthorizedOnlyRequiresExplicitAuthorization,
  assertSensitiveEvidenceRequiresAdditionalReview,
  assertExcludedEvidenceCannotBeExternallyExported,
  assertDecisionRecordHasNamedHumanReviewer,
  assertRequesterCannotApproveOwnExport,
  assertExternalReviewerHasNoExportAuthority,
  assertPlatformAdminDoesNotAutomaticallyReceiveSensitiveEvidenceAccess,
  assertOrgAdminDoesNotAutomaticallyApproveExport,
} from './invariants'
import { deriveSageBoundaryProfile } from './boundary-profile'

const boundaryProfile = deriveSageBoundaryProfile('crown_corporation', 'general_governance')
const usableWorkspace = {
  orgId: 'org_1',
  institutionType: 'crown_corporation' as const,
  riskSurface: 'general_governance' as const,
  boundaryProfile,
}

describe('workspace boundary-lock invariants', () => {
  it('passes for a fully-configured workspace', () => {
    expect(() => assertWorkspaceUsable(usableWorkspace)).not.toThrow()
  })

  it('fails without org_id', () => {
    expect(() => assertWorkspaceHasOrg({ orgId: '' })).toThrow(SageInvariantError)
  })

  it('fails without institution_type', () => {
    expect(() =>
      assertWorkspaceHasInstitutionType({ institutionType: undefined as never }),
    ).toThrow(/institution_type/)
  })

  it('fails without risk_surface', () => {
    expect(() => assertWorkspaceHasRiskSurface({ riskSurface: undefined as never })).toThrow(
      /risk_surface/,
    )
  })

  it('fails without a structured boundary_profile', () => {
    expect(() => assertWorkspaceHasBoundaryProfile({ boundaryProfile: null as never })).toThrow(
      /boundary_profile/,
    )
  })
})

describe('membership vs. role assignment', () => {
  it('rejects a role assignment without membership', () => {
    expect(() => assertRoleAssignmentRequiresMembership({ hasMembership: false })).toThrow(
      /without workspace membership/,
    )
  })

  it('accepts a role assignment with membership', () => {
    expect(() => assertRoleAssignmentRequiresMembership({ hasMembership: true })).not.toThrow()
  })

  it('membership alone grants no effective permissions', () => {
    expect(memberHasEffectivePermissions({ hasMembership: true, activeRoles: [] })).toBe(false)
  })

  it('membership + a role grants effective permissions', () => {
    expect(
      memberHasEffectivePermissions({ hasMembership: true, activeRoles: ['workspace_owner'] }),
    ).toBe(true)
  })
})

describe('evidence lifecycle / authorization invariants', () => {
  it('blocks linking evidence before source classification', () => {
    expect(() =>
      assertEvidenceLinkRequiresClassifiedSource({ sourceClassified: false }),
    ).toThrow(/before source classification/)
  })

  it('blocks authorized-only evidence without explicit authorization', () => {
    expect(() =>
      assertAuthorizedOnlyRequiresExplicitAuthorization({
        level: 'authorized_only',
        hasExplicitAuthorization: false,
      }),
    ).toThrow(/without explicit authorization/)
  })

  it('allows authorized-only evidence with explicit authorization', () => {
    expect(() =>
      assertAuthorizedOnlyRequiresExplicitAuthorization({
        level: 'authorized_only',
        hasExplicitAuthorization: true,
      }),
    ).not.toThrow()
  })

  it('blocks sensitive evidence without additional review', () => {
    expect(() =>
      assertSensitiveEvidenceRequiresAdditionalReview({
        level: 'sensitive',
        hasAdditionalReview: false,
      }),
    ).toThrow(/without additional review/)
  })

  it('blocks excluded evidence from external-review output', () => {
    expect(() =>
      assertExcludedEvidenceCannotBeExternallyExported({
        level: 'excluded',
        excludedFromExternalReview: true,
        inExternalReviewOutput: true,
      }),
    ).toThrow(/external-review output/)
  })

  it('allows non-excluded evidence in external-review output', () => {
    expect(() =>
      assertExcludedEvidenceCannotBeExternallyExported({
        level: 'public',
        excludedFromExternalReview: false,
        inExternalReviewOutput: true,
      }),
    ).not.toThrow()
  })
})

describe('decision record invariant', () => {
  it('requires a named human reviewer', () => {
    expect(() => assertDecisionRecordHasNamedHumanReviewer({ humanReviewerId: null })).toThrow(
      /named human reviewer/,
    )
    expect(() =>
      assertDecisionRecordHasNamedHumanReviewer({ humanReviewerId: 'reviewer_1' }),
    ).not.toThrow()
  })
})

describe('export authority separation', () => {
  it('blocks a requester from approving their own export', () => {
    expect(() =>
      assertRequesterCannotApproveOwnExport({ requestedBy: 'u1', approverId: 'u1' }),
    ).toThrow(/granted by the requester/)
  })

  it('allows a different approver', () => {
    expect(() =>
      assertRequesterCannotApproveOwnExport({ requestedBy: 'u1', approverId: 'u2' }),
    ).not.toThrow()
  })

  it('blocks an external reviewer from having export authority', () => {
    expect(() =>
      assertExternalReviewerHasNoExportAuthority({ approverRole: 'external_reviewer' }),
    ).toThrow(/external reviewer has export authority/)
  })

  it('allows a non-external-reviewer approver role', () => {
    expect(() =>
      assertExternalReviewerHasNoExportAuthority({ approverRole: 'workspace_owner' }),
    ).not.toThrow()
  })
})

describe('admin roles do not auto-escalate', () => {
  it('blocks platform admin auto-access to sensitive evidence', () => {
    expect(() =>
      assertPlatformAdminDoesNotAutomaticallyReceiveSensitiveEvidenceAccess({
        role: 'platform_admin',
        hasExplicitSensitiveAuthorization: false,
        isAccessingSensitiveEvidence: true,
      }),
    ).toThrow(/automatically receives sensitive evidence access/)
  })

  it('allows platform admin with explicit sensitive authorization', () => {
    expect(() =>
      assertPlatformAdminDoesNotAutomaticallyReceiveSensitiveEvidenceAccess({
        role: 'platform_admin',
        hasExplicitSensitiveAuthorization: true,
        isAccessingSensitiveEvidence: true,
      }),
    ).not.toThrow()
  })

  it('blocks org admin auto-approving exports', () => {
    expect(() =>
      assertOrgAdminDoesNotAutomaticallyApproveExport({
        role: 'organization_admin',
        hasExplicitExportApproveAuthority: false,
        isApprovingExport: true,
      }),
    ).toThrow(/automatically receives export approval/)
  })

  it('allows org admin with explicit export-approve authority', () => {
    expect(() =>
      assertOrgAdminDoesNotAutomaticallyApproveExport({
        role: 'organization_admin',
        hasExplicitExportApproveAuthority: true,
        isApprovingExport: true,
      }),
    ).not.toThrow()
  })
})
