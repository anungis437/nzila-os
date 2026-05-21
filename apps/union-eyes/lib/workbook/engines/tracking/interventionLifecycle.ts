/**
 * OCI Continuity Intervention Lifecycle — per-intervention FSM.
 *
 * Pure. Append-only event model. No DB writes.
 *
 * Doctrine: docs/oci/stabilization/OCI_CONTINUITY_INTERVENTION_TRACKING.md
 */

export const ENGINE_VERSION = '2.0.0';

export type InterventionStatus =
  | 'proposed'
  | 'ratified'
  | 'in_reversible_execution'
  | 'awaiting_irreversible_ratification'
  | 'irreversibly_ratified'
  | 'regressed'
  | 'withdrawn';

export const ACTIVE_STATUSES: readonly InterventionStatus[] = [
  'proposed',
  'ratified',
  'in_reversible_execution',
  'awaiting_irreversible_ratification',
];

export const TERMINAL_STATUSES: readonly InterventionStatus[] = [
  'irreversibly_ratified',
  'regressed',
  'withdrawn',
];

export type ProducingAction =
  | 'proposed_by_engine'
  | 'ratified_by_governance'
  | 'reversibility_window_opened'
  | 'reversibility_window_closed'
  | 'irreversibly_ratified_by_governance'
  | 'regressed_by_governance'
  | 'withdrawn_by_governance';

export type TransitionDisposition = 'permitted' | 'refused_illegal_edge';

export interface InterventionTransitionEvaluation {
  readonly from: InterventionStatus;
  readonly to: InterventionStatus;
  readonly producingAction: ProducingAction;
  readonly disposition: TransitionDisposition;
}

interface LegalEdge {
  readonly from: InterventionStatus;
  readonly to: InterventionStatus;
  readonly producingAction: ProducingAction;
}

const LEGAL_EDGES: readonly LegalEdge[] = [
  { from: 'proposed', to: 'ratified', producingAction: 'ratified_by_governance' },
  { from: 'proposed', to: 'withdrawn', producingAction: 'withdrawn_by_governance' },
  {
    from: 'ratified',
    to: 'in_reversible_execution',
    producingAction: 'reversibility_window_opened',
  },
  { from: 'ratified', to: 'withdrawn', producingAction: 'withdrawn_by_governance' },
  {
    from: 'in_reversible_execution',
    to: 'awaiting_irreversible_ratification',
    producingAction: 'reversibility_window_closed',
  },
  {
    from: 'in_reversible_execution',
    to: 'regressed',
    producingAction: 'regressed_by_governance',
  },
  {
    from: 'awaiting_irreversible_ratification',
    to: 'irreversibly_ratified',
    producingAction: 'irreversibly_ratified_by_governance',
  },
  {
    from: 'awaiting_irreversible_ratification',
    to: 'regressed',
    producingAction: 'regressed_by_governance',
  },
];

export function evaluateInterventionTransition(
  from: InterventionStatus,
  to: InterventionStatus,
  producingAction: ProducingAction,
): InterventionTransitionEvaluation {
  const legal = LEGAL_EDGES.some(
    (e) => e.from === from && e.to === to && e.producingAction === producingAction,
  );
  return {
    from,
    to,
    producingAction,
    disposition: legal ? 'permitted' : 'refused_illegal_edge',
  };
}

export function isActive(status: InterventionStatus): boolean {
  return (ACTIVE_STATUSES as readonly InterventionStatus[]).includes(status);
}

export function isTerminal(status: InterventionStatus): boolean {
  return (TERMINAL_STATUSES as readonly InterventionStatus[]).includes(status);
}

export function legalTransitionsFrom(
  from: InterventionStatus,
): readonly { readonly to: InterventionStatus; readonly producingAction: ProducingAction }[] {
  return LEGAL_EDGES.filter((e) => e.from === from).map((e) => ({
    to: e.to,
    producingAction: e.producingAction,
  }));
}
