// ─── @nzila/sage-core — PostgreSQL row mappers ───────────────────────────────
// Pure functions that map snake_case DB rows (migration 0032) to the camelCase
// SAGE TypeScript types. Kept separate from query logic so mapping is unit
// testable in isolation. No SQL and no I/O here.

import type {
  SageAuthorizationLevel,
  SageAuditOutboxEvent,
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
  SageExportPackage,
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
import type {
  SageDeliveryApproval,
  SageDeliveryDecision,
  SageDeliveryGrant,
  SageDeliveryGrantStatus,
  SageDeliveryReceipt,
  SageDeliveryReceiptEventType,
  SageDeliveryRecipient,
  SageDeliveryRecipientVerificationStatus,
  SageDeliveryRequest,
  SageDeliveryRequestStatus,
  SageDeliveryRevocationReasonCode,
} from './delivery-types'

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

/** Serialize a jsonb column back to a canonical JSON string (driver-parsed or raw). */
function toJsonString(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
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
  purpose: string | null
  package_type: string
  requested_scope_json: unknown
  requested_scope_hash: string | null
  policy_version: string | null
  status: SageExportStatus
  created_at: unknown
  updated_at: unknown
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
  approved_scope_hash: string | null
}

export type SageExportPackageRow = {
  id: string
  org_id: string
  workspace_id: string
  export_request_id: string
  status: string
  package_type: string
  manifest_json: unknown
  manifest_hash: string
  content_hash: string
  storage_reference: string
  media_type: string
  size_bytes: unknown
  policy_version: string
  item_count: unknown
  excluded_count: unknown
  generated_by: string
  generated_at: unknown
  created_at: unknown
}

export type SageAuditOutboxRow = {
  id: string
  event_id: string
  org_id: string
  workspace_id: string
  actor_id: string
  action: string
  resource_type: string
  resource_id: string
  safe_payload_json: unknown
  status: string
  attempt_count: unknown
  created_at: unknown
  dispatched_at: unknown
  last_error_code: string | null
  dispatch_owner: string | null
  lease_expires_at: unknown
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
    purpose: textOrNull(row.purpose),
    packageType: (row.package_type as SageExportRequest['packageType']) ?? 'internal_review_bundle',
    requestedScopeJson: row.requested_scope_json == null ? null : toJsonString(row.requested_scope_json),
    requestedScopeHash: textOrNull(row.requested_scope_hash),
    policyVersion: textOrNull(row.policy_version),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: row.updated_at ? toIso(row.updated_at) : null,
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
    approvedScopeHash: textOrNull(row.approved_scope_hash),
  }
}

export function mapExportPackage(row: SageExportPackageRow): SageExportPackage {
  return {
    id: row.id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    exportRequestId: row.export_request_id,
    status: (row.status as SageExportPackage['status']) ?? 'generated',
    packageType: (row.package_type as SageExportPackage['packageType']) ?? 'internal_review_bundle',
    manifestJson: toJsonString(row.manifest_json),
    manifestHash: row.manifest_hash,
    contentHash: row.content_hash,
    storageReference: row.storage_reference,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes ?? 0),
    policyVersion: row.policy_version,
    itemCount: Number(row.item_count ?? 0),
    excludedCount: Number(row.excluded_count ?? 0),
    generatedBy: row.generated_by,
    generatedAt: toIso(row.generated_at),
    createdAt: toIso(row.created_at),
  }
}

export function mapAuditOutbox(row: SageAuditOutboxRow): SageAuditOutboxEvent {
  return {
    id: row.id,
    eventId: row.event_id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    safePayloadJson: toJsonString(row.safe_payload_json),
    status: (row.status as SageAuditOutboxEvent['status']) ?? 'pending',
    attemptCount: Number(row.attempt_count ?? 0),
    createdAt: toIso(row.created_at),
    dispatchedAt: row.dispatched_at ? toIso(row.dispatched_at) : null,
    lastErrorCode: textOrNull(row.last_error_code),
    dispatchOwner: textOrNull(row.dispatch_owner),
    leaseExpiresAt: toIsoOrNull(row.lease_expires_at),
  }
}

// ─── Phase 8A: secure delivery row types + mappers ───────────────────────────

export type SageDeliveryRecipientRow = {
  id: string
  org_id: string
  workspace_id: string
  display_name: string
  identity_provider: string
  identity_subject: string
  normalized_email_hash: string
  verification_status: string
  verified_at: unknown
  created_by: string
  created_at: unknown
  updated_at: unknown
}

export function mapDeliveryRecipient(row: SageDeliveryRecipientRow): SageDeliveryRecipient {
  return {
    id: row.id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    displayName: row.display_name,
    identityProvider: row.identity_provider,
    identitySubject: row.identity_subject,
    normalizedEmailHash: row.normalized_email_hash,
    verificationStatus: (row.verification_status as SageDeliveryRecipientVerificationStatus) ?? 'unverified',
    verifiedAt: toIsoOrNull(row.verified_at),
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

export type SageDeliveryRequestRow = {
  id: string
  org_id: string
  workspace_id: string
  export_package_id: string
  recipient_id: string
  requested_by: string
  purpose: string | null
  status: string
  package_content_hash: string
  package_manifest_hash: string
  recipient_identity_hash: string
  policy_version: string
  requested_access_expires_at: unknown
  requested_max_accesses: unknown
  requested_at: unknown
  updated_at: unknown
}

export function mapDeliveryRequest(row: SageDeliveryRequestRow): SageDeliveryRequest {
  return {
    id: row.id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    exportPackageId: row.export_package_id,
    recipientId: row.recipient_id,
    requestedBy: row.requested_by,
    purpose: textOrNull(row.purpose),
    status: (row.status as SageDeliveryRequestStatus) ?? 'requested',
    packageContentHash: row.package_content_hash,
    packageManifestHash: row.package_manifest_hash,
    recipientIdentityHash: row.recipient_identity_hash,
    policyVersion: row.policy_version,
    requestedAccessExpiresAt: toIso(row.requested_access_expires_at),
    requestedMaxAccesses: Number(row.requested_max_accesses ?? 0),
    requestedAt: toIso(row.requested_at),
    updatedAt: toIso(row.updated_at),
  }
}

export type SageDeliveryApprovalRow = {
  id: string
  org_id: string
  workspace_id: string
  delivery_request_id: string
  decision: string
  approver_id: string
  rationale: string | null
  approved_package_content_hash: string
  approved_manifest_hash: string
  approved_recipient_identity_hash: string
  approved_policy_version: string
  approved_access_expires_at: unknown
  approved_max_accesses: unknown
  decided_at: unknown
}

export function mapDeliveryApproval(row: SageDeliveryApprovalRow): SageDeliveryApproval {
  return {
    id: row.id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    deliveryRequestId: row.delivery_request_id,
    decision: (row.decision as SageDeliveryDecision) ?? 'denied',
    approverId: row.approver_id,
    rationale: textOrNull(row.rationale),
    approvedPackageContentHash: row.approved_package_content_hash,
    approvedManifestHash: row.approved_manifest_hash,
    approvedRecipientIdentityHash: row.approved_recipient_identity_hash,
    approvedPolicyVersion: row.approved_policy_version,
    approvedAccessExpiresAt: toIso(row.approved_access_expires_at),
    approvedMaxAccesses: Number(row.approved_max_accesses ?? 0),
    decidedAt: toIso(row.decided_at),
  }
}

export type SageDeliveryGrantRow = {
  id: string
  org_id: string
  workspace_id: string
  delivery_request_id: string
  export_package_id: string
  recipient_id: string
  status: string
  invitation_token_hash: string
  invitation_expires_at: unknown
  session_token_hash: string | null
  claimed_identity_provider: string | null
  claimed_identity_subject: string | null
  claimed_at: unknown
  access_expires_at: unknown
  max_accesses: unknown
  access_count: unknown
  issued_by: string
  issued_at: unknown
  revoked_by: string | null
  revoked_at: unknown
  revocation_reason_code: string | null
  updated_at: unknown
}

export function mapDeliveryGrant(row: SageDeliveryGrantRow): SageDeliveryGrant {
  return {
    id: row.id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    deliveryRequestId: row.delivery_request_id,
    exportPackageId: row.export_package_id,
    recipientId: row.recipient_id,
    status: (row.status as SageDeliveryGrantStatus) ?? 'issued',
    invitationTokenHash: row.invitation_token_hash,
    invitationExpiresAt: toIso(row.invitation_expires_at),
    sessionTokenHash: textOrNull(row.session_token_hash),
    claimedIdentityProvider: textOrNull(row.claimed_identity_provider),
    claimedIdentitySubject: textOrNull(row.claimed_identity_subject),
    claimedAt: toIsoOrNull(row.claimed_at),
    accessExpiresAt: toIso(row.access_expires_at),
    maxAccesses: Number(row.max_accesses ?? 0),
    accessCount: Number(row.access_count ?? 0),
    issuedBy: row.issued_by,
    issuedAt: toIso(row.issued_at),
    revokedBy: textOrNull(row.revoked_by),
    revokedAt: toIsoOrNull(row.revoked_at),
    revocationReasonCode: (textOrNull(row.revocation_reason_code) as SageDeliveryRevocationReasonCode | null) ?? null,
    updatedAt: toIso(row.updated_at),
  }
}

export type SageDeliveryReceiptRow = {
  id: string
  event_id: string
  org_id: string
  workspace_id: string
  delivery_request_id: string | null
  grant_id: string | null
  package_id: string | null
  recipient_id: string | null
  event_type: string
  safe_reason_code: string | null
  occurred_at: unknown
  created_at: unknown
}

export function mapDeliveryReceipt(row: SageDeliveryReceiptRow): SageDeliveryReceipt {
  return {
    id: row.id,
    eventId: row.event_id,
    orgId: row.org_id,
    workspaceId: row.workspace_id,
    deliveryRequestId: textOrNull(row.delivery_request_id),
    grantId: textOrNull(row.grant_id),
    packageId: textOrNull(row.package_id),
    recipientId: textOrNull(row.recipient_id),
    eventType: row.event_type as SageDeliveryReceiptEventType,
    safeReasonCode: textOrNull(row.safe_reason_code),
    occurredAt: toIso(row.occurred_at),
    createdAt: toIso(row.created_at),
  }
}
