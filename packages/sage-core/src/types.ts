// ─── @nzila/sage-core — types ────────────────────────────────────────────────
// Repo-native domain types for SAGE (Service Assurance & Governance Evidence).
// Mirrors the migration 0032_sage_phase_1_access_domain_lock.sql enums and tables.
// Boundaries: no automated decisions, no scoring/ranking, no certification,
// no public availability/procurement claim. Human review required; export gated.

export const SAGE_INSTITUTION_TYPES = [
  'department_ministry',
  'crown_corporation',
  'regulator',
  'tribunal_ombuds_accountability',
  'public_broadcaster_cultural',
  'health_public_health',
  'education',
  'elections_democratic',
  'police_enforcement_corrections',
  'indigenous_government_or_service',
  'other_public_institution',
] as const
export type SageInstitutionType = (typeof SAGE_INSTITUTION_TYPES)[number]

export const SAGE_RISK_SURFACES = [
  'general_governance',
  'implementation_continuity',
  'regulatory_boundary',
  'tribunal_ombuds_boundary',
  'public_broadcaster_boundary',
  'health_phi_deferred',
  'student_records_boundary',
  'elections_security_boundary',
  'enforcement_corrections_boundary',
  'indigenous_protocol_boundary',
] as const
export type SageRiskSurface = (typeof SAGE_RISK_SURFACES)[number]

export const SAGE_WORKSPACE_STATUSES = ['draft', 'active', 'locked', 'archived'] as const
export type SageWorkspaceStatus = (typeof SAGE_WORKSPACE_STATUSES)[number]

export const SAGE_APPLICATION_ROLES = [
  'platform_admin',
  'organization_admin',
  'workspace_owner',
  'evidence_steward',
  'evidence_contributor',
  'internal_reviewer',
  'decision_record_approver',
  'privacy_records_reviewer',
  'security_reviewer',
  'accessibility_language_reviewer',
  'read_only_observer',
  'external_reviewer',
  'export_approver',
  'export_delivery_approver',
] as const
export type SageApplicationRole = (typeof SAGE_APPLICATION_ROLES)[number]

export const SAGE_AUTHORIZATION_LEVELS = [
  'public',
  'administrative',
  'internal',
  'authorized_only',
  'sensitive',
  'excluded',
] as const
export type SageAuthorizationLevel = (typeof SAGE_AUTHORIZATION_LEVELS)[number]

export const SAGE_EXPORT_AUTHORITY_LEVELS = [
  'none',
  'request',
  'review',
  'approve',
  'deny',
  'platform_emergency_hold',
] as const
export type SageExportAuthorityLevel = (typeof SAGE_EXPORT_AUTHORITY_LEVELS)[number]

export const SAGE_EXPORT_STATUSES = ['requested', 'approved', 'denied', 'cancelled'] as const
export type SageExportStatus = (typeof SAGE_EXPORT_STATUSES)[number]

// ─── Phase 7 — controlled export packages ────────────────────────────────────

/** The kinds of internal package a controlled export may produce. */
export const SAGE_EXPORT_PACKAGE_TYPES = ['internal_review_bundle'] as const
export type SageExportPackageType = (typeof SAGE_EXPORT_PACKAGE_TYPES)[number]

/** A generated package is immutable and terminal in a single state. */
export const SAGE_EXPORT_PACKAGE_STATUSES = ['generated'] as const
export type SageExportPackageStatus = (typeof SAGE_EXPORT_PACKAGE_STATUSES)[number]

/** Resource kinds that may be requested into an export scope. */
export const SAGE_EXPORT_RESOURCE_TYPES = [
  'evidence_item',
  'boundary_flag',
  'review_note',
  'decision_record',
] as const
export type SageExportResourceType = (typeof SAGE_EXPORT_RESOURCE_TYPES)[number]

/** Safe, narrative-free exclusion reason codes for manifest provenance. */
export const SAGE_EXPORT_EXCLUSION_REASONS = [
  'excluded_from_external_review',
  'not_accessible',
  'unresolved',
] as const
export type SageExportExclusionReason = (typeof SAGE_EXPORT_EXCLUSION_REASONS)[number]

/** A single canonical, deterministically ordered entry in an export scope. */
export type SageExportScopeItem = {
  resourceType: SageExportResourceType
  resourceId: string
  contentHash: string
  authorizationLevel: SageAuthorizationLevel
  excludedFromExternalReview: boolean
  included: boolean
  exclusionReason?: SageExportExclusionReason | null
  order: number
}

/** The canonical, hashable representation of an export request's scope. */
export type SageExportScope = {
  policyVersion: string
  packageType: SageExportPackageType
  items: SageExportScopeItem[]
}

export const SAGE_EXPORT_STATUSES_TERMINAL = ['approved', 'denied', 'cancelled'] as const


export const SAGE_EVIDENCE_LIFECYCLE_STATES = [
  'proposed',
  'registered',
  'classified',
  'linked',
  'reviewed',
  'accepted',
  'needs_review',
  'excluded',
  'archived',
] as const
export type SageEvidenceLifecycleState = (typeof SAGE_EVIDENCE_LIFECYCLE_STATES)[number]

// ─── Boundary profile ────────────────────────────────────────────────────────
// Structured, not free text. Derived from institution type + risk surface.

export type SageBoundaryProfile = {
  institutionType: SageInstitutionType
  riskSurface: SageRiskSurface
  excludedSourceClasses: string[]
  prohibitedUses: string[]
  requiredReviewers: string[]
  exportRestrictions: string[]
  notes: string[]
}

// ─── Entities (mirror the migration tables) ──────────────────────────────────

export type SageWorkspace = {
  id: string
  orgId: string
  name: string
  status: SageWorkspaceStatus
  institutionType: SageInstitutionType
  riskSurface: SageRiskSurface
  boundaryProfile: SageBoundaryProfile
  createdBy: string
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
}

export type SageWorkspaceMember = {
  id: string
  workspaceId: string
  orgId: string
  actorId: string
  createdBy: string
  createdAt: string
}

export type SageStakeholderProfile = {
  id: string
  orgId: string
  actorId: string
  stakeholderFunction: string
  institutionTypeContext?: SageInstitutionType | null
  createdBy: string
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
}

export type SageRoleAssignment = {
  id: string
  workspaceId: string
  orgId: string
  actorId: string
  sageApplicationRole: SageApplicationRole
  workspaceScope?: string | null
  timeBoundAccessExpiresAt?: string | null
  accessReason?: string | null
  approvedBy?: string | null
  createdAt: string
  revokedAt?: string | null
}

export type SageEvidenceAuthorization = {
  id: string
  workspaceId: string
  orgId: string
  actorId: string
  evidenceAuthorizationLevel: SageAuthorizationLevel
  accessReason?: string | null
  approvedBy?: string | null
  createdAt: string
  revokedAt?: string | null
}

export type SageExportRequest = {
  id: string
  workspaceId: string
  orgId: string
  requestedBy: string
  scope?: string | null
  purpose?: string | null
  packageType: SageExportPackageType
  requestedScopeJson?: string | null
  requestedScopeHash?: string | null
  policyVersion?: string | null
  status: SageExportStatus
  createdAt: string
  updatedAt?: string | null
}

export type SageExportApproval = {
  id: string
  exportRequestId: string
  orgId: string
  exportAuthorityLevel: SageExportAuthorityLevel
  approverId: string
  decision: string
  decisionAt: string
  reason?: string | null
  approvedScopeHash?: string | null
}

/** An immutable, generated internal export package. External delivery is disabled. */
export type SageExportPackage = {
  id: string
  orgId: string
  workspaceId: string
  exportRequestId: string
  status: SageExportPackageStatus
  packageType: SageExportPackageType
  manifestJson: string
  manifestHash: string
  contentHash: string
  storageReference: string
  mediaType: string
  sizeBytes: number
  policyVersion: string
  itemCount: number
  excludedCount: number
  generatedBy: string
  generatedAt: string
  createdAt: string
}

/** Immutable private package bytes (content-addressed, insert-only). */
export type SageExportPackageObject = {
  storageReference: string
  mediaType: string
  contentHash: string
  bytes: Uint8Array
  sizeBytes: number
}

// ─── Durable audit outbox (Phase 7) ──────────────────────────────────────────

export const SAGE_AUDIT_OUTBOX_STATUSES = ['pending', 'dispatching', 'dispatched', 'failed'] as const
export type SageAuditOutboxStatus = (typeof SAGE_AUDIT_OUTBOX_STATUSES)[number]

/**
 * A durable audit event written IN THE SAME transaction as the material change
 * it records, then dispatched to the audit sink after commit (retriable). Only
 * safe identifiers/hashes are stored — never narrative, rationale, or bytes.
 */
export type SageAuditOutboxEvent = {
  id: string
  eventId: string
  orgId: string
  workspaceId: string
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  safePayloadJson: string
  status: SageAuditOutboxStatus
  attemptCount: number
  createdAt: string
  dispatchedAt?: string | null
  lastErrorCode?: string | null
  dispatchOwner?: string | null
  leaseExpiresAt?: string | null
}

/**
 * The intent to enqueue an audit event inside a domain transaction. The
 * repository sets `resourceId` from the newly-committed row and persists the
 * event as 'pending' for after-commit dispatch. `safePayload` must never carry
 * narrative, rationale, evidence content, or credentials.
 */
export type SageAuditOutboxIntent = {
  eventId: string
  actorId: string
  action: string
  resourceType: string
  safePayload: Record<string, unknown>
}

// ─── Evidence enums (mirror the migration) ───────────────────────────────────

export const SAGE_SOURCE_TYPES = [
  'public',
  'administrative',
  'authorized_only',
  'excluded',
  'unknown',
] as const
export type SageSourceType = (typeof SAGE_SOURCE_TYPES)[number]

export const SAGE_SOURCE_QUALITIES = [
  'low',
  'low_moderate',
  'moderate',
  'high',
  'insufficient',
] as const
export type SageSourceQuality = (typeof SAGE_SOURCE_QUALITIES)[number]

export const SAGE_CONFIDENCE_LEVELS = [
  'low',
  'low_moderate',
  'moderate',
  'high',
  'insufficient',
] as const
export type SageConfidenceLevel = (typeof SAGE_CONFIDENCE_LEVELS)[number]

export const SAGE_BOUNDARY_FLAG_TYPES = [
  'prohibited_use',
  'sensitivity',
  'exclusion',
  'review_required',
  'real_institution_risk',
] as const
export type SageBoundaryFlagType = (typeof SAGE_BOUNDARY_FLAG_TYPES)[number]

// ─── Human-governance enums (Phase 6) ────────────────────────────────────────

/** What a boundary flag / review note is attached to (used for redaction). */
export const SAGE_GOVERNANCE_TARGET_TYPES = [
  'workspace',
  'evidence_source',
  'evidence_item',
] as const
export type SageGovernanceTargetType = (typeof SAGE_GOVERNANCE_TARGET_TYPES)[number]

/** Boundary-flag lifecycle. Only these named transitions are permitted. */
export const SAGE_BOUNDARY_FLAG_STATUSES = [
  'open',
  'under_review',
  'resolved',
  'retained',
] as const
export type SageBoundaryFlagStatus = (typeof SAGE_BOUNDARY_FLAG_STATUSES)[number]

/** Terminal outcomes a reviewer may record when closing a boundary flag. */
export const SAGE_BOUNDARY_RESOLUTIONS = ['resolved', 'retained'] as const
export type SageBoundaryResolution = (typeof SAGE_BOUNDARY_RESOLUTIONS)[number]

/** Structured kind of a human review note (never a decision by itself). */
export const SAGE_REVIEW_NOTE_TYPES = [
  'observation',
  'concern',
  'clarification',
  'follow_up',
] as const
export type SageReviewNoteType = (typeof SAGE_REVIEW_NOTE_TYPES)[number]

/**
 * How a governance record's effective authorization level was derived. A
 * governance record is DERIVED information; its authorization envelope is at
 * least as restrictive as the evidence it summarizes.
 */
export const SAGE_GOVERNANCE_AUTHORIZATION_BASES = [
  'workspace_default', // workspace/general record; floor = internal
  'target_inherited', // inherited from a flagged/annotated evidence target
  'evidence_inherited', // inherited from the most restrictive referenced evidence
  'reviewer_restricted', // reviewer explicitly requested a stricter level
  'legacy_conservative', // migration fallback: unresolved legacy provenance → sensitive
] as const
export type SageGovernanceAuthorizationBasis =
  (typeof SAGE_GOVERNANCE_AUTHORIZATION_BASES)[number]

// ─── Evidence and decision entities (mirror the migration tables) ────────────

export type SageEvidenceSource = {
  id: string
  workspaceId: string
  orgId: string
  sourceType: SageSourceType
  sourceQuality?: SageSourceQuality | null
  authorizationLevel: SageAuthorizationLevel
  containsPersonalInformation: boolean
  containsSensitiveInformation: boolean
  classified: boolean
  createdBy: string
  createdAt: string
}

export type SageEvidenceItem = {
  id: string
  sourceId: string
  workspaceId: string
  orgId: string
  lifecycleState: SageEvidenceLifecycleState
  confidenceLevel?: SageConfidenceLevel | null
  excludedFromExternalReview: boolean
  humanReviewRequired: boolean
  createdBy: string
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
}

export type SageBoundaryFlag = {
  id: string
  workspaceId: string
  orgId: string
  targetType?: SageGovernanceTargetType | null
  targetId?: string | null
  flagType: SageBoundaryFlagType
  note?: string | null
  status: SageBoundaryFlagStatus
  authorizationLevel: SageAuthorizationLevel
  authorizationBasis?: SageGovernanceAuthorizationBasis | null
  resolvedAt?: string | null
  resolvedBy?: string | null
  resolutionNote?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type SageReviewNote = {
  id: string
  workspaceId: string
  orgId: string
  targetType?: SageGovernanceTargetType | null
  targetId?: string | null
  reviewerId: string
  noteType: SageReviewNoteType
  note: string
  authorizationLevel: SageAuthorizationLevel
  authorizationBasis?: SageGovernanceAuthorizationBasis | null
  createdAt: string
}

export type SageDecisionRecord = {
  id: string
  workspaceId: string
  orgId: string
  decision: string
  rationale?: string | null
  uncertainty?: string | null
  humanReviewerId: string
  referencedEvidenceItemIds: string[]
  referencedBoundaryFlagIds: string[]
  authorizationLevel: SageAuthorizationLevel
  authorizationBasis?: SageGovernanceAuthorizationBasis | null
  excludedFromExternalReview: boolean
  createdBy: string
  createdAt: string
}
