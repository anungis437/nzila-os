/**
 * GES Level 5 Probe Registry — direct extraction support for the eighth
 * signals listed in docs/oci/superseded/audit/GES_LEVEL_5_SIGNAL_MODEL.md.
 *
 * Closes audit Finding E-1: GES Level 5 previously had no direct probe.
 * Each probe references a v2 modality question (or a documented composite
 * inference) that produces the Level-5 input.
 */

export type GesLevel5SignalId =
  | 'governance_self_healing'
  | 'successor_operational_autonomy'
  | 'institutional_memory_redundancy'
  | 'cross_functional_continuity_resilience'
  | 'continuity_transfer_survivability'
  | 'governance_reconstruction_independence'
  | 'modernization_continuity_resilience'
  | 'procedural_inheritance_durability';

export interface GesLevel5Probe {
  signal: GesLevel5SignalId;
  /** Reviewer-facing description of what this Level-5 signal asserts. */
  assertion: string;
  /** v2 question ids that contribute extraction for this signal. */
  contributingQuestionIds: ReadonlyArray<string>;
  /** Evidence levels that must be reached for the signal to be considered "evidenced". */
  evidenceFloor: 'OPERATIONAL' | 'VERIFIED' | 'CROSS_VALIDATED';
  /** Whether this signal is risk-inverted (higher input = MORE fragility). */
  riskInverted: boolean;
  rationale: string;
}

export const GES_LEVEL_5_PROBES: readonly GesLevel5Probe[] = [
  {
    signal: 'governance_self_healing',
    assertion:
      'The institution recovers from governance interpretive drift without external intervention.',
    contributingQuestionIds: [
      'v2_cp_governance_interpretation',
      'v2_sm_governance_interpretation_through_transition',
    ],
    evidenceFloor: 'OPERATIONAL',
    riskInverted: false,
    rationale: 'Self-healing is reached when documented and interpreted-consistently both hold.',
  },
  {
    signal: 'successor_operational_autonomy',
    assertion:
      'New senior leaders achieve independent operational effectiveness without informal apprenticeship.',
    contributingQuestionIds: ['v2_cp_onboarding_durability', 'v2_es_succession_plan'],
    evidenceFloor: 'OPERATIONAL',
    riskInverted: false,
    rationale: 'Successor autonomy is reached when documented onboarding pairs with rapid independence.',
  },
  {
    signal: 'institutional_memory_redundancy',
    assertion:
      'Critical institutional knowledge is distributed across functions, not concentrated in single stewards.',
    contributingQuestionIds: [
      'v2_cd_stewardship_concentration',
      'v2_cp_stewardship_recoverability',
    ],
    evidenceFloor: 'OPERATIONAL',
    riskInverted: false,
    rationale: 'Distribution + recoverability under absence jointly evidence redundancy.',
  },
  {
    signal: 'cross_functional_continuity_resilience',
    assertion:
      'Continuity holds across functional boundaries, not only within single units.',
    contributingQuestionIds: ['v2_tm_continuity_centrality', 'v2_dm_governance_operational_dependency'],
    evidenceFloor: 'OPERATIONAL',
    riskInverted: false,
    rationale: 'Topology + dependency mapping jointly evidence cross-functional resilience.',
  },
  {
    signal: 'continuity_transfer_survivability',
    assertion:
      'Continuity practices survive transfers of senior responsibility intact, with no significant re-interpretation cycle.',
    contributingQuestionIds: [
      'v2_sm_governance_interpretation_through_transition',
      'v2_te_leadership_exposure_window',
    ],
    evidenceFloor: 'OPERATIONAL',
    riskInverted: false,
    rationale: 'Stability marker + exposure window jointly evidence transfer survivability.',
  },
  {
    signal: 'governance_reconstruction_independence',
    assertion:
      'Governance rationale can be reconstructed without consulting those who originally produced it.',
    contributingQuestionIds: ['v2_cm_reconstruction_confidence', 'v2_es_continuity_policy'],
    evidenceFloor: 'VERIFIED',
    riskInverted: false,
    rationale: 'Reconstruction-confidence + policy evidence at VERIFIED jointly evidence independence.',
  },
  {
    signal: 'modernization_continuity_resilience',
    assertion:
      'Modernization decisions over the most recent cycle preserved continuity rather than eroding it.',
    contributingQuestionIds: ['v2_cm_modernization_uncertainty'],
    evidenceFloor: 'OPERATIONAL',
    riskInverted: false,
    rationale:
      'Confidence-marker is the leading signal; v1.3.0 adds structural complements from MODERNIZATION_INSTABILITY_SIGNAL_MODEL.md.',
  },
  {
    signal: 'procedural_inheritance_durability',
    assertion:
      'Operational procedures persist through transitions without silent reinvention.',
    contributingQuestionIds: [
      'v2_sm_governance_interpretation_through_transition',
      'v2_cd_stewardship_concentration',
    ],
    evidenceFloor: 'OPERATIONAL',
    riskInverted: false,
    rationale: 'Stability marker + low stewardship concentration jointly evidence inheritance durability.',
  },
];
