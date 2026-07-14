// ─── @nzila/sage-core — Phase 8B records-lifecycle types ─────────────────────
// The controlled lifecycle of an immutable export package AFTER creation and
// delivery: versioned retention, legal holds, independently-approved
// destruction, verified object deletion, and immutable destruction evidence.
// Default posture is RETAIN; destruction is the rare, tightly-gated exception.

// ── Retention policy (versioned, immutable historical versions) ──────────────
export const SAGE_RETENTION_BASES = ['created_at', 'delivered_at', 'event_date'] as const
export type SageRetentionBasis = (typeof SAGE_RETENTION_BASES)[number]

export type SageRetentionPolicy = {
  id: string
  orgId: string
  policyCode: string
  version: number
  name: string
  description?: string | null
  retentionBasis: SageRetentionBasis
  retentionDurationDays: number
  effectiveFrom: string
  effectiveTo?: string | null
  isActive: boolean
  createdBy: string
  createdAt: string
}

// ── Retention assignment (one authoritative assignment per package) ──────────
export type SageExportRetentionAssignment = {
  id: string
  orgId: string
  workspaceId: string
  exportPackageId: string
  retentionPolicyId: string
  policyCode: string
  policyVersion: number
  retentionBasis: SageRetentionBasis
  retentionStartedAt: string
  retainUntil: string
  assignedBy: string
  assignedAt: string
  /**
   * Deterministic provenance of the retention-basis event. A persisted date is
   * insufficient for defensible disposition without its authoritative source.
   */
  retentionBasisSourceType: SageRetentionBasis
  retentionBasisSourceId: string
  retentionBasisSourceTimestamp: string
}

// ── Legal hold (multiple allowed; any active hold blocks destruction) ────────
export const SAGE_LEGAL_HOLD_STATUSES = ['active', 'released'] as const
export type SageLegalHoldStatus = (typeof SAGE_LEGAL_HOLD_STATUSES)[number]

export type SageExportLegalHold = {
  id: string
  orgId: string
  workspaceId: string
  exportPackageId: string
  holdCode: string
  status: SageLegalHoldStatus
  reason: string
  placedBy: string
  placedAt: string
  releasedBy?: string | null
  releasedAt?: string | null
  releaseReason?: string | null
}

// ── Destruction request (frozen scope; CAS state machine) ────────────────────
export const SAGE_DESTRUCTION_REQUEST_STATUSES = [
  'requested',
  'approved',
  'executing',
  'executing_preflight',
  'deletion_started',
  'denied',
  'destroyed',
  'failed',
  'cancelled',
] as const
export type SageDestructionRequestStatus = (typeof SAGE_DESTRUCTION_REQUEST_STATUSES)[number]

export type SageExportDestructionRequest = {
  id: string
  orgId: string
  workspaceId: string
  exportPackageId: string
  requestedBy: string
  reason: string
  status: SageDestructionRequestStatus
  packageContentHash: string
  packageManifestHash: string
  storageReferenceHash: string
  retentionPolicyCode: string
  retentionPolicyVersion: number
  retainUntil: string
  activeHoldCount: number
  /** Canonical digest of the active legal-hold set frozen at request time. */
  activeHoldSetDigest?: string | null
  executionOwner?: string | null
  leaseExpiresAt?: string | null
  /** Point of no return: set atomically with the final no-hold check. */
  deletionStartedAt?: string | null
  currentAttemptId?: string | null
  destructionEvidenceId?: string | null
  requestedAt: string
  updatedAt: string
}

// ── Destruction approval (append-only; approver ≠ requester) ─────────────────
export const SAGE_DESTRUCTION_DECISIONS = ['approved', 'denied'] as const
export type SageDestructionDecision = (typeof SAGE_DESTRUCTION_DECISIONS)[number]

export type SageExportDestructionApproval = {
  id: string
  orgId: string
  workspaceId: string
  destructionRequestId: string
  decision: SageDestructionDecision
  approverId: string
  rationale?: string | null
  approvedPackageContentHash: string
  approvedManifestHash: string
  approvedStorageReferenceHash: string
  approvedRetentionPolicyCode: string
  approvedRetentionPolicyVersion: number
  approvedRetainUntil: string
  approvedActiveHoldCount: number
  /** Canonical active-hold-set digest the approver saw and approved. */
  approvedActiveHoldSetDigest?: string | null
  decidedAt: string
}

// ── Destruction evidence (immutable) ─────────────────────────────────────────
export const SAGE_DESTRUCTION_RESULTS = [
  'verified_destroyed',
  'not_found_before_delete',
  'verification_failed',
  'provider_failed',
] as const
export type SageDestructionResult = (typeof SAGE_DESTRUCTION_RESULTS)[number]

export type SageExportDestructionEvidence = {
  id: string
  eventId: string
  orgId: string
  workspaceId: string
  destructionRequestId: string
  exportPackageId: string
  objectId?: string | null
  storageProvider: string
  storageReferenceHash: string
  preDestructionContentHash: string
  preDestructionManifestHash: string
  deletionAttemptedAt?: string | null
  deletionVerifiedAt?: string | null
  verificationMethod?: string | null
  result: SageDestructionResult
  providerRequestId?: string | null
  safeErrorCode?: string | null
  executedBy: string
  createdAt: string
}

// ── Package availability (tombstone) ─────────────────────────────────────────
export const SAGE_PACKAGE_AVAILABILITY_STATUSES = ['available', 'destroyed'] as const
export type SagePackageAvailabilityStatus = (typeof SAGE_PACKAGE_AVAILABILITY_STATUSES)[number]

// ── Durable destruction attempt (persisted BEFORE the external delete) ───────
export const SAGE_DESTRUCTION_ATTEMPT_STATUSES = [
  'prepared',
  'deletion_started',
  'provider_accepted',
  'absence_verified',
  'completed',
  'failed',
  'indeterminate',
] as const
export type SageDestructionAttemptStatus = (typeof SAGE_DESTRUCTION_ATTEMPT_STATUSES)[number]

export type SageExportDestructionAttempt = {
  id: string
  attemptId: string
  orgId: string
  workspaceId: string
  destructionRequestId: string
  exportPackageId: string
  objectId?: string | null
  executionOwner: string
  providerIdempotencyKey: string
  status: SageDestructionAttemptStatus
  preDeletePresenceVerified?: boolean | null
  preDeleteVerifiedAt?: string | null
  deleteStartedAt?: string | null
  providerResult?: string | null
  providerRequestId?: string | null
  postDeleteAbsenceVerified?: boolean | null
  postDeleteVerifiedAt?: string | null
  safeErrorCode?: string | null
  createdAt: string
  updatedAt: string
}

// ── Storage deletion port ────────────────────────────────────────────────────
/**
 * The privileged storage-deletion port. The repository owns package bytes; this
 * port is ONLY implemented by the platform runtime for the destruction path.
 * `deleteObject()` success alone is NEVER treated as verified destruction —
 * `verifyObjectAbsent()` must independently confirm the object is gone.
 */
export interface SageExportPackageStorage {
  deleteObject(input: {
    storageReference: string
    expectedContentHash: string
    /** Stable provider idempotency key reused across retries of the same attempt. */
    idempotencyKey: string
  }): Promise<{
    providerRequestId?: string
    result: 'deleted' | 'not_found' | 'failed'
    safeErrorCode?: string
  }>
  verifyObjectPresent(input: { storageReference: string }): Promise<boolean>
  verifyObjectAbsent(input: { storageReference: string }): Promise<boolean>
}

// ── Eligibility evaluation reason codes ──────────────────────────────────────
export const SAGE_DESTRUCTION_ELIGIBILITY_CODES = [
  'RETENTION_NOT_ASSIGNED',
  'RETENTION_NOT_ELAPSED',
  'ACTIVE_LEGAL_HOLD',
  'PACKAGE_ALREADY_DESTROYED',
  'PACKAGE_INTEGRITY_MISMATCH',
  'ELIGIBLE',
] as const
export type SageDestructionEligibilityCode =
  (typeof SAGE_DESTRUCTION_ELIGIBILITY_CODES)[number]

export type SageExportDestructionEligibility = {
  eligible: boolean
  reasonCodes: SageDestructionEligibilityCode[]
  retainUntil: string | null
  activeHoldCount: number
}
