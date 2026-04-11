/**
 * @nzila/onboarding-core — Types
 *
 * Multi-step organisation setup tracking.
 * Pure type definitions — no runtime dependencies.
 *
 * @module @nzila/onboarding-core/types
 */

// ── Step Definition ─────────────────────────────────────────────────────────

/**
 * Predicate that determines whether a step is ready to be completed.
 * Receives the accumulated step data bag.
 */
export type StepValidator = (data: Record<string, unknown>) => boolean

/**
 * A single onboarding step definition.
 */
export interface OnboardingStepDef {
  /** Machine-readable step key (unique within a flow). */
  readonly name: string

  /** Human-readable label for UI. */
  readonly displayName: string

  /** If true, the flow cannot complete until this step is done. */
  readonly required: boolean

  /** Optional pre-condition: can the step be started? */
  readonly canStart?: StepValidator

  /** Optional validation: is the step data acceptable? */
  readonly validate?: StepValidator

  /**
   * Steps that must be completed before this one.
   * References other step names within the same flow.
   */
  readonly dependsOn?: readonly string[]
}

// ── Flow Definition ─────────────────────────────────────────────────────────

/**
 * A complete onboarding flow: an ordered list of steps
 * that an org walks through after creation.
 */
export interface OnboardingFlowDef {
  /** Unique flow identifier (e.g. "default", "enterprise"). */
  readonly id: string

  /** Human-readable name. */
  readonly displayName: string

  /** Ordered step definitions. */
  readonly steps: readonly OnboardingStepDef[]
}

// ── Step Completion ─────────────────────────────────────────────────────────

/**
 * Record of a single step being completed.
 */
export interface StepCompletion {
  /** Step name that was completed. */
  readonly stepName: string

  /** ISO-8601 timestamp of completion. */
  readonly completedAt: string

  /** Actor who completed the step. */
  readonly completedBy: string

  /** Arbitrary data captured during the step. */
  readonly data: Record<string, unknown>
}

// ── Progress ────────────────────────────────────────────────────────────────

export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'blocked'

/**
 * Full progress state for an org's onboarding.
 * This is the externally-persisted state object —
 * the engine reads it in and produces a new copy on each mutation.
 */
export interface OnboardingProgress {
  /** Organisation this progress belongs to. */
  readonly orgId: string

  /** Flow ID this progress tracks against. */
  readonly flowId: string

  /** Map of stepName → completion record. */
  readonly completions: Readonly<Record<string, StepCompletion>>

  /** Overall derived status. */
  readonly status: OnboardingStatus

  /** ISO-8601 timestamp when tracking started. */
  readonly startedAt: string
}

// ── Engine Results ──────────────────────────────────────────────────────────

export type StepOutcome = 'completed' | 'skipped' | 'failed'

export interface StepResult {
  readonly stepName: string
  readonly outcome: StepOutcome
  readonly reason?: string
}

export interface ProgressSummary {
  readonly flowId: string
  readonly orgId: string
  readonly status: OnboardingStatus
  readonly totalSteps: number
  readonly completedSteps: number
  readonly requiredRemaining: number
  readonly optionalRemaining: number
  readonly percentComplete: number
  readonly nextStep: string | null
  readonly blockers: readonly string[]
}

// ── Onboarding Record (audit trail) ─────────────────────────────────────────

export interface OnboardingRecord {
  readonly id: string
  readonly orgId: string
  readonly flowId: string
  readonly stepName: string
  readonly outcome: StepOutcome
  readonly actorId: string
  readonly timestamp: string
  readonly data: Record<string, unknown>
}
