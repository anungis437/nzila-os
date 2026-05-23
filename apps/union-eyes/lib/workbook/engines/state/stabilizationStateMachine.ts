/**
 * OCI Stabilization State Machine — deterministic FSM over the ten
 * canonical stabilization states.
 *
 * Sibling to the workflow engine. Names organizational position; does
 * not act, advance, or score. All irreversible transitions require
 * governance ratification as an external precondition expressed via
 * gates.
 *
 * Doctrine: docs/oci/stabilization/OCI_STABILIZATION_STATE_ENGINE.md
 */

export const ENGINE_VERSION = '2.0.0';

export type StabilizationState =
  | 'recognition'
  | 'mapping_complete'
  | 'continuity_debt_elevated'
  | 'stabilization_initiated'
  | 'governance_recovery_active'
  | 'stewardship_redistribution_active'
  | 'onboarding_reinforcement_active'
  | 'survivability_improving'
  | 'continuity_stabilized'
  | 'longitudinal_monitoring';

export const STABILIZATION_STATES: readonly StabilizationState[] = [
  'recognition',
  'mapping_complete',
  'continuity_debt_elevated',
  'stabilization_initiated',
  'governance_recovery_active',
  'stewardship_redistribution_active',
  'onboarding_reinforcement_active',
  'survivability_improving',
  'continuity_stabilized',
  'longitudinal_monitoring',
] as const;

export type WorkflowActiveState =
  | 'governance_recovery_active'
  | 'stewardship_redistribution_active'
  | 'onboarding_reinforcement_active';

export const WORKFLOW_ACTIVE_STATES: readonly WorkflowActiveState[] = [
  'governance_recovery_active',
  'stewardship_redistribution_active',
  'onboarding_reinforcement_active',
];

export type TransitionGateKey =
  | 'phase_ii_map_returned'
  | 'readiness_reverified'
  | 'map_ratified'
  | 'severity_at_least_elevated'
  | 'stabilization_move_ratified'
  | 'reversibility_documented'
  | 'governance_workflow_eligible'
  | 'reciprocity_terms_ratified'
  | 'redistribution_workflow_eligible'
  | 'onboarding_workflow_eligible'
  | 'measured_improvement_no_regression'
  | 'all_moves_irreversibly_ratified'
  | 'governance_accepts_residual'
  | 'engagement_closure_ratified';

export type RegressionTrigger =
  | 'severity_worsened'
  | 'ratification_withdrawn'
  | 'consent_withdrawn';

export interface TransitionGateSnapshot {
  readonly phaseIiMapReturned?: boolean;
  readonly readinessReverified?: boolean;
  readonly mapRatified?: boolean;
  readonly severityAtLeastElevated?: boolean;
  readonly stabilizationMoveRatified?: boolean;
  readonly reversibilityDocumented?: boolean;
  readonly governanceWorkflowEligible?: boolean;
  readonly reciprocityTermsRatified?: boolean;
  readonly redistributionWorkflowEligible?: boolean;
  readonly onboardingWorkflowEligible?: boolean;
  readonly measuredImprovementNoRegression?: boolean;
  readonly allMovesIrreversiblyRatified?: boolean;
  readonly governanceAcceptsResidual?: boolean;
  readonly engagementClosureRatified?: boolean;
  /** Present only for regression evaluation. */
  readonly regressionTrigger?: RegressionTrigger;
}

export type TransitionDisposition =
  | 'permitted'
  | 'deferred'
  | 'refused_illegal_edge';

export interface TransitionEvaluation {
  readonly from: StabilizationState;
  readonly to: StabilizationState;
  readonly disposition: TransitionDisposition;
  readonly requiredGates: readonly TransitionGateKey[];
  readonly metGates: readonly TransitionGateKey[];
  readonly unmetGates: readonly TransitionGateKey[];
  readonly isRegression: boolean;
  readonly regressionTrigger?: RegressionTrigger;
}

interface ForwardEdge {
  readonly from: StabilizationState;
  readonly to: StabilizationState;
  readonly required: readonly TransitionGateKey[];
}

const FORWARD_EDGES: readonly ForwardEdge[] = [
  {
    from: 'recognition',
    to: 'mapping_complete',
    required: ['phase_ii_map_returned', 'readiness_reverified'],
  },
  {
    from: 'mapping_complete',
    to: 'continuity_debt_elevated',
    required: ['map_ratified', 'severity_at_least_elevated'],
  },
  {
    from: 'continuity_debt_elevated',
    to: 'stabilization_initiated',
    required: ['stabilization_move_ratified', 'reversibility_documented'],
  },
  {
    from: 'stabilization_initiated',
    to: 'governance_recovery_active',
    required: ['governance_workflow_eligible', 'readiness_reverified'],
  },
  {
    from: 'stabilization_initiated',
    to: 'stewardship_redistribution_active',
    required: ['reciprocity_terms_ratified', 'redistribution_workflow_eligible'],
  },
  {
    from: 'stabilization_initiated',
    to: 'onboarding_reinforcement_active',
    required: ['onboarding_workflow_eligible'],
  },
  {
    from: 'governance_recovery_active',
    to: 'survivability_improving',
    required: ['measured_improvement_no_regression'],
  },
  {
    from: 'stewardship_redistribution_active',
    to: 'survivability_improving',
    required: ['measured_improvement_no_regression'],
  },
  {
    from: 'onboarding_reinforcement_active',
    to: 'survivability_improving',
    required: ['measured_improvement_no_regression'],
  },
  {
    from: 'survivability_improving',
    to: 'continuity_stabilized',
    required: ['all_moves_irreversibly_ratified', 'governance_accepts_residual'],
  },
  {
    from: 'continuity_stabilized',
    to: 'longitudinal_monitoring',
    required: ['engagement_closure_ratified'],
  },
];

const REGRESSION_TARGETS: Readonly<Record<StabilizationState, readonly StabilizationState[]>> = {
  recognition: [],
  mapping_complete: ['recognition'],
  continuity_debt_elevated: ['mapping_complete', 'recognition'],
  stabilization_initiated: ['continuity_debt_elevated', 'mapping_complete', 'recognition'],
  governance_recovery_active: [
    'continuity_debt_elevated',
    'mapping_complete',
    'recognition',
  ],
  stewardship_redistribution_active: [
    'continuity_debt_elevated',
    'mapping_complete',
    'recognition',
  ],
  onboarding_reinforcement_active: [
    'continuity_debt_elevated',
    'mapping_complete',
    'recognition',
  ],
  survivability_improving: [
    'continuity_debt_elevated',
    'mapping_complete',
    'recognition',
  ],
  continuity_stabilized: [
    'survivability_improving',
    'continuity_debt_elevated',
    'recognition',
  ],
  longitudinal_monitoring: ['continuity_stabilized'],
};

const GATE_FIELD: Readonly<Record<TransitionGateKey, keyof TransitionGateSnapshot>> = {
  phase_ii_map_returned: 'phaseIiMapReturned',
  readiness_reverified: 'readinessReverified',
  map_ratified: 'mapRatified',
  severity_at_least_elevated: 'severityAtLeastElevated',
  stabilization_move_ratified: 'stabilizationMoveRatified',
  reversibility_documented: 'reversibilityDocumented',
  governance_workflow_eligible: 'governanceWorkflowEligible',
  reciprocity_terms_ratified: 'reciprocityTermsRatified',
  redistribution_workflow_eligible: 'redistributionWorkflowEligible',
  onboarding_workflow_eligible: 'onboardingWorkflowEligible',
  measured_improvement_no_regression: 'measuredImprovementNoRegression',
  all_moves_irreversibly_ratified: 'allMovesIrreversiblyRatified',
  governance_accepts_residual: 'governanceAcceptsResidual',
  engagement_closure_ratified: 'engagementClosureRatified',
};

function findForwardEdge(
  from: StabilizationState,
  to: StabilizationState,
): ForwardEdge | undefined {
  return FORWARD_EDGES.find((edge) => edge.from === from && edge.to === to);
}

function isRegressionEdge(from: StabilizationState, to: StabilizationState): boolean {
  return REGRESSION_TARGETS[from].includes(to);
}

/**
 * Evaluate a proposed transition. Pure. Returns a permitted, deferred,
 * or refused disposition with the explicit gate accounting.
 */
export function evaluateTransition(
  from: StabilizationState,
  to: StabilizationState,
  gates: TransitionGateSnapshot,
): TransitionEvaluation {
  if (from === to) {
    return {
      from,
      to,
      disposition: 'refused_illegal_edge',
      requiredGates: [],
      metGates: [],
      unmetGates: [],
      isRegression: false,
    };
  }

  const forward = findForwardEdge(from, to);
  if (forward) {
    const met: TransitionGateKey[] = [];
    const unmet: TransitionGateKey[] = [];
    for (const gate of forward.required) {
      const field = GATE_FIELD[gate];
      const value = gates[field];
      if (value === true) {
        met.push(gate);
      } else {
        unmet.push(gate);
      }
    }
    return {
      from,
      to,
      disposition: unmet.length === 0 ? 'permitted' : 'deferred',
      requiredGates: forward.required,
      metGates: met,
      unmetGates: unmet,
      isRegression: false,
    };
  }

  if (isRegressionEdge(from, to)) {
    const trigger = gates.regressionTrigger;
    return {
      from,
      to,
      disposition: trigger ? 'permitted' : 'deferred',
      requiredGates: [],
      metGates: [],
      unmetGates: [],
      isRegression: true,
      regressionTrigger: trigger,
    };
  }

  return {
    from,
    to,
    disposition: 'refused_illegal_edge',
    requiredGates: [],
    metGates: [],
    unmetGates: [],
    isRegression: false,
  };
}

/**
 * List the legal next states (forward + regression) from a given state.
 * Used by composition engines to enumerate offerable next moves.
 */
export function legalNextStates(
  from: StabilizationState,
): { readonly forward: readonly StabilizationState[]; readonly regression: readonly StabilizationState[] } {
  return {
    forward: FORWARD_EDGES.filter((edge) => edge.from === from).map((edge) => edge.to),
    regression: REGRESSION_TARGETS[from],
  };
}

export function isWorkflowActiveState(state: StabilizationState): state is WorkflowActiveState {
  return (WORKFLOW_ACTIVE_STATES as readonly StabilizationState[]).includes(state);
}
