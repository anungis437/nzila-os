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
  status: SageExportStatus
  createdAt: string
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
}
