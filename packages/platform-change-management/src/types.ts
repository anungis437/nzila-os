/**
 * @nzila/platform-change-management — Type definitions
 *
 * Canonical types for the Change Enablement system.
 * Aligned with ITIL Change Enablement while remaining Git-native.
 *
 * @module @nzila/platform-change-management/types
 */

// ── Enums ───────────────────────────────────────────────────────────────────

export type ChangeType = 'STANDARD' | 'NORMAL' | 'EMERGENCY'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type ChangeStatus =
  | 'PROPOSED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'IMPLEMENTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'CLOSED'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type Environment = 'STAGING' | 'PROD'

export type ApprovalRole =
  | 'service_owner'
  | 'change_manager'
  | 'security_approver'
  | 'platform_owner'
  | 'staging_mission_owner'

/** Operational authorization only; never substitutes for signed release or security proof. */
export interface StagingAuthorization {
  readonly mission: string
  readonly owner_github_login: string
  readonly owner_instruction_sha256: string
  readonly owner_instruction_ref: string
  readonly delegate: { readonly name: string; readonly authenticated_github_login: string; readonly azure_identity: string }
  readonly resources: {
    readonly subscription_id: string
    readonly tenant_id: string
    readonly container_app: string
    readonly container_app_resource_group: string
    readonly postgres_server: string
    readonly postgres_resource_group: string
    readonly database: string
    readonly key_vault: string
    readonly clone_name_prefix: string
    readonly region: string
  }
  readonly production_authorized: false
  readonly security_proof_required: true
  readonly signed_release_required: true
}

export type PIROutcome = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'ROLLED_BACK'

// ── Post Implementation Review ──────────────────────────────────────────────

export interface PostImplementationReview {
  readonly outcome: PIROutcome
  readonly incidents_triggered: boolean
  readonly incident_refs: readonly string[]
  readonly observations: string
}

// ── Change Record ───────────────────────────────────────────────────────────

export interface ChangeRecord {
  readonly change_id: string
  readonly title: string
  readonly description: string
  readonly service: string
  readonly environment: Environment
  readonly change_type: ChangeType
  readonly risk_level: RiskLevel
  readonly impact_summary: string
  readonly requested_by: string
  readonly approvers_required: readonly string[]
  readonly approved_by: readonly string[]
  readonly approval_status: ApprovalStatus
  readonly staging_authorization?: StagingAuthorization
  readonly implementation_window_start: string
  readonly implementation_window_end: string
  readonly rollback_plan: string
  readonly test_evidence_refs: readonly string[]
  readonly linked_prs: readonly string[]
  readonly linked_commits: readonly string[]
  readonly linked_build_attestation?: string
  readonly status: ChangeStatus
  readonly created_at: string
  readonly updated_at: string
  readonly completed_at?: string
  readonly post_implementation_review?: PostImplementationReview
}

// ── Approval Evaluation ─────────────────────────────────────────────────────

export interface ApprovalRequirements {
  readonly requiredApprovals: readonly ApprovalRole[]
  readonly missingApprovals: readonly ApprovalRole[]
  readonly cabRequired: boolean
  readonly approvalSatisfied: boolean
}

// ── Calendar Models ─────────────────────────────────────────────────────────

export interface ChangeWindow {
  readonly start: string
  readonly end: string
}

export interface WindowConflict {
  readonly conflicting_change_id: string
  readonly conflicting_title: string
  readonly overlap_start: string
  readonly overlap_end: string
}

export interface FreezePeriod {
  readonly name: string
  readonly start: string
  readonly end: string
  readonly environments: readonly Environment[]
}

export interface CalendarPolicy {
  readonly freeze_periods: readonly FreezePeriod[]
  readonly restricted_hours?: {
    readonly weekdays_only?: boolean
    readonly start_hour?: number
    readonly end_hour?: number
  }
}

// ── Validation Result ───────────────────────────────────────────────────────

export interface ChangeValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly change_id?: string
}

// ── Governance Event Types ──────────────────────────────────────────────────

export type ChangeGovernanceEventType =
  | 'change_created'
  | 'change_approved'
  | 'change_rejected'
  | 'change_scheduled'
  | 'change_started'
  | 'change_completed'
  | 'change_failed'
  | 'change_rolled_back'
  | 'pir_recorded'
