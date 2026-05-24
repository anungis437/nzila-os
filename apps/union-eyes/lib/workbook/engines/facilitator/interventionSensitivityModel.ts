/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Facilitator Runtime
 * DOCTRINE_VERSION: 2.0.0
 *
 * Intervention sensitivity model. Reads institutional state +
 * progression band to flag the sensitivity register the facilitator
 * should operate in.
 *
 * NEVER reads or emits a person-level signal. Sensitivity is an
 * institutional posture, not a personal trait.
 *
 * Pure, deterministic.
 */

import type { StabilizationState } from '../state/stabilizationStateMachine';

export const ENGINE_VERSION = '2.0.0';

export type SensitivityRegister = 'none' | 'elevated' | 'high';

export interface SensitivityInput {
  readonly currentState: StabilizationState | null;
  readonly progressionBand: 'not_yet_readable' | 'holding' | 'advancing' | 'regressing';
  readonly hasRegressedWithoutRecovery: boolean;
}

export interface SensitivityReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly register: SensitivityRegister;
  readonly statement: string;
}

export function readInterventionSensitivity(input: SensitivityInput): SensitivityReading {
  const isElevatedState =
    input.currentState === 'continuity_debt_elevated' ||
    input.currentState === 'governance_recovery_active';
  const isRegressing = input.progressionBand === 'regressing';

  let register: SensitivityRegister;
  if ((isElevatedState && isRegressing) || input.hasRegressedWithoutRecovery) {
    register = 'high';
  } else if (isElevatedState || isRegressing) {
    register = 'elevated';
  } else {
    register = 'none';
  }

  return {
    engineVersion: ENGINE_VERSION,
    register,
    statement: statementFor(register),
  };
}

function statementFor(register: SensitivityRegister): string {
  switch (register) {
    case 'high':
      return 'Institutional sensitivity is high; the facilitator should operate in the calmest available register.';
    case 'elevated':
      return 'Institutional sensitivity is elevated; the facilitator should slow pacing and confirm readiness.';
    case 'none':
      return 'No elevated institutional sensitivity is recorded.';
  }
}
