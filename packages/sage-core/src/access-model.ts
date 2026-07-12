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
