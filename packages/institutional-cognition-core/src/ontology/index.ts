/**
 * Institutional Ontology
 *
 * Shared semantic vocabulary for institutional operating intelligence.
 * Prevents semantic fragmentation across cognition domains.
 */

/**
 * Canonical institutional cognition domains.
 * Every cognition engine MUST declare which domain(s) it operates in.
 */
export const COGNITION_DOMAINS = [
  'governance',
  'continuity',
  'resilience',
  'procedural_intelligence',
  'operational_trust',
  'institutional_memory',
  'coordination',
  'adaptation',
  'precedent',
  'systems_coherence',
] as const;

export type CognitionDomain = (typeof COGNITION_DOMAINS)[number];

/**
 * Canonical institutional concepts. These are the building blocks of every
 * cognition contract. Domain engines MUST use these names — no synonyms,
 * no parallel taxonomies.
 */
export const INSTITUTIONAL_CONCEPTS = [
  'governance_action',
  'governance_review',
  'continuity_plan',
  'continuity_assessment',
  'mitigation_decision',
  'risk_response',
  'resilience_baseline',
  'precedent_record',
  'procedural_artifact',
  'trust_signal',
  'memory_capture',
  'adaptation_event',
  'coordination_session',
] as const;

export type InstitutionalConcept = (typeof INSTITUTIONAL_CONCEPTS)[number];

/**
 * Maturity ladder used uniformly across all cognition domains.
 */
export const MATURITY_LEVELS = ['emergent', 'developing', 'mature', 'advanced'] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];

/**
 * Trajectory descriptors for any longitudinal indicator.
 */
export const TRAJECTORY_LABELS = [
  'accelerating',
  'steady',
  'decelerating',
  'volatile',
  'stalled',
  'insufficient_history',
] as const;
export type TrajectoryLabel = (typeof TRAJECTORY_LABELS)[number];

/**
 * Severity ladder for institutional issues.
 */
export const SEVERITY_LEVELS = ['critical', 'high', 'moderate', 'low', 'informational'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

/**
 * Confidence band for cognition outputs.
 */
export const CONFIDENCE_BANDS = ['very_high', 'high', 'moderate', 'low', 'insufficient_data'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

/**
 * Resolves a 0-100 score to its canonical maturity level.
 */
export function maturityFromScore(score: number): MaturityLevel {
  if (score >= 80) return 'advanced';
  if (score >= 60) return 'mature';
  if (score >= 30) return 'developing';
  return 'emergent';
}

/**
 * Resolves a 0-100 confidence value to a canonical band.
 */
export function confidenceBandFromScore(score: number): ConfidenceBand {
  if (score <= 0) return 'insufficient_data';
  if (score >= 85) return 'very_high';
  if (score >= 65) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}
