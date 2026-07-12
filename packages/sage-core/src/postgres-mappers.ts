// ─── @nzila/sage-core — PostgreSQL row mappers ───────────────────────────────
// Pure functions that map snake_case DB rows (migration 0032) to the camelCase
// SAGE TypeScript types. Kept separate from query logic so mapping is unit
// testable in isolation. No SQL and no I/O here.

import type {
  SageAuthorizationLevel,
  SageBoundaryFlag,
  SageBoundaryFlagType,
  SageBoundaryProfile,
  SageConfidenceLevel,
  SageDecisionRecord,
  SageEvidenceAuthorization,
  SageEvidenceItem,
  SageEvidenceLifecycleState,
  SageEvidenceSource,
  SageExportApproval,
  SageExportAuthorityLevel,
  SageExportRequest,
  SageExportStatus,
  SageInstitutionType,
  SageReviewNote,
  SageRiskSurface,
  SageRoleAssignment,
  SageApplicationRole,
  SageSourceQuality,
  SageSourceType,
  SageWorkspace,
  SageWorkspaceMember,
  SageWorkspaceStatus,
} from './types'

// ─── Timestamp normalization ─────────────────────────────────────────────────
// timestamptz columns arrive as Date (node-postgres default) or ISO string.
// The SAGE types use ISO strings, so normalize consistently.

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  throw new Error('sage-core: expected a timestamp value')
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return toIso(value)
}

function textOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

/**
 * Parse a jsonb array-of-ids column. node-postgres returns jsonb already parsed
 * (array); guard against a raw JSON string in case a driver returns text.
 */
function toIdArray(value: unknown): string[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter((v): v is string => typeof v === 'string')
}

// boundary_profile is a jsonb column; node-postgres returns it already parsed.
// Guard against a string in case a driver returns raw text.
function toBoundaryProfile(value: unknown): SageBoundaryProfile {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  return parsed as SageBoundaryProfile
}

// ─── Row shapes (snake_case, mirroring migration 0032) ───────────────────────

export type SageWorkspaceRow = {
  id: string
  org_id: string
  name: string
  status: SageWorkspaceStatus
  institution_type: SageInstitutionType
  risk_surface: SageRiskSurface
  boundary_profile: unknown
  created_by: string
  updated_by: string | null
  created_at: unknown
  updated_at: unknown
}

export type SageWorkspaceMemberRow = {
  id: string
  workspace_id: string
  org_id: string
  actor_id: string
  created_by: string
  created_at: unknown
}

export type SageRoleAssignmentRow = {
  id: string
  workspace_id: string
  org_id: string
  actor_id: string
  sage_application_role: SageApplicationRole
  workspace_scope: string | null
  time_bound_access_expires_at: unknown
  access_reason: string | null
  approved_by: string | null
  created_at: unknown
  revoked_at: unknown
}

export type SageEvidenceAuthorizationRow = {
  id: string
  workspace_id: string
  org_id: string
  actor_id: string
  evidence_authorization_level: SageAuthorizationLevel
  access_reason: string | null
  approved_by: string | null
  created_at: unknown
  revoked_at: unknown
}

export type SageEvidenceSourceRow = {
  id: string
  workspace_id: string
  org_id: string
  source_type: SageSourceType
  source_quality: SageSourceQuality | null
  authorization_level: SageAuthorizationLevel
  contains_personal_information: boolean
  contains_sensitive_information: boolean
  created_by: string
  created_at: unknown
}

export type SageEvidenceItemRow = {
  id: string
  source_id: string
  workspace_id: string
  org_id: string
  lifecycle_state: SageEvidenceLifecycleState
  confidence_level: SageConfidenceLevel | null
  excluded_from_external_review: boolean
  human_review_required: boolean
  created_by: string
  updated_by: string | null
  created_at: unknown
  updated_at: unknown
}

export type SageBoundaryFlagRow = {
  id: string
  workspace_id: string
  org_id: string
  target_type: string | null
  target_id: string | null
  flag_type: SageBoundaryFlagType
  note: string | null
  status: string
  authorization_level: string | null
  authorization_basis: string | null
  resolved_at: unknown
  resolved_by: string | null
  resolution_note: string | null
  created_by: string
  created_at: unknown
  updated_at: unknown
}

export type SageReviewNoteRow = {
  id: string
  workspace_id: string
  org_id: string
  target_type: string | null
  target_id: string | null
  reviewer_id: string
  note_type: string | null
  note: string
  authorization_level: string | null
  authorization_basis: string | null
  created_at: unknown
}

export type SageDecisionRecordRow = {
  id: string
  workspace_id: string
  org_id: string
  decision: string
  rationale: string | null
  uncertainty: string | null
  human_reviewer_id: string
  referenced_evidence_item_ids: unknown
  referenced_boundary_flag_ids: unknown
  authorization_level: string | null
  authorization_basis: string | null
  excluded_from_external_review: unknown
  created_by: string
  created_at: unknown
}

export type SageExportRequestRow = {
  id: string
  workspace_id: string
  org_id: string
  requested_by: string
  scope: string | null
  status: SageExportStatus
  created_at: unknown
}

export type SageExportApprovalRow = {
  id: string
  export_request_id: string
  org_id: string
  export_authority_level: SageExportAuthorityLevel
  approver_id: string
  decision: string
  decision_at: unknown
  reason: string | null
}

// ─── Row → domain mappers ────────────────────────────────────────────────────

export function mapWorkspace(row: SageWorkspaceRow): SageWorkspace {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    status: row.status,
    institutionType: row.institution_type,
    riskSurface: row.risk_surface,
    boundaryProfile: toBoundaryProfile(row.boundary_profile),
    createdBy: row.created_by,
    updatedBy: textOrNull(row.updated_by),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

export function mapWorkspaceMember(row: SageWorkspaceMemberRow): SageWorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    actorId: row.actor_id,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  }
}

export function mapRoleAssignment(row: SageRoleAssignmentRow): SageRoleAssignment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    actorId: row.actor_id,
    sageApplicationRole: row.sage_application_role,
    workspaceScope: textOrNull(row.workspace_scope),
    timeBoundAccessExpiresAt: toIsoOrNull(row.time_bound_access_expires_at),
    accessReason: textOrNull(row.access_reason),
    approvedBy: textOrNull(row.approved_by),
    createdAt: toIso(row.created_at),
    revokedAt: toIsoOrNull(row.revoked_at),
  }
}

export function mapEvidenceAuthorization(
  row: SageEvidenceAuthorizationRow,
): SageEvidenceAuthorization {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    actorId: row.actor_id,
    evidenceAuthorizationLevel: row.evidence_authorization_level,
    accessReason: textOrNull(row.access_reason),
    approvedBy: textOrNull(row.approved_by),
    createdAt: toIso(row.created_at),
    revokedAt: toIsoOrNull(row.revoked_at),
  }
}

export function mapEvidenceSource(row: SageEvidenceSourceRow): SageEvidenceSource {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    sourceType: row.source_type,
    sourceQuality: row.source_quality ?? null,
    authorizationLevel: row.authorization_level,
    containsPersonalInformation: row.contains_personal_information,
    containsSensitiveInformation: row.contains_sensitive_information,
    classified: row.source_quality !== null && row.source_quality !== undefined,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  }
}

export function mapEvidenceItem(row: SageEvidenceItemRow): SageEvidenceItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    lifecycleState: row.lifecycle_state,
    confidenceLevel: row.confidence_level ?? null,
    excludedFromExternalReview: row.excluded_from_external_review,
    humanReviewRequired: row.human_review_required,
    createdBy: row.created_by,
    updatedBy: textOrNull(row.updated_by),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

export function mapBoundaryFlag(row: SageBoundaryFlagRow): SageBoundaryFlag {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    targetType: (textOrNull(row.target_type) as SageBoundaryFlag['targetType']) ?? null,
    targetId: textOrNull(row.target_id),
    flagType: row.flag_type,
    note: textOrNull(row.note),
    status: (row.status as SageBoundaryFlag['status']) ?? 'open',
    authorizationLevel: (textOrNull(row.authorization_level) as SageBoundaryFlag['authorizationLevel']) ?? 'internal',
    authorizationBasis: (textOrNull(row.authorization_basis) as SageBoundaryFlag['authorizationBasis']) ?? null,
    resolvedAt: row.resolved_at ? toIso(row.resolved_at) : null,
    resolvedBy: textOrNull(row.resolved_by),
    resolutionNote: textOrNull(row.resolution_note),
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at ?? row.created_at),
  }
}

export function mapReviewNote(row: SageReviewNoteRow): SageReviewNote {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    targetType: (textOrNull(row.target_type) as SageReviewNote['targetType']) ?? null,
    targetId: textOrNull(row.target_id),
    reviewerId: row.reviewer_id,
    noteType: (textOrNull(row.note_type) as SageReviewNote['noteType']) ?? 'observation',
    note: row.note,
    authorizationLevel: (textOrNull(row.authorization_level) as SageReviewNote['authorizationLevel']) ?? 'internal',
    authorizationBasis: (textOrNull(row.authorization_basis) as SageReviewNote['authorizationBasis']) ?? null,
    createdAt: toIso(row.created_at),
  }
}

export function mapDecisionRecord(row: SageDecisionRecordRow): SageDecisionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    decision: row.decision,
    rationale: textOrNull(row.rationale),
    uncertainty: textOrNull(row.uncertainty),
    humanReviewerId: row.human_reviewer_id,
    referencedEvidenceItemIds: toIdArray(row.referenced_evidence_item_ids),
    referencedBoundaryFlagIds: toIdArray(row.referenced_boundary_flag_ids),
    authorizationLevel: (textOrNull(row.authorization_level) as SageDecisionRecord['authorizationLevel']) ?? 'internal',
    authorizationBasis: (textOrNull(row.authorization_basis) as SageDecisionRecord['authorizationBasis']) ?? null,
    excludedFromExternalReview: Boolean(row.excluded_from_external_review),
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  }
}

export function mapExportRequest(row: SageExportRequestRow): SageExportRequest {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    orgId: row.org_id,
    requestedBy: row.requested_by,
    scope: textOrNull(row.scope),
    status: row.status,
    createdAt: toIso(row.created_at),
  }
}

export function mapExportApproval(row: SageExportApprovalRow): SageExportApproval {
  return {
    id: row.id,
    exportRequestId: row.export_request_id,
    orgId: row.org_id,
    exportAuthorityLevel: row.export_authority_level,
    approverId: row.approver_id,
    decision: row.decision,
    decisionAt: toIso(row.decision_at),
    reason: textOrNull(row.reason),
  }
}
