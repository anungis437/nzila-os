/**
 * Routing v2 — adaptive path-type definitions.
 *
 * Closes audit Finding R-1: the v1 routing engine was functionally inert.
 * v2 introduces named routing paths that *deepen* extraction when
 * institutional fragility is detected, rather than merely skipping
 * questions to compress survey length.
 *
 * Doctrine (verbatim from sprint brief): "Adaptive routing should now
 * deepen extraction where fragility is detected." See
 * docs/oci/superseded/audit/QUESTION_POOL_v2_0_ROADMAP.md.
 */

import type { V2Question } from '../modalities-v2/types';

export type RoutingPathId =
  | 'governance_fragility_path'
  | 'modernization_fragility_path'
  | 'confidence_escalation_path'
  | 'continuity_dependency_path'
  | 'federated_governance_path'
  | 'onboarding_survivability_path'
  | 'contradiction_resolution_path';

export interface RoutingPathDefinition {
  id: RoutingPathId;
  /** Reviewer-facing description. */
  description: string;
  /**
   * Detection criteria — what observable institutional signal activates
   * this path. Declarative; the routing engine evaluates against the
   * accumulated answer set so far.
   */
  activatedWhen: string;
  /**
   * The v2 question modalities this path adds when activated. Ordered;
   * later entries are surfaced only after earlier ones are answered.
   * Filtering by deepens-tag is performed at runtime.
   */
  deepensWith: ReadonlyArray<V2Question['intelligence']['deepens'][number]>;
  /** Whether activation should also bump the question's confidence-escalation flag. */
  raisesConfidenceFloor: boolean;
}

export const ROUTING_PATHS: readonly RoutingPathDefinition[] = [
  {
    id: 'governance_fragility_path',
    description:
      'Activated when governance documentation is high but interpretive consistency or evidence depth is low. Deepens into evidence and contradiction modalities.',
    activatedWhen:
      'declared governance maturity >= Structured AND (interpretive_consistency_signal < 0.6 OR evidence_strength_for_governance < OPERATIONAL)',
    deepensWith: ['governance_fragility', 'contradiction_resolution', 'confidence_escalation'],
    raisesConfidenceFloor: true,
  },
  {
    id: 'modernization_fragility_path',
    description:
      'Activated when modernization activity is present but continuity-preservation confidence is low.',
    activatedWhen:
      'transition_exposure includes long_tenured_steward_role OR modernization_uncertainty_marker <= 2',
    deepensWith: ['modernization_fragility', 'confidence_escalation'],
    raisesConfidenceFloor: true,
  },
  {
    id: 'confidence_escalation_path',
    description:
      'Activated when respondent flags uncertainty on a confidence_marker. Surfaces additional evidence-strength prompts.',
    activatedWhen: 'any confidence_marker answered with uncertainty marker',
    deepensWith: ['confidence_escalation'],
    raisesConfidenceFloor: true,
  },
  {
    id: 'continuity_dependency_path',
    description:
      'Activated when distribution or topology signals indicate concentration. Surfaces dependency mapping and contradiction probes.',
    activatedWhen:
      'continuity_distribution shows top-bin allocation >= 50 OR topology placement clusters high-centrality nodes',
    deepensWith: ['continuity_dependency', 'contradiction_resolution'],
    raisesConfidenceFloor: false,
  },
  {
    id: 'federated_governance_path',
    description:
      'Activated when the institution declares federated governance OR multi-jurisdictional scope. Surfaces dependency mapping at federation-level granularity.',
    activatedWhen:
      'organizationContext.federationAffiliation present OR governanceModel === hybrid',
    deepensWith: ['federated_governance', 'governance_fragility'],
    raisesConfidenceFloor: false,
  },
  {
    id: 'onboarding_survivability_path',
    description:
      'Activated when transition_exposure for executive or steward roles is non-empty. Surfaces succession-evidence and contradiction probes.',
    activatedWhen:
      'transition_exposure includes executive_leadership OR long_tenured_steward_role',
    deepensWith: ['onboarding_survivability', 'contradiction_resolution'],
    raisesConfidenceFloor: true,
  },
  {
    id: 'contradiction_resolution_path',
    description:
      'Activated when any contradiction_pair fires. Surfaces evidence-strength prompts to support reviewer resolution.',
    activatedWhen: 'any contradiction_pair detected with confidence >= 0.5',
    deepensWith: ['contradiction_resolution', 'confidence_escalation'],
    raisesConfidenceFloor: true,
  },
];
