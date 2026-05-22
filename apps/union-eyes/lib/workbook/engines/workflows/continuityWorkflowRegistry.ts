/**
 * ARTIFACT TYPE: Engine Helper (Workflow Registry)
 * MODULE: Stabilization Workflows (Product 3 / Operationalization)
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Workflow Registry — names the six canonical stabilization
 * workflows, their composed playbooks, the engines whose signals each
 * consumes, severity gates, and readiness conditions.
 *
 * This module is pure data. It introduces no analytics. It is the
 * machine-readable expression of the workflow docs under
 * docs/oci/stabilization/workflows/.
 *
 * Doctrine: docs/oci/stabilization/workflows/README.md and the six
 * workflow documents it indexes.
 */

export const ENGINE_VERSION = '2.0.0';

export type WorkflowKey =
  | 'continuity_capture'
  | 'governance_clarification'
  | 'stewardship_redistribution'
  | 'onboarding_stabilization'
  | 'modernization_remediation'
  | 'operational_reconstruction';

export type WorkflowSeverityFloor = 'moderate' | 'elevated';

export type WorkflowReadinessGate =
  | 'all_five_thresholds'
  | 'all_five_thresholds_plus_reciprocity_ratified'
  | 'all_five_thresholds_plus_historical_tenure_recognition';

export interface WorkflowStep {
  readonly stepKey: string;
  readonly position: 1 | 2 | 3 | 4 | 5 | 6;
  readonly reversibility: 'fully_reversible' | 'reversible_with_cost' | 'irreversible';
}

export interface WorkflowDefinition {
  readonly key: WorkflowKey;
  readonly title: string;
  readonly docPath: string;
  readonly playbookPaths: readonly string[];
  readonly composedEngines: readonly string[];
  readonly severityFloor: WorkflowSeverityFloor;
  readonly readiness: WorkflowReadinessGate;
  readonly steps: readonly WorkflowStep[];
  readonly persistenceTable: string;
}

export const CONTINUITY_WORKFLOW_REGISTRY: Readonly<Record<WorkflowKey, WorkflowDefinition>> = {
  continuity_capture: {
    key: 'continuity_capture',
    title: 'Continuity Capture',
    docPath: 'docs/oci/stabilization/workflows/CONTINUITY_CAPTURE_WORKFLOW.md',
    playbookPaths: ['docs/oci/stabilization/playbooks/CONTINUITY_CAPTURE_SPRINT.md'],
    composedEngines: [
      'stabilizationPriorityEngine',
      'continuityRedistributionPlanner',
      'onboardingFragilityAnalysis',
    ],
    severityFloor: 'elevated',
    readiness: 'all_five_thresholds',
    steps: [
      { stepKey: 'capture.scope_with_steward', position: 1, reversibility: 'fully_reversible' },
      { stepKey: 'capture.practice_walkthrough', position: 2, reversibility: 'fully_reversible' },
      { stepKey: 'capture.written_draft', position: 3, reversibility: 'reversible_with_cost' },
      { stepKey: 'capture.candidate_review', position: 4, reversibility: 'reversible_with_cost' },
      { stepKey: 'capture.governance_ratification', position: 5, reversibility: 'irreversible' },
    ],
    persistenceTable: 'oci_workflow_continuity_capture',
  },
  governance_clarification: {
    key: 'governance_clarification',
    title: 'Governance Clarification',
    docPath: 'docs/oci/stabilization/workflows/GOVERNANCE_CLARIFICATION_WORKFLOW.md',
    playbookPaths: ['docs/oci/stabilization/playbooks/GOVERNANCE_LINEAGE_RECOVERY.md'],
    composedEngines: [
      'continuityLineageEngine',
      'governanceRecoveryEngine',
      'governanceEntropyEngine',
    ],
    severityFloor: 'moderate',
    readiness: 'all_five_thresholds_plus_historical_tenure_recognition',
    steps: [
      { stepKey: 'clarify.lineage_surface', position: 1, reversibility: 'fully_reversible' },
      { stepKey: 'clarify.tenure_recognition', position: 2, reversibility: 'fully_reversible' },
      { stepKey: 'clarify.interpretation_matrix_return', position: 3, reversibility: 'reversible_with_cost' },
      { stepKey: 'clarify.drift_naming', position: 4, reversibility: 'reversible_with_cost' },
      { stepKey: 'clarify.governance_ratification', position: 5, reversibility: 'irreversible' },
    ],
    persistenceTable: 'oci_workflow_governance_clarification',
  },
  stewardship_redistribution: {
    key: 'stewardship_redistribution',
    title: 'Stewardship Redistribution',
    docPath: 'docs/oci/stabilization/workflows/STEWARDSHIP_REDISTRIBUTION_WORKFLOW.md',
    playbookPaths: [
      'docs/oci/stabilization/playbooks/STEWARDSHIP_REDISTRIBUTION.md',
      'docs/oci/stabilization/playbooks/LEADERSHIP_TRANSITION_STABILIZATION.md',
    ],
    composedEngines: [
      'stewardshipRedistributionEngine',
      'continuityRedistributionPlanner',
      'stabilizationPriorityEngine',
      'continuityDependencyGraph',
    ],
    severityFloor: 'elevated',
    readiness: 'all_five_thresholds_plus_reciprocity_ratified',
    steps: [
      { stepKey: 'redistribute.recognition_reaffirmation', position: 1, reversibility: 'fully_reversible' },
      { stepKey: 'redistribute.reciprocity_terms_naming', position: 2, reversibility: 'fully_reversible' },
      { stepKey: 'redistribute.candidate_naming', position: 3, reversibility: 'reversible_with_cost' },
      { stepKey: 'redistribute.consent_capture', position: 4, reversibility: 'reversible_with_cost' },
      { stepKey: 'redistribute.practice_transfer', position: 5, reversibility: 'reversible_with_cost' },
      { stepKey: 'redistribute.governance_ratification', position: 6, reversibility: 'irreversible' },
    ],
    persistenceTable: 'oci_workflow_stewardship_redistribution',
  },
  onboarding_stabilization: {
    key: 'onboarding_stabilization',
    title: 'Onboarding Stabilization',
    docPath: 'docs/oci/stabilization/workflows/ONBOARDING_STABILIZATION_WORKFLOW.md',
    playbookPaths: ['docs/oci/stabilization/playbooks/ONBOARDING_SURVIVABILITY_RECOVERY.md'],
    composedEngines: [
      'onboardingFragilityAnalysis',
      'stabilizationPriorityEngine',
      'continuityRedistributionPlanner',
    ],
    severityFloor: 'moderate',
    readiness: 'all_five_thresholds',
    steps: [
      { stepKey: 'onboard.scope_role', position: 1, reversibility: 'fully_reversible' },
      { stepKey: 'onboard.current_steward_walk', position: 2, reversibility: 'fully_reversible' },
      { stepKey: 'onboard.record_draft', position: 3, reversibility: 'reversible_with_cost' },
      { stepKey: 'onboard.incoming_review', position: 4, reversibility: 'reversible_with_cost' },
      { stepKey: 'onboard.governance_ratification', position: 5, reversibility: 'irreversible' },
    ],
    persistenceTable: 'oci_workflow_onboarding_stabilization',
  },
  modernization_remediation: {
    key: 'modernization_remediation',
    title: 'Modernization Remediation',
    docPath: 'docs/oci/stabilization/workflows/MODERNIZATION_REMEDIATION_WORKFLOW.md',
    playbookPaths: ['docs/oci/stabilization/playbooks/MODERNIZATION_CONTINUITY_REMEDIATION.md'],
    composedEngines: [
      'modernizationAlignmentEngine',
      'governanceModernizationReview',
      'continuitySafeModernization',
      'continuityLineageEngine',
    ],
    severityFloor: 'moderate',
    readiness: 'all_five_thresholds_plus_historical_tenure_recognition',
    steps: [
      { stepKey: 'modernize.scope_substitution', position: 1, reversibility: 'fully_reversible' },
      { stepKey: 'modernize.interpretation_capture', position: 2, reversibility: 'fully_reversible' },
      { stepKey: 'modernize.preservation_assessment', position: 3, reversibility: 'reversible_with_cost' },
      { stepKey: 'modernize.remediation_design', position: 4, reversibility: 'reversible_with_cost' },
      { stepKey: 'modernize.governance_ratification', position: 5, reversibility: 'irreversible' },
    ],
    persistenceTable: 'oci_workflow_modernization_remediation',
  },
  operational_reconstruction: {
    key: 'operational_reconstruction',
    title: 'Operational Reconstruction',
    docPath: 'docs/oci/stabilization/workflows/OPERATIONAL_RECONSTRUCTION_WORKFLOW.md',
    playbookPaths: ['docs/oci/stabilization/playbooks/OPERATIONAL_RECONSTRUCTION_RECOVERY.md'],
    composedEngines: [
      'reconstructionBurdenAnalyzer',
      'continuityLineageEngine',
      'continuityBreakpointEngine',
      'continuityCollapsePredictor',
    ],
    severityFloor: 'elevated',
    readiness: 'all_five_thresholds_plus_historical_tenure_recognition',
    steps: [
      { stepKey: 'reconstruct.scope_lapsed_practice', position: 1, reversibility: 'fully_reversible' },
      { stepKey: 'reconstruct.secondary_source_review', position: 2, reversibility: 'fully_reversible' },
      { stepKey: 'reconstruct.adjacent_steward_consult', position: 3, reversibility: 'reversible_with_cost' },
      { stepKey: 'reconstruct.honest_marking', position: 4, reversibility: 'reversible_with_cost' },
      { stepKey: 'reconstruct.governance_ratification', position: 5, reversibility: 'irreversible' },
    ],
    persistenceTable: 'oci_workflow_operational_reconstruction',
  },
};

export const WORKFLOW_KEYS: readonly WorkflowKey[] = [
  'continuity_capture',
  'governance_clarification',
  'stewardship_redistribution',
  'onboarding_stabilization',
  'modernization_remediation',
  'operational_reconstruction',
];

export function getWorkflowDefinition(key: WorkflowKey): WorkflowDefinition {
  return CONTINUITY_WORKFLOW_REGISTRY[key];
}
