/**
 * @nzila/governance-telemetry — Event registry
 *
 * Central registry of governance event types, mapping each type to its
 * default severity floor and doctrine domain. Used by the runtime
 * doctrine enforcement engine and the governance policy engine to
 * route emissions consistently.
 *
 * @module @nzila/governance-telemetry/events
 */
import type { GovernanceEventType, GovernanceSeverity } from './types'

export interface GovernanceEventDefinition {
  readonly type: GovernanceEventType
  readonly severityFloor: GovernanceSeverity
  /** Doctrine domain this event speaks to. Used for routing to dashboards. */
  readonly domain:
    | 'doctrine'
    | 'continuity'
    | 'cognitive-safety'
    | 'ai'
    | 'deployment'
    | 'governance-lifecycle'
    | 'modernization'
}

const DEFINITIONS: readonly GovernanceEventDefinition[] = [
  // doctrine enforcement
  { type: 'doctrine_violation', severityFloor: 'warning', domain: 'doctrine' },
  { type: 'governance_warning', severityFloor: 'warning', domain: 'doctrine' },
  { type: 'continuity_risk_detected', severityFloor: 'warning', domain: 'continuity' },
  { type: 'executive_cognitive_overload_risk', severityFloor: 'warning', domain: 'cognitive-safety' },
  { type: 'deployment_legitimacy_failure', severityFloor: 'critical', domain: 'deployment' },
  { type: 'pilot_boundary_violation', severityFloor: 'critical', domain: 'doctrine' },
  { type: 'governance_safe_ai_violation', severityFloor: 'critical', domain: 'ai' },
  // continuity observability
  { type: 'continuity_posture_changed', severityFloor: 'info', domain: 'continuity' },
  { type: 'governance_friction_detected', severityFloor: 'warning', domain: 'continuity' },
  { type: 'calmness_degradation_signal', severityFloor: 'warning', domain: 'continuity' },
  { type: 'pacing_violation', severityFloor: 'warning', domain: 'cognitive-safety' },
  { type: 'density_threshold_exceeded', severityFloor: 'warning', domain: 'cognitive-safety' },
  { type: 'escalation_concentration_detected', severityFloor: 'warning', domain: 'cognitive-safety' },
  // AI runtime validation
  { type: 'ai_explainability_failure', severityFloor: 'critical', domain: 'ai' },
  { type: 'governance_safe_ai_warning', severityFloor: 'warning', domain: 'ai' },
  { type: 'human_oversight_violation', severityFloor: 'critical', domain: 'ai' },
  { type: 'opaque_recommendation_detected', severityFloor: 'warning', domain: 'ai' },
  // deployment legitimacy
  { type: 'unknown_release_state', severityFloor: 'critical', domain: 'deployment' },
  { type: 'environment_drift_detected', severityFloor: 'critical', domain: 'deployment' },
  { type: 'deployment_identity_failure', severityFloor: 'critical', domain: 'deployment' },
  { type: 'migration_parity_failure', severityFloor: 'critical', domain: 'deployment' },
  { type: 'isolation_violation', severityFloor: 'critical', domain: 'deployment' },
  { type: 'environment_identity_verified', severityFloor: 'info', domain: 'deployment' },
  // governance lifecycle
  { type: 'governance_review_recorded', severityFloor: 'info', domain: 'governance-lifecycle' },
  { type: 'governance_decision_emitted', severityFloor: 'info', domain: 'governance-lifecycle' },
  { type: 'assurance_posture_updated', severityFloor: 'info', domain: 'governance-lifecycle' },
  // modernization
  { type: 'modernization_pace_violation', severityFloor: 'warning', domain: 'modernization' },
  { type: 'irreversible_change_detected', severityFloor: 'critical', domain: 'modernization' },
]

const REGISTRY: ReadonlyMap<GovernanceEventType, GovernanceEventDefinition> = new Map(
  DEFINITIONS.map((d) => [d.type, d]),
)

export function getEventDefinition(
  type: GovernanceEventType,
): GovernanceEventDefinition {
  const def = REGISTRY.get(type)
  if (!def) {
    throw new Error(
      `Unknown governance event type: ${String(type)}. Update the canonical taxonomy in @nzila/governance-telemetry.`,
    )
  }
  return def
}

export function listEventDefinitions(): readonly GovernanceEventDefinition[] {
  return DEFINITIONS
}

const SEVERITY_RANK: Readonly<Record<GovernanceSeverity, number>> = {
  info: 0,
  warning: 1,
  critical: 2,
}

/**
 * Reject events whose severity is lower than the registered floor for their type.
 * This guards against silent severity downgrade ("just log it as info").
 */
export function meetsSeverityFloor(
  type: GovernanceEventType,
  severity: GovernanceSeverity,
): boolean {
  const def = getEventDefinition(type)
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[def.severityFloor]
}
