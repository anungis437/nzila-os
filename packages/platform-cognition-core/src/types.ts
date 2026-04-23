/**
 * @nzila/platform-cognition-core — Type definitions
 *
 * The Cognition Layer composes four engines:
 *   • Memory      — persistent, scoped, decaying user/org memory
 *   • Trajectory  — sequence-feature risk scoring over time
 *   • State       — explainable human-state inference
 *   • Consent     — consent-gate wrapping recall and inference output
 *
 * Phase-1 algorithms are interpretable (recency-weighted decay, calibrated logistic,
 * Bayesian aggregation). Phase-2 swaps in trained models from @nzila/ml-core once
 * labeled data exists. See STATUS.md for the current phase.
 *
 * @module @nzila/platform-cognition-core/types
 */

export const COGNITION_ENGINE_VERSION = '0.1.0'

// ── Scope ───────────────────────────────────────────────────────────────────

/** Subject of a memory or inference (the "who" cognition is about). */
export interface CognitionSubject {
  readonly tenantId: string
  readonly orgId: string
  /** Optional: a specific user this memory/inference is about. */
  readonly userId?: string
  /** Optional: a domain entity (case, customer, member, partner, etc.). */
  readonly entityType?: string
  readonly entityId?: string
}

// ── Memory ──────────────────────────────────────────────────────────────────

export type MemoryKind =
  | 'episodic'      // a specific event that happened
  | 'semantic'      // a learned fact about the subject
  | 'preference'    // an expressed/inferred preference
  | 'decision'      // a past decision and its outcome
  | 'trust'         // a trust signal (consent given, complaint, etc.)

export type MemorySource =
  | 'user_action'
  | 'system_event'
  | 'inference'
  | 'manual'
  | 'imported'

export interface MemoryEvent {
  readonly id: string
  readonly subject: CognitionSubject
  readonly kind: MemoryKind
  readonly source: MemorySource
  /** Short machine-stable label, e.g. 'grievance_filed', 'login', 'sla_missed'. */
  readonly type: string
  /** Free-form details. PII MUST be minimized; the consent gate is not retroactive. */
  readonly payload: Readonly<Record<string, unknown>>
  /** Initial salience — higher means more memorable (typical 0..1, not capped). */
  readonly salience: number
  /** Tags used for retrieval (lowercase, kebab-case recommended). */
  readonly tags: readonly string[]
  readonly occurredAt: string
  readonly recordedAt: string
  /** Soft-delete marker (consent withdrawal). Kept in store for audit; excluded from recall. */
  readonly redactedAt?: string
  /** Reason a record was redacted, if any. */
  readonly redactionReason?: string
}

export interface MemoryRecallQuery {
  readonly subject: CognitionSubject
  readonly kinds?: readonly MemoryKind[]
  readonly types?: readonly string[]
  readonly tags?: readonly string[]
  /** Time window. Defaults to 'all'. */
  readonly since?: string
  readonly until?: string
  /** Max records to return (default 50). */
  readonly limit?: number
  /** Recall scoring half-life in days. Default 30. */
  readonly halfLifeDays?: number
  /** Reference time for decay (defaults to now). Useful for deterministic tests. */
  readonly now?: string
}

export interface RecalledMemory {
  readonly event: MemoryEvent
  /** Final ranking score = salience × decay(age) × tagMatch. */
  readonly score: number
  /** Components for explainability. */
  readonly components: {
    readonly salience: number
    readonly decay: number
    readonly tagMatch: number
  }
}

export type PreferenceValence = 'positive' | 'negative' | 'neutral'

export interface PreferenceProfile {
  readonly subject: CognitionSubject
  /** Aggregated preference scores per tag/topic, in [-1, 1]. */
  readonly scores: Readonly<Record<string, number>>
  /** Number of source events used. */
  readonly sampleSize: number
  readonly computedAt: string
}

// ── Trajectory ──────────────────────────────────────────────────────────────

export type TrajectoryRiskKind =
  | 'churn'
  | 'escalation'
  | 'aging'
  | 'disengagement'
  | 'progression'

/** Aggregated, interpretable features extracted from a memory window. */
export interface TrajectoryFeatures {
  readonly subject: CognitionSubject
  readonly windowStart: string
  readonly windowEnd: string
  readonly eventCount: number
  readonly distinctTypes: number
  /** Mean inter-event gap in days. Infinity when fewer than 2 events. */
  readonly meanGapDays: number
  /** Slope of event frequency over the window (events/day²). Negative = decline. */
  readonly frequencySlope: number
  /** Days since most recent event. */
  readonly recencyDays: number
  /** Sum of negative-valence event salience. */
  readonly negativeSignal: number
  /** Sum of positive-valence event salience. */
  readonly positiveSignal: number
  /** Count of escalation-tagged events. */
  readonly escalationEventCount: number
}

export interface TrajectoryRiskScore {
  readonly subject: CognitionSubject
  readonly kind: TrajectoryRiskKind
  /** Calibrated probability in [0, 1]. */
  readonly probability: number
  /** Confidence in the probability itself (data sufficiency). */
  readonly confidence: number
  /** Per-feature contribution to the logit (signed). For explainability. */
  readonly contributions: ReadonlyArray<{
    readonly feature: string
    readonly value: number
    readonly weight: number
    readonly contribution: number
  }>
  readonly features: TrajectoryFeatures
  readonly modelVersion: string
  readonly scoredAt: string
}

// ── State ───────────────────────────────────────────────────────────────────

export type StateDimension =
  | 'confusion'
  | 'fatigue'
  | 'frustration'
  | 'urgency'
  | 'confidence'
  | 'disengagement'

export interface StateSignalInput {
  /** Repeated identical actions in a short window (confusion proxy). */
  readonly repeatActionCount?: number
  /** Sessions per day in last 7d (fatigue/disengagement proxy). */
  readonly sessionsPerDay?: number
  /** Mean session duration in minutes. */
  readonly meanSessionMinutes?: number
  /** Help/search/abandon events in last 24h. */
  readonly helpEventCount?: number
  /** Errors observed in last 24h. */
  readonly errorEventCount?: number
  /** Time pressure flag: a deadline within N hours. */
  readonly hoursToDeadline?: number
  /** Successful task completions in last 7d. */
  readonly completionCount?: number
}

export interface StateInference {
  readonly subject: CognitionSubject
  /** Each dimension scored in [0, 1]; explainable component breakdown attached. */
  readonly dimensions: Readonly<Record<StateDimension, number>>
  readonly explanations: ReadonlyArray<{
    readonly dimension: StateDimension
    readonly drivers: ReadonlyArray<{ readonly signal: string; readonly contribution: number }>
  }>
  readonly inferredAt: string
  readonly modelVersion: string
}

// ── Consent ─────────────────────────────────────────────────────────────────

export type ConsentZone =
  | 'operational'   // strictly necessary for service delivery
  | 'analytics'     // aggregated insight, no individual targeting
  | 'personalization'
  | 'cross_product' // memory shared between Nzila products
  | 'training'      // contributes to model training

export type Jurisdiction =
  | 'CA'    // Canada — PIPEDA / Quebec Law 25
  | 'EU'    // GDPR
  | 'US'    // sectoral
  | 'AF'    // African Union conventions / national laws (treated conservatively)
  | 'OTHER'

export interface ConsentPolicy {
  readonly subject: CognitionSubject
  /** Allowed zones; absence is an explicit denial. */
  readonly allowedZones: readonly ConsentZone[]
  /** Allowed memory kinds; absence is denial. */
  readonly allowedKinds: readonly MemoryKind[]
  /** Retention in days; events older are excluded from recall. */
  readonly retentionDays: number
  /** Tag patterns the subject has explicitly opted out of. */
  readonly excludedTags: readonly string[]
  readonly jurisdiction: Jurisdiction
  /** When this policy was recorded. */
  readonly recordedAt: string
  /** When the subject last reaffirmed consent (for renewal tracking). */
  readonly lastConfirmedAt?: string
}

export interface ConsentGateResult<T> {
  readonly allowed: boolean
  readonly value: T | null
  /** Human-readable reasons; safe to surface in audit logs. */
  readonly reasons: readonly string[]
  /** Was a redaction applied (e.g., tag removed) before returning? */
  readonly redacted: boolean
}

// ── Decision-engine adapter ─────────────────────────────────────────────────

/** Subject-shaped key used to anchor signals in the org's decision pipeline. */
export interface CognitionAdapterOptions {
  /** Threshold above which a risk score becomes a signal. Default 0.6. */
  readonly minProbability?: number
  /** Threshold above which a risk score is emitted as 'spike'. Default 0.8. */
  readonly spikeThreshold?: number
}
