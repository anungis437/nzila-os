/**
 * @nzila/doctrine-enforcement — Types
 *
 * Policy, decision, evaluation, and AI capability types for Nzila
 * runtime governance.
 *
 * See docs/nzila-runtime-governance/governance-policy-engine.md and
 * docs/nzila-runtime-governance/governance-safe-ai-runtime-validation.md.
 *
 * @module @nzila/doctrine-enforcement/types
 */

// ── Doctrine citation (mirrors governance-telemetry shape) ──────────────────

export interface DoctrineCitation {
  readonly document: string
  readonly section?: string
  readonly policyId?: string
}

// ── Policy taxonomy ─────────────────────────────────────────────────────────

export type PolicyDomain =
  | 'role'
  | 'route'
  | 'pilot'
  | 'ai-exposure'
  | 'continuity-safe-visibility'
  | 'executive-safety'
  | 'deployment'
  | 'environment'

export type PolicyEffect =
  | 'allow'
  | 'deny'
  | 'require_approval'
  | 'require_review'

export type PolicySeverity = 'info' | 'warning' | 'critical'

// ── Conditions ──────────────────────────────────────────────────────────────

export type PolicyConditionOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'matches'
  | 'present'
  | 'absent'

export interface PolicyCondition {
  readonly field: string
  readonly operator: PolicyConditionOperator
  readonly value?: unknown
}

// ── Policy definition ──────────────────────────────────────────────────────

export type PolicyScope =
  | { readonly kind: 'global' }
  | { readonly kind: 'product'; readonly product: string }
  | { readonly kind: 'environment'; readonly environment: string }
  | { readonly kind: 'org'; readonly orgScope: string }
  | { readonly kind: 'pilot'; readonly pilotScope: string }

export interface GovernancePolicy {
  readonly id: string
  readonly version: string
  readonly domain: PolicyDomain
  readonly scope: PolicyScope
  readonly description: string
  readonly doctrineCitations: readonly DoctrineCitation[]
  readonly conditions: readonly PolicyCondition[]
  readonly effect: PolicyEffect
  readonly severity: PolicySeverity
  readonly registeredBy: string // governance forum id
  readonly registeredAt: string
}

// ── Evaluation ──────────────────────────────────────────────────────────────

export interface PolicySubject {
  readonly kind: string // route / surface / invocation / etc.
  readonly id: string
  readonly attributes: Readonly<Record<string, unknown>>
}

export interface PolicyContext {
  readonly product: string
  readonly environment: string
  readonly releaseId: string
  /** Aggregation-safe context only; never personal. */
  readonly attributes: Readonly<Record<string, unknown>>
}

export interface PolicyEvaluationOutput {
  readonly policyId: string
  readonly policyVersion: string
  readonly decision: PolicyEffect
  readonly reason: string
  readonly doctrineCitations: readonly DoctrineCitation[]
  readonly severity: PolicySeverity
  readonly subject: PolicySubject
  readonly evaluatedAt: string
}

// ── AI capability registration ──────────────────────────────────────────────

/**
 * Categorically refused AI capability behaviors. Registration with any of
 * these flags raised is rejected at the registry boundary.
 *
 * Source: docs/nzila-assurance/governance-safe-ai-assurance-model.md
 */
export const CATEGORICALLY_REFUSED_AI_BEHAVIORS = [
  'black_box_scoring_of_humans',
  'opaque_governance_recommendations',
  'coercive_analytics',
  'autonomous_governance_authority',
  'behavioral_manipulation',
  'individual_behavioral_resolution',
  'covert_escalation',
  'surveillance_scoring',
  'undisclosed_generation',
] as const

export type CategoricallyRefusedAIBehavior =
  (typeof CATEGORICALLY_REFUSED_AI_BEHAVIORS)[number]

export interface AICapabilityRegistration {
  readonly capabilityId: string
  readonly version: string
  readonly description: string
  readonly surfaces: readonly string[] // surface ids served
  readonly explainabilitySurface: string // surface id where explanations are reachable
  readonly reviewabilitySurface: string // surface id for governance review
  readonly humanAuthorityGates: readonly string[] // gate ids preserving human authority
  readonly doctrineCitations: readonly DoctrineCitation[]
  readonly governanceReviewRecordId: string
  readonly declaredBehaviors: readonly string[] // self-declared behaviors for screen
  readonly registeredBy: string
  readonly registeredAt: string
}
