// ─── @nzila/sage-core — access model ─────────────────────────────────────────
// Pure authorization resolution for SAGE. Permissions resolve through role
// assignments (not membership), evidence authorization is separate from role,
// and export authority is separate from workspace administration.
// External reviewer is disabled/export-blocked by default.

import type {
  SageApplicationRole,
  SageAuthorizationLevel,
  SageExportAuthorityLevel,
} from './types'
import { SAGE_AUTHORIZATION_LEVELS } from './types'
import { SAGE_PERMISSIONS, type SagePermission } from './permissions'

// Role → permission grants (the enforceable application layer).
const ROLE_PERMISSIONS: Record<SageApplicationRole, readonly SagePermission[]> = {
  platform_admin: [
    SAGE_PERMISSIONS.WORKSPACE_CREATE,
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.WORKSPACE_ADMIN,
    SAGE_PERMISSIONS.MEMBER_MANAGE,
    SAGE_PERMISSIONS.ROLE_ASSIGN,
    SAGE_PERMISSIONS.ROLE_REVOKE,
  ],
  organization_admin: [
    SAGE_PERMISSIONS.WORKSPACE_CREATE,
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.MEMBER_MANAGE,
    SAGE_PERMISSIONS.ROLE_ASSIGN,
    SAGE_PERMISSIONS.ROLE_REVOKE,
  ],
  workspace_owner: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EVIDENCE_CREATE,
    SAGE_PERMISSIONS.EVIDENCE_LINK,
    SAGE_PERMISSIONS.EXPORT_REQUEST,
  ],
  evidence_steward: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EVIDENCE_CREATE,
    SAGE_PERMISSIONS.EVIDENCE_CLASSIFY,
    SAGE_PERMISSIONS.EVIDENCE_AUTHORIZATION_GRANT,
    SAGE_PERMISSIONS.EVIDENCE_AUTHORIZATION_REVOKE,
  ],
  evidence_contributor: [SAGE_PERMISSIONS.WORKSPACE_READ, SAGE_PERMISSIONS.EVIDENCE_CREATE],
  internal_reviewer: [SAGE_PERMISSIONS.WORKSPACE_READ, SAGE_PERMISSIONS.REVIEW_NOTE],
  decision_record_approver: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.REVIEW_NOTE,
    SAGE_PERMISSIONS.DECISION_RECORD,
  ],
  privacy_records_reviewer: [SAGE_PERMISSIONS.WORKSPACE_READ, SAGE_PERMISSIONS.BOUNDARY_FLAG],
  security_reviewer: [SAGE_PERMISSIONS.WORKSPACE_READ, SAGE_PERMISSIONS.BOUNDARY_FLAG],
  accessibility_language_reviewer: [SAGE_PERMISSIONS.WORKSPACE_READ, SAGE_PERMISSIONS.REVIEW_NOTE],
  read_only_observer: [SAGE_PERMISSIONS.WORKSPACE_READ],
  external_reviewer: [], // disabled by default; no permissions without explicit, scoped grant
  // Independent export authority: an export_approver may review/approve or deny
  // another user's export request and generate the immutable package. It is a
  // dedicated SAGE role — generic platform/org administration never confers it.
  export_approver: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EXPORT_APPROVE,
    SAGE_PERMISSIONS.EXPORT_PACKAGE_GENERATE,
    // May request secure external delivery of a generated package (never approve
    // its own request — enforced per-instance, not by role).
    SAGE_PERMISSIONS.EXPORT_DELIVERY_REQUEST,
    SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  ],
  // Independent delivery authority: approves/denies the exact package↔recipient
  // pairing and may revoke an issued grant. Separate from package generation and
  // from generic administration; never confers evidence or export authority.
  export_delivery_approver: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EXPORT_DELIVERY_APPROVE,
    SAGE_PERMISSIONS.EXPORT_DELIVERY_REVOKE,
    SAGE_PERMISSIONS.EXPORT_DELIVERY_READ,
  ],
  // Phase 8B — records lifecycle. Each authority is deliberately isolated:
  // records management (retention + destruction request) is separate from
  // legal-hold authority, from destruction approval, and from execution.
  // A records_manager may request destruction but can never approve it.
  records_manager: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EXPORT_RETENTION_ASSIGN,
    SAGE_PERMISSIONS.EXPORT_DESTRUCTION_REQUEST,
    SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  ],
  legal_hold_manager: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EXPORT_LEGAL_HOLD_MANAGE,
    SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  ],
  destruction_approver: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EXPORT_DESTRUCTION_APPROVE,
    SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  ],
  destruction_executor: [
    SAGE_PERMISSIONS.WORKSPACE_READ,
    SAGE_PERMISSIONS.EXPORT_DESTRUCTION_EXECUTE,
    SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  ],
}

export type SageAccessContext = {
  hasMembership: boolean
  /** Non-revoked role assignments for the actor in this workspace. */
  activeRoles: readonly SageApplicationRole[]
  /** Non-revoked evidence authorization levels granted to the actor. */
  evidenceAuthorizations: readonly SageAuthorizationLevel[]
  /** Explicit export-authority level; defaults to 'none'. */
  exportAuthority?: SageExportAuthorityLevel
}

/**
 * Resolve whether an actor has a permission. Permissions resolve through role
 * assignments only — membership alone yields no permission.
 */
export function resolveSagePermission(ctx: SageAccessContext, permission: SagePermission): boolean {
  if (!ctx.hasMembership) return false
  for (const role of ctx.activeRoles) {
    if (ROLE_PERMISSIONS[role].includes(permission)) return true
  }
  return false
}

export function rolePermissions(role: SageApplicationRole): readonly SagePermission[] {
  return ROLE_PERMISSIONS[role]
}

/** Whether an actor may access evidence at a given authorization level. */
export function canAccessEvidenceLevel(
  ctx: SageAccessContext,
  level: SageAuthorizationLevel,
): boolean {
  if (!ctx.hasMembership) return false
  if (level === 'public' || level === 'administrative' || level === 'internal') {
    // Still requires membership; broader classes do not need per-level grants.
    return true
  }
  // authorized_only / sensitive / excluded require an explicit grant at that level.
  return ctx.evidenceAuthorizations.includes(level)
}

/** Whether an actor may approve an export. External reviewers never can. */
export function canApproveExport(
  ctx: SageAccessContext,
  approverRole: SageApplicationRole,
): boolean {
  if (approverRole === 'external_reviewer') return false
  const authority = ctx.exportAuthority ?? 'none'
  return authority === 'approve'
}

/** External reviewer default posture: enabled only when explicitly granted a scoped role. */
export function isExternalReviewerEnabled(ctx: SageAccessContext): boolean {
  return ctx.hasMembership && ctx.activeRoles.includes('external_reviewer')
}

// ─── Authorization ladder (restrictiveness ordering) ─────────────────────────
// SAGE_AUTHORIZATION_LEVELS is authored least→most restrictive, so the array
// index is the restrictiveness rank:
//   public(0) < administrative(1) < internal(2) < authorized_only(3)
//   < sensitive(4) < excluded(5)

/** The lowest non-public floor governance records default to. */
export const SAGE_GOVERNANCE_AUTHORIZATION_FLOOR: SageAuthorizationLevel = 'internal'

/** Restrictiveness rank of an authorization level (higher = more restrictive). */
export function authorizationLevelRank(level: SageAuthorizationLevel): number {
  const rank = SAGE_AUTHORIZATION_LEVELS.indexOf(level)
  return rank < 0 ? SAGE_AUTHORIZATION_LEVELS.indexOf('internal') : rank
}

/** Return the MORE restrictive of two authorization levels. */
export function mostRestrictiveAuthorization(
  a: SageAuthorizationLevel,
  b: SageAuthorizationLevel,
): SageAuthorizationLevel {
  return authorizationLevelRank(a) >= authorizationLevelRank(b) ? a : b
}

/** True when `candidate` is strictly less restrictive than `floor` (a downgrade). */
export function isAuthorizationDowngrade(
  candidate: SageAuthorizationLevel,
  floor: SageAuthorizationLevel,
): boolean {
  return authorizationLevelRank(candidate) < authorizationLevelRank(floor)
}
