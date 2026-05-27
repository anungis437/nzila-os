/**
 * Contradiction Signal Pairs — registry of declared-vs-evidenced pairs
 * the contradictionDetectionEngine evaluates against responses.
 *
 * Pairs live HERE (not only inside the question registry) so they can be
 * referenced by the evaluation engine independently of the question pool
 * evolving over time. Stable pairIds are the contract.
 */

export interface ContradictionPairDefinition {
  pairId: string;
  /** Doctrine name used in narrative emission. */
  name: string;
  /** Short institutional description — never names individuals. */
  description: string;
  /** Severity emitted when the pair is satisfied. */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Question ids whose joint affirmation defines the contradiction. */
  signalAQuestionId: string;
  signalBQuestionId: string;
  /** Dimensions whose confidence the engine must reduce when fired. */
  reducesConfidenceIn: ReadonlyArray<
    | 'institutional_continuity'
    | 'governance_fragility'
    | 'trust_debt'
    | 'operational_memory'
    | 'transition_readiness'
  >;
  /** Resolution surface — what facilitation step the engine recommends. */
  resolutionRequired: 'facilitation' | 'evidence_review' | 'reviewer_escalation';
}

export const CONTRADICTION_PAIRS: readonly ContradictionPairDefinition[] = [
  {
    pairId: 'pair_onboarding_durability',
    name: 'Declared onboarding vs successor independence',
    description:
      'Documented onboarding pathways exist, yet new senior leaders do not reach independent operational effectiveness within the first 30 working days.',
    severity: 'high',
    signalAQuestionId: 'v2_cp_onboarding_durability',
    signalBQuestionId: 'v2_cp_onboarding_durability',
    reducesConfidenceIn: ['transition_readiness', 'institutional_continuity', 'operational_memory'],
    resolutionRequired: 'facilitation',
  },
  {
    pairId: 'pair_governance_interpretation',
    name: 'Documented governance vs interpretive consistency',
    description:
      'Governance decisions are documented yet are not applied consistently across departments and committees.',
    severity: 'critical',
    signalAQuestionId: 'v2_cp_governance_interpretation',
    signalBQuestionId: 'v2_cp_governance_interpretation',
    reducesConfidenceIn: ['institutional_continuity', 'governance_fragility'],
    resolutionRequired: 'reviewer_escalation',
  },
  {
    pairId: 'pair_undocumented_workflow_replacement',
    name: 'Documented workflow replacement vs operational reconstructability',
    description:
      'Modernization workflow replacements are documented, yet teams still rely on hidden institutional memory to execute them reliably.',
    severity: 'high',
    signalAQuestionId: 'v2_cp_undocumented_workflow_replacement',
    signalBQuestionId: 'v2_cp_undocumented_workflow_replacement',
    reducesConfidenceIn: ['institutional_continuity', 'operational_memory', 'trust_debt'],
    resolutionRequired: 'evidence_review',
  },
  {
    pairId: 'pair_modernization_onboarding_burden',
    name: 'Documented modernization onboarding vs successor burden',
    description:
      'Modernization onboarding pathways are documented, yet successors still require prolonged informal apprenticeship before operating independently.',
    severity: 'high',
    signalAQuestionId: 'v2_cp_modernization_onboarding_burden',
    signalBQuestionId: 'v2_cp_modernization_onboarding_burden',
    reducesConfidenceIn: ['transition_readiness', 'institutional_continuity', 'trust_debt'],
    resolutionRequired: 'facilitation',
  },
  {
    pairId: 'pair_stewardship_recoverability',
    name: 'Concentrated stewardship vs reported recoverability',
    description:
      'Institutional knowledge is concentrated with a small number of stewards, yet recovery is reported as intact during their extended absence.',
    severity: 'high',
    signalAQuestionId: 'v2_cp_stewardship_recoverability',
    signalBQuestionId: 'v2_cp_stewardship_recoverability',
    reducesConfidenceIn: ['institutional_continuity', 'operational_memory'],
    resolutionRequired: 'evidence_review',
  },
];
