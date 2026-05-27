/**
 * v2 Modality Registry — initial wave of new-modality questions.
 *
 * This wave does NOT replace the v1 question bank; it is the staging
 * registry that the routing engine and signal-integrity tests consume
 * to validate the v2 modality infrastructure. The QUESTION_POOL_v2_0
 * roadmap defines the integration waves that fold these (and subsequent
 * additions) into the active OCRA flow.
 *
 * Strict invariants enforced by tests:
 *   - every modality has >= 1 representative question
 *   - no prompt names individuals
 *   - every question carries `intelligence.deepens` declaring its
 *     adaptive-routing fingerprint
 *   - contradiction pairs reference one another via stable `pairId`
 */
import type {
  V2Question,
  ContradictionPairQuestion,
  EvidenceStrengthQuestion,
  ContinuityDistributionQuestion,
  DependencyMappingQuestion,
  ConfidenceMarkerQuestion,
  TopologyMappingQuestion,
  StabilityMarkerQuestion,
  TransitionExposureQuestion,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. contradiction_pair — three pairs covering the highest-value
//    declared-vs-evidenced gaps identified in the audit.
// ─────────────────────────────────────────────────────────────────────────────

const CONTRADICTION_PAIRS: ContradictionPairQuestion[] = [
  {
    id: 'v2_cp_onboarding_durability',
    modality: 'contradiction_pair',
    section: 'transition_readiness',
    pairId: 'pair_onboarding_durability',
    prompt:
      'Comparing the onboarding experience your organization declares with the operational experience successors actually face.',
    signalA: {
      statement: 'Our organization maintains documented onboarding pathways for senior operational roles.',
      affirmIf: 'true',
    },
    signalB: {
      statement:
        'New senior leaders consistently reach independent operational effectiveness within the first 30 working days after handover.',
      affirmIf: 'true',
    },
    contradictionSeverity: 'high',
    weights: { transition_readiness: 1.0, institutional_continuity: 0.6 },
    rationale:
      'Declared onboarding pathways without rapid successor independence indicates institutional memory bottlenecks invisible to documentation.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['onboarding_confidence', 'reconstruction_confidence'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
      deepens: ['onboarding_survivability', 'contradiction_resolution', 'confidence_escalation'],
    },
  },
  {
    id: 'v2_cp_governance_interpretation',
    modality: 'contradiction_pair',
    section: 'governance_visibility',
    pairId: 'pair_governance_interpretation',
    prompt:
      'Comparing whether governance decisions are documented with whether their interpretation is consistent across the institution.',
    signalA: {
      statement: 'Governance decisions are documented with the rationale needed to understand them later.',
      affirmIf: 'true',
    },
    signalB: {
      statement:
        'Different departments and committees apply those decisions consistently without recurring re-interpretation cycles.',
      affirmIf: 'true',
    },
    contradictionSeverity: 'critical',
    weights: { institutional_continuity: 0.8, governance_fragility: 0.8 },
    riskInverted: false,
    rationale:
      'Documented governance without interpretive consistency indicates structural fragmentation that maturity ladders cannot surface.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['governance_sophistication'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['governance_fragility', 'contradiction_resolution', 'federated_governance'],
    },
  },
  {
    id: 'v2_cp_undocumented_workflow_replacement',
    modality: 'contradiction_pair',
    section: 'sovereignty_governance',
    pairId: 'pair_undocumented_workflow_replacement',
    prompt:
      'Comparing whether workflow replacement during modernization is documented with whether operational teams can execute the replacement without informal reconstruction.',
    signalA: {
      statement:
        'Workflow replacements introduced by modernization are documented with institutional context and decision rationale.',
      affirmIf: 'true',
    },
    signalB: {
      statement:
        'Operational teams can execute those replacements without relying on long-tenured staff for hidden procedural context.',
      affirmIf: 'true',
    },
    contradictionSeverity: 'high',
    weights: { institutional_continuity: 0.8, operational_memory: 0.8, trust_debt: 0.4 },
    rationale:
      'Documented replacement that still requires hidden reconstruction indicates modernization continuity debt.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['modernization_continuity', 'reconstruction_confidence'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['modernization_fragility', 'contradiction_resolution', 'confidence_escalation'],
    },
  },
  {
    id: 'v2_cp_modernization_onboarding_burden',
    modality: 'contradiction_pair',
    section: 'transition_readiness',
    pairId: 'pair_modernization_onboarding_burden',
    prompt:
      'Comparing whether modernization onboarding pathways are documented with whether successors can assume operational responsibility without prolonged shadow apprenticeship.',
    signalA: {
      statement:
        'Modernization-era onboarding pathways for key roles are documented and maintained.',
      affirmIf: 'true',
    },
    signalB: {
      statement:
        'Successors consistently assume operational responsibility without prolonged shadow apprenticeship after modernization changes.',
      affirmIf: 'true',
    },
    contradictionSeverity: 'high',
    weights: { transition_readiness: 0.9, institutional_continuity: 0.7, trust_debt: 0.4 },
    rationale:
      'Documented onboarding that still depends on long informal apprenticeship indicates modernization onboarding burden.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['onboarding_confidence', 'modernization_continuity'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
      deepens: ['modernization_fragility', 'onboarding_survivability', 'contradiction_resolution'],
    },
  },
  {
    id: 'v2_cp_stewardship_recoverability',
    modality: 'contradiction_pair',
    section: 'operational_dependency',
    pairId: 'pair_stewardship_recoverability',
    prompt:
      'Comparing where critical knowledge is held with whether the institution recovers when stewardship-holders are absent.',
    signalA: {
      statement: 'Critical institutional knowledge is concentrated with a small number of long-tenured stewards.',
      affirmIf: 'true',
    },
    signalB: {
      statement:
        'Operational recovery remains intact during extended absence of those steward roles, without heroic compensation by others.',
      affirmIf: 'true',
    },
    contradictionSeverity: 'high',
    weights: { institutional_continuity: 0.9, operational_memory: 0.9 },
    rationale:
      'Concentrated stewardship paired with reported recoverability is the classic invisible-continuity-burden contradiction.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['recoverability_confidence', 'continuity_maturity'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
      deepens: ['continuity_dependency', 'contradiction_resolution', 'confidence_escalation'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. evidence_strength
// ─────────────────────────────────────────────────────────────────────────────

const EVIDENCE_STRENGTHS: EvidenceStrengthQuestion[] = [
  {
    id: 'v2_es_continuity_policy',
    modality: 'evidence_strength',
    section: 'governance_visibility',
    prompt:
      'What is the strongest level of evidence your organization can show for its continuity policy?',
    helpText:
      'Choose the highest level that honestly applies. Levels are cumulative — a higher level implies the lower levels also hold.',
    subjectOfClaim: 'continuity policy',
    branchOn: [
      { minLevel: 'DOCUMENTED', enables: ['v2_es_continuity_policy_operational_use'] },
      { minLevel: 'OPERATIONAL', enables: ['v2_es_continuity_policy_verification'] },
    ],
    weights: { institutional_continuity: 0.8, governance_fragility: 0.6 },
    rationale:
      'The evidence ladder separates declared continuity from evidenced continuity — the central audit-defensibility distinction.',
    intelligence: {
      modalityRole: 'structural_pattern',
      intelligenceContribution: ['governance_sophistication', 'continuity_maturity'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['governance_fragility', 'confidence_escalation'],
    },
  },
  {
    id: 'v2_es_ownership_ambiguity',
    modality: 'evidence_strength',
    section: 'sovereignty_governance',
    prompt:
      'What is the strongest level of evidence your organization can show that continuity ownership is explicitly assigned during modernization decisions?',
    subjectOfClaim:
      'explicit continuity ownership assignment in modernization decisions',
    branchOn: [
      { minLevel: 'DOCUMENTED', enables: ['v2_es_ownership_ambiguity_operational_use'] },
      { minLevel: 'OPERATIONAL', enables: ['v2_es_ownership_ambiguity_verification'] },
    ],
    weights: { institutional_continuity: 0.8, governance_fragility: 0.5, trust_debt: 0.5 },
    rationale:
      'Ownership ambiguity is a primary modernization fragility driver; evidence depth distinguishes declared ownership from operational ownership.',
    intelligence: {
      modalityRole: 'structural_pattern',
      intelligenceContribution: ['governance_sophistication', 'modernization_continuity'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['modernization_fragility', 'confidence_escalation'],
    },
  },
  {
    id: 'v2_es_succession_plan',
    modality: 'evidence_strength',
    section: 'transition_readiness',
    prompt:
      'What is the strongest level of evidence available for the succession plan covering your most operationally critical role?',
    subjectOfClaim: 'succession plan for the most operationally critical role',
    branchOn: [
      { minLevel: 'DOCUMENTED', enables: ['v2_es_succession_operational_use'] },
      { minLevel: 'VERIFIED', enables: ['v2_es_succession_cross_validation'] },
    ],
    weights: { transition_readiness: 1.0, institutional_continuity: 0.6 },
    rationale:
      'Succession evidence depth is a primary discriminator between fragile and resilient continuity.',
    intelligence: {
      modalityRole: 'structural_pattern',
      intelligenceContribution: ['onboarding_confidence', 'reconstruction_confidence'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
      deepens: ['onboarding_survivability', 'confidence_escalation'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. continuity_distribution
// ─────────────────────────────────────────────────────────────────────────────

const CONTINUITY_DISTRIBUTIONS: ContinuityDistributionQuestion[] = [
  {
    id: 'v2_cd_stewardship_concentration',
    modality: 'continuity_distribution',
    section: 'operational_dependency',
    prompt:
      'Distribute 100 points across these institutional functions to reflect where continuity knowledge is concentrated today.',
    helpText:
      'Functions, not people. If you cannot meaningfully distinguish, allocate evenly across functions that genuinely share the load.',
    bins: [
      { id: 'executive_office', label: 'Executive office', rationale: 'Leadership stewardship.' },
      { id: 'governance_body', label: 'Governance body', rationale: 'Board / committee memory.' },
      { id: 'operations_unit', label: 'Operations unit', rationale: 'Day-to-day continuity practice.' },
      { id: 'member_services', label: 'Member services', rationale: 'Front-line institutional context.' },
      { id: 'finance_admin', label: 'Finance & administration', rationale: 'Procedural and record memory.' },
      { id: 'long_tenured_staff', label: 'Long-tenured staff (any role)', rationale: 'Implicit institutional memory.' },
    ],
    weights: { institutional_continuity: 0.7, operational_memory: 0.9 },
    rationale:
      'Distribution reveals continuity concentration patterns invisible to maturity ladders.',
    intelligence: {
      modalityRole: 'topology_pattern',
      intelligenceContribution: ['stewardship_distribution', 'continuity_maturity'],
      longitudinalValue: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: false,
      deepens: ['continuity_dependency'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. dependency_mapping
// ─────────────────────────────────────────────────────────────────────────────

const DEPENDENCY_MAPS: DependencyMappingQuestion[] = [
  {
    id: 'v2_dm_platform_migration_dependency',
    modality: 'dependency_mapping',
    section: 'sovereignty_governance',
    prompt:
      'Declare the strongest dependencies introduced by platform migration between institutional functions.',
    helpText:
      'A dependency means continuity of the destination function now relies on migration outputs or controls from the source function. Up to six edges.',
    fromNodes: [
      { id: 'platform_program', label: 'Platform modernization program' },
      { id: 'enterprise_architecture', label: 'Enterprise architecture' },
      { id: 'vendor_management', label: 'Vendor and contract management' },
    ],
    toNodes: [
      { id: 'governance_record', label: 'Governance record continuity' },
      { id: 'operational_handover', label: 'Operational handover continuity' },
      { id: 'member_service_integrity', label: 'Member service continuity' },
      { id: 'policy_replay', label: 'Policy replay and interpretation continuity' },
    ],
    maxEdges: 6,
    weights: { institutional_continuity: 0.7, governance_fragility: 0.7, trust_debt: 0.4 },
    rationale:
      'Platform migration introduces hidden continuity dependencies; mapping them is required to surface modernization fragility topology.',
    intelligence: {
      modalityRole: 'topology_pattern',
      intelligenceContribution: ['structural_topology', 'modernization_continuity'],
      longitudinalValue: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: true,
      deepens: ['modernization_fragility', 'federated_governance', 'continuity_dependency'],
    },
  },
  {
    id: 'v2_dm_governance_operational_dependency',
    modality: 'dependency_mapping',
    section: 'governance_visibility',
    prompt:
      'Declare the strongest dependencies between governance functions and operational functions in your institution.',
    helpText:
      'A dependency means the "to" function cannot proceed reliably without input or sign-off from the "from" function. Up to five edges.',
    fromNodes: [
      { id: 'board', label: 'Governance body' },
      { id: 'exec_office', label: 'Executive office' },
      { id: 'committees', label: 'Standing committees' },
    ],
    toNodes: [
      { id: 'ops_decisions', label: 'Operational decisions' },
      { id: 'member_decisions', label: 'Member-facing decisions' },
      { id: 'financial_authorizations', label: 'Financial authorizations' },
      { id: 'policy_interpretation', label: 'Policy interpretation' },
    ],
    maxEdges: 5,
    weights: { institutional_continuity: 0.6, governance_fragility: 0.8 },
    rationale:
      'Dependency edges form the substrate of topology graph extraction.',
    intelligence: {
      modalityRole: 'topology_pattern',
      intelligenceContribution: ['structural_topology', 'governance_sophistication'],
      longitudinalValue: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: true,
      deepens: ['governance_fragility', 'federated_governance'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. confidence_marker
// ─────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_MARKERS: ConfidenceMarkerQuestion[] = [
  {
    id: 'v2_cm_reconstruction_confidence',
    modality: 'confidence_marker',
    section: 'institutional_memory',
    prompt:
      'How confident are you that your institution could reconstruct the rationale behind its current operating posture if the people who shaped it were unavailable?',
    statement:
      'The institution could reconstruct the rationale behind its current operating posture without the people who shaped it.',
    scale: {
      min: 1,
      max: 5,
      minLabel: 'Not at all confident',
      maxLabel: 'Highly confident',
    },
    allowUncertaintyMarker: true,
    weights: { institutional_continuity: 0.7, operational_memory: 0.9 },
    rationale:
      'Reconstruction confidence is a direct GES-Level-5 signal.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['reconstruction_confidence', 'survivability_perception'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
      deepens: ['confidence_escalation', 'continuity_dependency'],
    },
  },
  {
    id: 'v2_cm_shadow_operational_systems',
    modality: 'confidence_marker',
    section: 'operational_dependency',
    prompt:
      'How confident are you that shadow operational systems are not carrying critical continuity load outside governed pathways?',
    statement:
      'Shadow operational systems are not carrying critical continuity load outside governed pathways.',
    scale: {
      min: 1,
      max: 5,
      minLabel: 'Not at all confident',
      maxLabel: 'Highly confident',
    },
    allowUncertaintyMarker: true,
    weights: { institutional_continuity: 0.6, governance_fragility: 0.6, trust_debt: 0.5 },
    rationale:
      'Shadow systems are a high-signal modernization fragility marker and a common source of hidden trust debt.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['modernization_continuity', 'operational_clarity'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['modernization_fragility', 'confidence_escalation', 'continuity_dependency'],
    },
  },
  {
    id: 'v2_cm_modernization_uncertainty',
    modality: 'confidence_marker',
    section: 'sovereignty_governance',
    prompt:
      'How confident are you that modernization decisions made over the last two years preserved — rather than eroded — institutional continuity?',
    statement:
      'Modernization decisions made over the last two years preserved institutional continuity.',
    scale: {
      min: 1,
      max: 5,
      minLabel: 'Not at all confident',
      maxLabel: 'Highly confident',
    },
    allowUncertaintyMarker: true,
    weights: { institutional_continuity: 0.7, trust_debt: 0.6 },
    rationale:
      'Modernization-continuity confidence is the leading signal of modernization fragility.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['modernization_continuity', 'survivability_perception'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['modernization_fragility', 'confidence_escalation'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. topology_mapping
// ─────────────────────────────────────────────────────────────────────────────

const TOPOLOGY_MAPS: TopologyMappingQuestion[] = [
  {
    id: 'v2_tm_digital_continuity_fragmentation',
    modality: 'topology_mapping',
    section: 'sovereignty_governance',
    prompt:
      'Place each modernization domain by continuity-fragmentation risk (x) versus institutional integration depth (y).',
    axes: {
      x: {
        id: 'fragmentation',
        label: 'Digital continuity fragmentation risk',
        minLabel: 'Low fragmentation',
        maxLabel: 'High fragmentation',
      },
      y: {
        id: 'integration_depth',
        label: 'Institutional integration depth',
        minLabel: 'Isolated',
        maxLabel: 'Institutionally integrated',
      },
    },
    nodes: [
      { id: 'member_platforms', label: 'Member-facing platforms' },
      { id: 'governance_systems', label: 'Governance systems' },
      { id: 'operations_backbone', label: 'Operations backbone' },
      { id: 'records_systems', label: 'Records and archive systems' },
      { id: 'identity_access', label: 'Identity and access systems' },
    ],
    weights: { institutional_continuity: 0.7, operational_memory: 0.6, trust_debt: 0.3 },
    rationale:
      'Digital continuity fragmentation topology reveals modernization failure modes that maturity ladders flatten.',
    intelligence: {
      modalityRole: 'topology_pattern',
      intelligenceContribution: ['structural_topology', 'modernization_continuity'],
      longitudinalValue: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: true,
      deepens: ['modernization_fragility', 'continuity_dependency', 'federated_governance'],
    },
  },
  {
    id: 'v2_tm_continuity_centrality',
    modality: 'topology_mapping',
    section: 'operational_dependency',
    prompt:
      'Place each function on the grid by how centralized continuity knowledge is for it (x) versus how distributed operational practice is (y).',
    axes: {
      x: { id: 'centrality', label: 'Continuity-knowledge centrality', minLabel: 'Distributed', maxLabel: 'Highly centralized' },
      y: { id: 'distributedness', label: 'Operational practice distributedness', minLabel: 'Single locus', maxLabel: 'Broadly distributed' },
    },
    nodes: [
      { id: 'executive_office', label: 'Executive office' },
      { id: 'governance_body', label: 'Governance body' },
      { id: 'operations_unit', label: 'Operations unit' },
      { id: 'member_services', label: 'Member services' },
      { id: 'finance_admin', label: 'Finance & administration' },
    ],
    weights: { institutional_continuity: 0.6, operational_memory: 0.7 },
    rationale:
      'Two-dimensional placement reveals continuity bottlenecks invisible to single-variable ladders.',
    intelligence: {
      modalityRole: 'topology_pattern',
      intelligenceContribution: ['structural_topology', 'stewardship_distribution'],
      longitudinalValue: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: false,
      deepens: ['continuity_dependency'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 7. stability_marker
// ─────────────────────────────────────────────────────────────────────────────

const STABILITY_MARKERS: StabilityMarkerQuestion[] = [
  {
    id: 'v2_sm_continuity_debt_accumulation',
    modality: 'stability_marker',
    section: 'sovereignty_governance',
    prompt:
      'Across your most recent modernization cycle, did continuity debt decrease, hold, or accumulate?',
    statement:
      'Continuity debt decreased or remained controlled across the most recent modernization cycle.',
    options: [
      { value: 'held', label: 'Decreased or remained controlled', score: 1.0 },
      { value: 'partially_held', label: 'Partially controlled with localized debt growth', score: 0.5 },
      { value: 'broke', label: 'Accumulated significantly across multiple domains', score: 0.0 },
      { value: 'no_recent_transition', label: 'No recent modernization cycle to assess', score: 0.5 },
    ],
    weights: { institutional_continuity: 0.7, trust_debt: 0.7 },
    rationale:
      'Continuity debt accumulation is a direct modernization fragility stability marker.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['modernization_continuity', 'survivability_perception'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['modernization_fragility', 'confidence_escalation', 'onboarding_survivability'],
    },
  },
  {
    id: 'v2_sm_governance_interpretation_through_transition',
    modality: 'stability_marker',
    section: 'governance_visibility',
    prompt:
      'Across your most recent leadership transition at any seniority, has the institution\'s interpretation of governance decisions held, partially held, or broken?',
    statement:
      'Interpretation of governance decisions held across the most recent leadership transition.',
    options: [
      { value: 'held', label: 'Held — interpretation remained consistent', score: 1.0 },
      { value: 'partially_held', label: 'Partially held — some re-interpretation required', score: 0.5 },
      { value: 'broke', label: 'Broke — significant re-interpretation cycles followed', score: 0.0 },
      { value: 'no_recent_transition', label: 'No recent transition to assess', score: 0.5 },
    ],
    weights: { institutional_continuity: 0.7, governance_fragility: 0.7 },
    rationale:
      'Stability under transition is the most direct continuity-survivability signal.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['governance_sophistication', 'survivability_perception'],
      longitudinalValue: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
      deepens: ['governance_fragility', 'onboarding_survivability'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 8. transition_exposure
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITION_EXPOSURES: TransitionExposureQuestion[] = [
  {
    id: 'v2_te_leadership_exposure_window',
    modality: 'transition_exposure',
    section: 'transition_readiness',
    prompt:
      'For the past twelve months and the next twelve months combined, identify which categories of role have undergone, or are expected to undergo, transition.',
    helpText:
      'Categories of role, not named individuals. Select all that apply.',
    window: 'past_and_next_12_months',
    categories: [
      { id: 'executive_leadership', label: 'Executive leadership' },
      { id: 'board_chair', label: 'Board chair' },
      { id: 'governance_committee_chair', label: 'Governance committee chair' },
      { id: 'operations_lead', label: 'Operations lead' },
      { id: 'finance_lead', label: 'Finance lead' },
      { id: 'long_tenured_steward_role', label: 'Long-tenured steward role of any kind' },
    ],
    weights: { transition_readiness: 1.0, institutional_continuity: 0.5 },
    rationale:
      'Exposure window calibrates the urgency of all transition-related signals.',
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['onboarding_confidence', 'survivability_perception'],
      longitudinalValue: 'medium',
      confidenceSensitivity: false,
      governanceSensitivity: false,
      deepens: ['onboarding_survivability', 'continuity_dependency'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Consolidated v2 registry
// ─────────────────────────────────────────────────────────────────────────────

export const V2_QUESTIONS: readonly V2Question[] = [
  ...CONTRADICTION_PAIRS,
  ...EVIDENCE_STRENGTHS,
  ...CONTINUITY_DISTRIBUTIONS,
  ...DEPENDENCY_MAPS,
  ...CONFIDENCE_MARKERS,
  ...TOPOLOGY_MAPS,
  ...STABILITY_MARKERS,
  ...TRANSITION_EXPOSURES,
];

export const V2_REGISTRY_VERSION = '1.3.0-modernization-fragility' as const;
