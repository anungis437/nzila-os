/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Runtime Transition Model
 * DOCTRINE_VERSION: 2.0.0
 *
 * Runtime transition engine. Evaluates whether any of the five
 * named runtime transitions can be offered, based on gates and
 * readiness reverification.
 *
 * Pure, deterministic. Refusal is the default; offer requires
 * every gate to pass.
 */

import type { StabilizationState } from '../state/stabilizationStateMachine';
import type { ReadinessReading } from '../facilitator/stabilizationReadinessSignals';

export const ENGINE_VERSION = '2.0.0';

export type TransitionName =
  | 'stabilization_to_commercial_pilot'
  | 'stabilization_to_continuity_operationalization'
  | 'stabilization_to_longitudinal_monitoring'
  | 'stabilization_to_governance_reaffirmation'
  | 'stabilization_to_continued_facilitation';

export const TRANSITION_NAMES: readonly TransitionName[] = [
  'stabilization_to_commercial_pilot',
  'stabilization_to_continuity_operationalization',
  'stabilization_to_longitudinal_monitoring',
  'stabilization_to_governance_reaffirmation',
  'stabilization_to_continued_facilitation',
];

export type GateKey =
  | 'state_not_stabilized'
  | 'progression_is_regressing'
  | 'active_intervention_reversibility_exhausted'
  | 'readiness_insufficient'
  | 'transition_specific_gate_failed';

export type TransitionDisposition = 'offered' | 'refused';

export interface TransitionEvaluation {
  readonly transition: TransitionName;
  readonly disposition: TransitionDisposition;
  readonly failedGates: readonly GateKey[];
  readonly statement: string;
}

export interface RuntimeTransitionInput {
  readonly currentState: StabilizationState | null;
  readonly progressionBand: 'not_yet_readable' | 'holding' | 'advancing' | 'regressing';
  readonly anyActiveInterventionReversibilityExhausted: boolean;
  readonly readiness: ReadinessReading;
  readonly transitionSpecific: {
    readonly hasIrreversiblyRatifiedRedistribution: boolean;
    readonly compositeHealthBand: 'not_yet_readable' | 'holding' | 'stabilizing' | 'regressing';
    readonly evolutionDirection: 'unknown' | 'advancing' | 'holding' | 'regressing';
    readonly hasRatifiedGovernanceRecoveryMove: boolean;
    readonly facilitatorSensitivityRegister: 'none' | 'elevated' | 'high';
  };
}

export interface RuntimeTransitionResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly evaluations: readonly TransitionEvaluation[];
  readonly offeredCount: number;
  readonly refusedCount: number;
}

export function runRuntimeTransitionEngine(input: RuntimeTransitionInput): RuntimeTransitionResult {
  const evaluations: TransitionEvaluation[] = TRANSITION_NAMES.map((t) => evaluateOne(input, t));
  const offeredCount = evaluations.filter((e) => e.disposition === 'offered').length;
  const refusedCount = evaluations.length - offeredCount;
  return { engineVersion: ENGINE_VERSION, evaluations, offeredCount, refusedCount };
}

function evaluateOne(input: RuntimeTransitionInput, transition: TransitionName): TransitionEvaluation {
  const failed: GateKey[] = [];

  const stateOk =
    input.currentState === 'continuity_stabilized' || input.currentState === 'longitudinal_monitoring';
  if (!stateOk) failed.push('state_not_stabilized');
  if (input.progressionBand === 'regressing') failed.push('progression_is_regressing');
  if (input.anyActiveInterventionReversibilityExhausted) failed.push('active_intervention_reversibility_exhausted');
  if (!input.readiness.sufficient) failed.push('readiness_insufficient');
  if (!checkTransitionSpecific(input, transition)) failed.push('transition_specific_gate_failed');

  const disposition: TransitionDisposition = failed.length === 0 ? 'offered' : 'refused';
  return {
    transition,
    disposition,
    failedGates: failed,
    statement:
      disposition === 'offered'
        ? `Transition ${transition} may be offered; all gates have been satisfied.`
        : `Transition ${transition} is refused; ${failed.length} gate(s) failed: ${failed.join(', ')}.`,
  };
}

function checkTransitionSpecific(input: RuntimeTransitionInput, transition: TransitionName): boolean {
  const t = input.transitionSpecific;
  switch (transition) {
    case 'stabilization_to_commercial_pilot':
      return t.hasIrreversiblyRatifiedRedistribution;
    case 'stabilization_to_continuity_operationalization':
      return t.compositeHealthBand === 'holding' || t.compositeHealthBand === 'stabilizing';
    case 'stabilization_to_longitudinal_monitoring':
      return t.evolutionDirection === 'advancing' || t.evolutionDirection === 'holding';
    case 'stabilization_to_governance_reaffirmation':
      return t.hasRatifiedGovernanceRecoveryMove;
    case 'stabilization_to_continued_facilitation':
      return t.facilitatorSensitivityRegister !== 'none';
  }
}
