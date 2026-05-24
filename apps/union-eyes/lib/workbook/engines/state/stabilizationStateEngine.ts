/**
 * OCI Stabilization State Engine — composition layer over the FSM.
 *
 * Given the current declared state, active-state set, and a transition
 * gate snapshot, the state engine:
 *   1. Enumerates legal next states (forward + regression),
 *   2. Evaluates each candidate against the gate snapshot,
 *   3. Emits canonical signal envelopes naming permitted/deferred
 *      transitions and regression dispositions.
 *
 * No DB writes. No side effects. Composition only.
 *
 * Doctrine: docs/oci/stabilization/OCI_STABILIZATION_STATE_ENGINE.md
 */

import {
  STABILIZATION_STATES,
  WORKFLOW_ACTIVE_STATES,
  evaluateTransition,
  legalNextStates,
  type RegressionTrigger,
  type StabilizationState,
  type TransitionEvaluation,
  type TransitionGateSnapshot,
  type WorkflowActiveState,
} from './stabilizationStateMachine';

export const ENGINE_VERSION = '2.0.0';

export type StateSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type StateSignalCategory =
  | 'state_progression_offer'
  | 'state_progression_deferred'
  | 'state_regression_recognised'
  | 'state_regression_deferred'
  | 'no_legal_progression_available'
  | 'workflow_concurrency_recorded';

export interface StateSignal {
  readonly signalId: string;
  readonly severity: StateSignalSeverity;
  readonly category: StateSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface StabilizationStateEngineInput {
  readonly declaredState: StabilizationState;
  readonly activeStateSet: readonly WorkflowActiveState[];
  readonly gates: TransitionGateSnapshot;
}

export interface StabilizationStateEngineResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly declaredState: StabilizationState;
  readonly activeStateSet: readonly WorkflowActiveState[];
  readonly evaluations: readonly TransitionEvaluation[];
  readonly signals: readonly StateSignal[];
  readonly preview: string;
}

function dedupedActiveSet(
  set: readonly WorkflowActiveState[],
): readonly WorkflowActiveState[] {
  const seen = new Set<WorkflowActiveState>();
  const out: WorkflowActiveState[] = [];
  for (const s of set) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return WORKFLOW_ACTIVE_STATES.filter((s) => out.includes(s));
}

function severityForCategory(category: StateSignalCategory): StateSignalSeverity {
  switch (category) {
    case 'state_progression_offer':
      return 'observation';
    case 'state_progression_deferred':
      return 'warning';
    case 'state_regression_recognised':
      return 'warning';
    case 'state_regression_deferred':
      return 'note';
    case 'no_legal_progression_available':
      return 'note';
    case 'workflow_concurrency_recorded':
      return 'note';
  }
}

function statementForEvaluation(ev: TransitionEvaluation): string {
  if (ev.isRegression) {
    if (ev.disposition === 'permitted') {
      return `Regression from ${ev.from} to ${ev.to} is recognised as institutional record (${ev.regressionTrigger ?? 'unspecified'}).`;
    }
    return `Regression from ${ev.from} to ${ev.to} is held pending an explicit trigger.`;
  }
  if (ev.disposition === 'permitted') {
    return `Transition from ${ev.from} to ${ev.to} is available for governance ratification.`;
  }
  return `Transition from ${ev.from} to ${ev.to} is deferred. Unmet gates: ${ev.unmetGates.join(', ') || 'none'}.`;
}

function categoryForEvaluation(ev: TransitionEvaluation): StateSignalCategory {
  if (ev.isRegression) {
    return ev.disposition === 'permitted'
      ? 'state_regression_recognised'
      : 'state_regression_deferred';
  }
  return ev.disposition === 'permitted'
    ? 'state_progression_offer'
    : 'state_progression_deferred';
}

function buildEvidence(
  ev: TransitionEvaluation,
  gates: TransitionGateSnapshot,
): Readonly<Record<string, unknown>> {
  return {
    from: ev.from,
    to: ev.to,
    disposition: ev.disposition,
    requiredGates: ev.requiredGates,
    metGates: ev.metGates,
    unmetGates: ev.unmetGates,
    isRegression: ev.isRegression,
    regressionTrigger: ev.regressionTrigger ?? null,
    gateSnapshotKeys: Object.keys(gates).sort(),
  };
}

export function runStabilizationStateEngine(
  input: StabilizationStateEngineInput,
): StabilizationStateEngineResult {
  const declared = input.declaredState;
  const active = dedupedActiveSet(input.activeStateSet);
  const { forward, regression } = legalNextStates(declared);

  const evaluations: TransitionEvaluation[] = [];
  for (const target of forward) {
    evaluations.push(evaluateTransition(declared, target, input.gates));
  }
  for (const target of regression) {
    evaluations.push(evaluateTransition(declared, target, input.gates));
  }

  // Stable order: forward first (in lifecycle order), then regression (in lifecycle order).
  evaluations.sort((a, b) => {
    if (a.isRegression !== b.isRegression) return a.isRegression ? 1 : -1;
    const ai = STABILIZATION_STATES.indexOf(a.to);
    const bi = STABILIZATION_STATES.indexOf(b.to);
    return ai - bi;
  });

  const signals: StateSignal[] = [];
  for (const ev of evaluations) {
    const category = categoryForEvaluation(ev);
    signals.push({
      signalId: `state:${ev.from}->${ev.to}`,
      severity: severityForCategory(category),
      category,
      statement: statementForEvaluation(ev),
      evidence: buildEvidence(ev, input.gates),
    });
  }

  if (active.length > 1) {
    signals.push({
      signalId: `state:concurrency:${active.join(',')}`,
      severity: severityForCategory('workflow_concurrency_recorded'),
      category: 'workflow_concurrency_recorded',
      statement: `Multiple stabilization workflows are concurrently active: ${active.join(', ')}. The declared state surfaces the most recently entered; the active-state set is the full picture.`,
      evidence: { declaredState: declared, activeStateSet: active },
    });
  }

  if (forward.length === 0) {
    signals.push({
      signalId: `state:terminal:${declared}`,
      severity: severityForCategory('no_legal_progression_available'),
      category: 'no_legal_progression_available',
      statement: `No legal forward progression is defined from ${declared}. The institution is at a terminal state of the engagement model.`,
      evidence: { declaredState: declared },
    });
  }

  const preview = `Stabilization state engine — declared ${declared}; ${forward.length} forward edge(s) considered, ${regression.length} regression edge(s) considered.`;

  return {
    engineVersion: ENGINE_VERSION,
    declaredState: declared,
    activeStateSet: active,
    evaluations,
    signals,
    preview,
  };
}

export type { RegressionTrigger };
