/**
 * OCI Stabilization Progression Model — compositional reading of an
 * institution's directional position in the Stabilization Lifecycle.
 *
 * Given the result of the state engine plus a recent regression record,
 * produces a deterministic progression reading:
 *   - direction: 'advancing' | 'holding' | 'regressing'
 *   - phase band of the declared state
 *   - whether the institution is at a workflow-active state
 *
 * Pure. No analytics. No scoring.
 *
 * Doctrine: docs/oci/superseded/stabilization/OCI_STABILIZATION_STATE_ENGINE.md
 */

import {
  STABILIZATION_STATES,
  isWorkflowActiveState,
  type StabilizationState,
} from './stabilizationStateMachine';

export const ENGINE_VERSION = '2.0.0';

export type ProgressionDirection = 'advancing' | 'holding' | 'regressing';

export type ProgressionBand =
  | 'recognition_phase'
  | 'mapping_phase'
  | 'continuity_debt_phase'
  | 'stabilization_phase'
  | 'workflow_active_phase'
  | 'improving_phase'
  | 'stabilized_phase'
  | 'longitudinal_phase';

export interface ProgressionInput {
  readonly declaredState: StabilizationState;
  readonly previousDeclaredState?: StabilizationState;
  readonly recentRegressionRecorded: boolean;
  readonly hasMeasuredImprovementSincePrevious: boolean;
}

export interface ProgressionReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly declaredState: StabilizationState;
  readonly band: ProgressionBand;
  readonly direction: ProgressionDirection;
  readonly atWorkflowActiveState: boolean;
  readonly statement: string;
}

const BAND: Readonly<Record<StabilizationState, ProgressionBand>> = {
  recognition: 'recognition_phase',
  mapping_complete: 'mapping_phase',
  continuity_debt_elevated: 'continuity_debt_phase',
  stabilization_initiated: 'stabilization_phase',
  governance_recovery_active: 'workflow_active_phase',
  stewardship_redistribution_active: 'workflow_active_phase',
  onboarding_reinforcement_active: 'workflow_active_phase',
  survivability_improving: 'improving_phase',
  continuity_stabilized: 'stabilized_phase',
  longitudinal_monitoring: 'longitudinal_phase',
};

function ordinal(state: StabilizationState): number {
  return STABILIZATION_STATES.indexOf(state);
}

function computeDirection(input: ProgressionInput): ProgressionDirection {
  if (input.recentRegressionRecorded) return 'regressing';
  if (!input.previousDeclaredState) return 'holding';
  const prev = ordinal(input.previousDeclaredState);
  const curr = ordinal(input.declaredState);
  if (curr > prev) return 'advancing';
  if (curr < prev) return 'regressing';
  // Same ordinal — holding, but improvement signal may be present.
  return input.hasMeasuredImprovementSincePrevious ? 'advancing' : 'holding';
}

function describe(reading: Omit<ProgressionReading, 'statement'>): string {
  const dir =
    reading.direction === 'advancing'
      ? 'advancing'
      : reading.direction === 'regressing'
      ? 'regressing'
      : 'holding';
  return `Institution is ${dir} at ${reading.declaredState} (${reading.band}).`;
}

export function readProgression(input: ProgressionInput): ProgressionReading {
  const band = BAND[input.declaredState];
  const direction = computeDirection(input);
  const atWorkflowActiveState = isWorkflowActiveState(input.declaredState);
  const base = {
    engineVersion: ENGINE_VERSION as typeof ENGINE_VERSION,
    declaredState: input.declaredState,
    band,
    direction,
    atWorkflowActiveState,
  };
  return { ...base, statement: describe(base) };
}
