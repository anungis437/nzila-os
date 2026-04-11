/**
 * @nzila/pilot-mode — Types
 *
 * Org/user-scoped feature flag targeting with gradual rollout.
 * Extends the platform-feature-flags model with tenant awareness.
 *
 * @module @nzila/pilot-mode/types
 */

// ── Rollout Strategy ────────────────────────────────────────────────────────

export type RolloutStrategy = 'instant' | 'gradual' | 'canary'

// ── Pilot Flag Definition ───────────────────────────────────────────────────

/**
 * A feature flag with org/user targeting capabilities.
 *
 * Evaluation order:
 *   1. If flag is disabled → false
 *   2. If org is in `orgIds` → true
 *   3. If user is in `userIds` → true
 *   4. If cohort matches → true
 *   5. If `percentage` is set → deterministic hash-based rollout
 *   6. Otherwise → false
 */
export interface PilotFlagDef {
  /** Unique flag name (e.g. "new_dashboard"). */
  readonly name: string

  /** Human-readable description. */
  readonly description?: string

  /** Master kill switch. */
  readonly enabled: boolean

  /** Specific orgs that see this flag. */
  readonly orgIds?: readonly string[]

  /** Specific users that see this flag. */
  readonly userIds?: readonly string[]

  /** Named cohort this flag belongs to. */
  readonly cohortId?: string

  /**
   * Percentage rollout (0–100).
   * Applied via deterministic hash when org/user not explicitly listed.
   */
  readonly percentage?: number

  /** Rollout strategy for documentation / ops visibility. */
  readonly strategy: RolloutStrategy

  /** ISO-8601 timestamp when the flag was activated. */
  readonly activatedAt?: string

  /** Optional expiry — flag auto-disables after this date. */
  readonly expiresAt?: string
}

// ── Pilot Context ───────────────────────────────────────────────────────────

/**
 * Evaluation context provided at flag-check time.
 * Mirrors OrgContext fields relevant to pilot decisions.
 */
export interface PilotContext {
  readonly orgId: string
  readonly userId: string
}

// ── Evaluation Result ───────────────────────────────────────────────────────

export type PilotEvaluationReason =
  | 'flag_disabled'
  | 'flag_expired'
  | 'org_targeted'
  | 'user_targeted'
  | 'cohort_targeted'
  | 'percentage_included'
  | 'percentage_excluded'
  | 'no_match'

export interface PilotEvaluation {
  readonly flag: string
  readonly enabled: boolean
  readonly reason: PilotEvaluationReason
}

// ── Cohort ──────────────────────────────────────────────────────────────────

/**
 * A named group of orgs enrolled together in a pilot wave.
 */
export interface PilotCohort {
  /** Unique cohort identifier. */
  readonly id: string

  /** Human-readable name (e.g. "Wave 1 — Early Adopters"). */
  readonly name: string

  /** Org IDs in this cohort. */
  readonly orgIds: readonly string[]

  /** ISO-8601 enrolment timestamp. */
  readonly enrolledAt: string
}

// ── Pilot Record (audit trail) ──────────────────────────────────────────────

export interface PilotRecord {
  readonly id: string
  readonly flagName: string
  readonly orgId: string
  readonly userId: string
  readonly enabled: boolean
  readonly reason: PilotEvaluationReason
  readonly timestamp: string
}
