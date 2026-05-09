/**
 * @nzila/governance-telemetry — Types
 *
 * Canonical governance event envelope for Nzila runtime governance.
 *
 * These types are the cross-product wire-level contract referenced by:
 *  - docs/nzila-runtime-governance/governance-telemetry-architecture.md
 *  - docs/nzila-runtime-governance/cross-product-governance-runtime-fabric.md
 *
 * Discipline:
 *  - Envelope payloads are governance-bearing only.
 *  - No individual identifiers outside aggregation-safe hashes.
 *  - No free-form behavioral attribution.
 *
 * @module @nzila/governance-telemetry/types
 */

// ── Severity & Decision ─────────────────────────────────────────────────────

export type GovernanceSeverity = 'info' | 'warning' | 'critical'

export type GovernanceDecision =
  | 'allow'
  | 'deny'
  | 'require_approval'
  | 'require_review'

// ── Scope ───────────────────────────────────────────────────────────────────

export type GovernanceProduct =
  | 'union-eyes'
  | 'faircase'
  | 'executive-os'
  | 'veridian'
  | 'platform'

export type GovernanceEnvironmentClass =
  | 'production'
  | 'pilot'
  | 'staging'
  | 'demo'
  | 'development'

export interface GovernanceScope {
  readonly product: GovernanceProduct
  readonly environment: string // e.g., "ue-pilot-2026q2"
  readonly environmentClass: GovernanceEnvironmentClass
  readonly orgScope?: string // aggregation-safe organization scope key
  readonly pilotScope?: string // aggregation-safe pilot scope key
}

// ── Subject ─────────────────────────────────────────────────────────────────

export type GovernanceSubjectKind =
  | 'route'
  | 'surface'
  | 'workflow'
  | 'queue'
  | 'invocation'
  | 'release'
  | 'environment'
  | 'capability'
  | 'config'

export interface GovernanceSubject {
  readonly kind: GovernanceSubjectKind
  /** Stable identifier within kind. Aggregation-safe; never personal. */
  readonly id: string
  /** Optional human-readable label for governance forums. */
  readonly label?: string
}

// ── Doctrine Citation ───────────────────────────────────────────────────────

export interface DoctrineCitation {
  /** Document path relative to the repository root, e.g. "docs/nzila-ip/continuity-doctrine.md". */
  readonly document: string
  /** Optional stable section anchor. */
  readonly section?: string
  /** Optional policy id when bound through the governance policy engine. */
  readonly policyId?: string
}

// ── Event Type Taxonomy ─────────────────────────────────────────────────────

export type GovernanceEventType =
  // doctrine enforcement
  | 'doctrine_violation'
  | 'governance_warning'
  | 'continuity_risk_detected'
  | 'executive_cognitive_overload_risk'
  | 'deployment_legitimacy_failure'
  | 'pilot_boundary_violation'
  | 'governance_safe_ai_violation'
  // continuity observability
  | 'continuity_posture_changed'
  | 'governance_friction_detected'
  | 'calmness_degradation_signal'
  | 'pacing_violation'
  | 'density_threshold_exceeded'
  | 'escalation_concentration_detected'
  // AI runtime validation
  | 'ai_explainability_failure'
  | 'governance_safe_ai_warning'
  | 'human_oversight_violation'
  | 'opaque_recommendation_detected'
  // deployment legitimacy validation
  | 'unknown_release_state'
  | 'environment_drift_detected'
  | 'deployment_identity_failure'
  | 'migration_parity_failure'
  | 'isolation_violation'
  | 'environment_identity_verified'
  // governance lifecycle
  | 'governance_review_recorded'
  | 'governance_decision_emitted'
  | 'assurance_posture_updated'
  // modernization
  | 'modernization_pace_violation'
  | 'irreversible_change_detected'

// ── Envelope ────────────────────────────────────────────────────────────────

/**
 * Canonical governance event envelope.
 *
 * Every runtime governance event in any Nzila product conforms to this shape.
 * Payload contents must be governance-bearing only — see schemas for validation.
 */
export interface GovernanceEventEnvelope {
  /** ULID; globally unique; aggregation-safe. */
  readonly id: string
  /** Schema version of the envelope, e.g. "1.0.0". */
  readonly schemaVersion: string
  /** Event type from the canonical taxonomy. */
  readonly type: GovernanceEventType
  readonly severity: GovernanceSeverity
  readonly scope: GovernanceScope
  readonly subject: GovernanceSubject
  /** Doctrine citation; required for severity >= "warning". */
  readonly doctrineCitations?: readonly DoctrineCitation[]
  /** Decision when the event corresponds to an enforcement act. */
  readonly decision?: GovernanceDecision
  /** Release id under which this event was emitted. */
  readonly releaseId: string
  /** ISO-8601 timestamp of emission. */
  readonly emittedAt: string
  /** Bounded, governance-bearing payload. Validated by schema. */
  readonly payload: Readonly<Record<string, unknown>>
  /** Optional aggregation-safe correlation key (NEVER a personal identifier). */
  readonly correlationKey?: string
}

// ── Emitter Port ────────────────────────────────────────────────────────────

/**
 * Telemetry emitter port. Implementations bridge to OpenTelemetry, file sinks,
 * the governance evidence ledger, or in-memory buffers (for tests).
 *
 * Implementations MUST validate the event against its schema before persisting
 * or forwarding. A failed validation is itself a governance event.
 */
export interface GovernanceEmitter {
  emit(event: GovernanceEventEnvelope): Promise<void> | void
}
