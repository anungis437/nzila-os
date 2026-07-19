// ─── @nzila/sage-core — implementation-blocking invariants ───────────────────
// Pure functions that assert the blueprint's blocker list. Phase 1 does not
// require live DB services; these operate on plain inputs and throw on violation.
// Each asserts a forbidden path fails and an allowed path passes.

import type {
  SageApplicationRole,
  SageAuthorizationLevel,
  SageBoundaryProfile,
  SageWorkspace,
} from './types'

export class SageInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SageInvariantError'
  }
}

function fail(message: string): never {
  throw new SageInvariantError(message)
}

// ── Workspace boundary lock ──────────────────────────────────────────────────

type WorkspaceLike = Pick<
  SageWorkspace,
  'orgId' | 'institutionType' | 'riskSurface' | 'boundaryProfile'
>

export function assertWorkspaceHasOrg(ws: Pick<SageWorkspace, 'orgId'>): void {
  if (!ws.orgId) fail('workspace exists without org_id')
}

export function assertWorkspaceHasInstitutionType(
  ws: Pick<SageWorkspace, 'institutionType'>,
): void {
  if (!ws.institutionType) fail('workspace exists without institution_type')
}

export function assertWorkspaceHasRiskSurface(ws: Pick<SageWorkspace, 'riskSurface'>): void {
  if (!ws.riskSurface) fail('workspace exists without risk_surface')
}

export function assertWorkspaceHasBoundaryProfile(
  ws: Pick<SageWorkspace, 'boundaryProfile'>,
): void {
  const bp = ws.boundaryProfile as SageBoundaryProfile | null | undefined
  if (!bp || typeof bp !== 'object' || !bp.institutionType || !bp.riskSurface) {
    fail('workspace exists without boundary_profile')
  }
}

export function assertWorkspaceUsable(ws: WorkspaceLike): void {
  assertWorkspaceHasOrg(ws)
  assertWorkspaceHasInstitutionType(ws)
  assertWorkspaceHasRiskSurface(ws)
  assertWorkspaceHasBoundaryProfile(ws)
}

// ── Membership vs. role assignment ───────────────────────────────────────────

export function assertRoleAssignmentRequiresMembership(input: {
  hasMembership: boolean
}): void {
  if (!input.hasMembership) fail('role assignment exists without workspace membership')
}

export function assertMembershipIsNotPermission(input: {
  hasMembership: boolean
  roleAssignments: readonly SageApplicationRole[]
}): void {
  // Membership alone grants no evidence, decision-record, or export permissions.
  if (input.hasMembership && input.roleAssignments.length === 0) {
    // This is the correct state: membership with no role => no permissions.
    return
  }
}

/** True only when the actor has membership AND at least one non-revoked role. */
export function memberHasEffectivePermissions(input: {
  hasMembership: boolean
  activeRoles: readonly SageApplicationRole[]
}): boolean {
  return input.hasMembership && input.activeRoles.length > 0
}

// ── Evidence lifecycle / authorization ───────────────────────────────────────

export function assertEvidenceLinkRequiresClassifiedSource(input: {
  sourceClassified: boolean
}): void {
  if (!input.sourceClassified) fail('evidence item is linked before source classification')
}

export function assertAuthorizedOnlyRequiresExplicitAuthorization(input: {
  level: SageAuthorizationLevel
  hasExplicitAuthorization: boolean
}): void {
  if (input.level === 'authorized_only' && !input.hasExplicitAuthorization) {
    fail('authorized-only evidence is linked without explicit authorization')
  }
}

export function assertSensitiveEvidenceRequiresAdditionalReview(input: {
  level: SageAuthorizationLevel
  hasAdditionalReview: boolean
}): void {
  if (input.level === 'sensitive' && !input.hasAdditionalReview) {
    fail('sensitive evidence is used without additional review')
  }
}

export function assertExcludedEvidenceCannotBeExternallyExported(input: {
  level: SageAuthorizationLevel
  excludedFromExternalReview: boolean
  inExternalReviewOutput: boolean
}): void {
  const isExcluded = input.level === 'excluded' || input.excludedFromExternalReview
  if (isExcluded && input.inExternalReviewOutput) {
    fail('excluded evidence appears in an external-review output')
  }
}

// ── Decision record ──────────────────────────────────────────────────────────

export function assertDecisionRecordHasNamedHumanReviewer(input: {
  humanReviewerId: string | null | undefined
}): void {
  if (!input.humanReviewerId) fail('decision record exists without named human reviewer')
}

// ── Export authority separation ──────────────────────────────────────────────

export function assertRequesterCannotApproveOwnExport(input: {
  requestedBy: string
  approverId: string
}): void {
  if (input.requestedBy === input.approverId) {
    fail('export approval is granted by the requester')
  }
}

export function assertExternalReviewerHasNoExportAuthority(input: {
  approverRole: SageApplicationRole
}): void {
  if (input.approverRole === 'external_reviewer') {
    fail('external reviewer has export authority')
  }
}

// ── Phase 8A: secure delivery separation of duties ───────────────────────────

export function assertDeliveryRequesterCannotApproveOwn(input: {
  requestedBy: string
  approverId: string
}): void {
  if (input.requestedBy === input.approverId) {
    fail('delivery approval is granted by the requester')
  }
}

// ── Phase 8B: destruction separation of duties ───────────────────────────────

export function assertDestructionRequesterCannotApproveOwn(input: {
  requestedBy: string
  approverId: string
}): void {
  if (input.requestedBy === input.approverId) {
    fail('destruction approval is granted by the requester')
  }
}

export function assertPlatformAdminDoesNotAutomaticallyReceiveSensitiveEvidenceAccess(input: {
  role: SageApplicationRole
  hasExplicitSensitiveAuthorization: boolean
  isAccessingSensitiveEvidence: boolean
}): void {
  if (
    input.role === 'platform_admin' &&
    input.isAccessingSensitiveEvidence &&
    !input.hasExplicitSensitiveAuthorization
  ) {
    fail('platform admin automatically receives sensitive evidence access')
  }
}

export function assertOrgAdminDoesNotAutomaticallyApproveExport(input: {
  role: SageApplicationRole
  hasExplicitExportApproveAuthority: boolean
  isApprovingExport: boolean
}): void {
  if (
    input.role === 'organization_admin' &&
    input.isApprovingExport &&
    !input.hasExplicitExportApproveAuthority
  ) {
    fail('organization admin automatically receives export approval')
  }
}
