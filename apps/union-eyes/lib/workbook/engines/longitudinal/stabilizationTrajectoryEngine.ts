/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Longitudinal Stabilization
 * DOCTRINE_VERSION: 2.0.0
 *
 * Stabilization trajectory engine. Reads the longitudinal envelope
 * into a single categorical trajectory under k-anonymity discipline.
 *
 * Pure, deterministic.
 */

import type { LongitudinalRuntimeResult } from './longitudinalStabilizationRuntime';

export const ENGINE_VERSION = '2.0.0';

export type TrajectoryBand = 'not_yet_readable' | 'improving' | 'holding' | 'regressing';

export interface TrajectoryReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly trajectory: TrajectoryBand;
  readonly kFloorMet: boolean;
  readonly contributingInputCount: number;
  readonly statement: string;
}

export function readStabilizationTrajectory(
  envelope: LongitudinalRuntimeResult,
): TrajectoryReading {
  if (!envelope.kFloorMet) {
    return {
      engineVersion: ENGINE_VERSION,
      trajectory: 'not_yet_readable',
      kFloorMet: false,
      contributingInputCount: envelope.contributingInputs.length,
      statement: 'Longitudinal trajectory is not yet readable; k-anonymity floor is not met.',
    };
  }
  if (envelope.contributingInputs.length < 2) {
    return {
      engineVersion: ENGINE_VERSION,
      trajectory: 'not_yet_readable',
      kFloorMet: true,
      contributingInputCount: envelope.contributingInputs.length,
      statement: 'Longitudinal trajectory is not yet readable; fewer than two contributing inputs are recorded.',
    };
  }

  const evo = envelope.evolutionDirection;
  const ledger = envelope.ledgerDirection;

  const directions = [evo, ledger].filter((d) => d !== 'unknown');
  const regressing = directions.filter((d) => d === 'regressing').length;
  const improving = directions.filter((d) => d === 'improving' || d === 'advancing').length;
  const holding = directions.filter((d) => d === 'holding').length;

  let trajectory: TrajectoryBand;
  if (regressing >= 1) trajectory = 'regressing';
  else if (improving >= 2) trajectory = 'improving';
  else if (improving >= 1 && holding >= 1) trajectory = 'improving';
  else trajectory = 'holding';

  return {
    engineVersion: ENGINE_VERSION,
    trajectory,
    kFloorMet: true,
    contributingInputCount: envelope.contributingInputs.length,
    statement: statementFor(trajectory),
  };
}

function statementFor(t: TrajectoryBand): string {
  switch (t) {
    case 'improving':
      return 'Longitudinal trajectory is improving across contributing inputs.';
    case 'holding':
      return 'Longitudinal trajectory is holding; neither improving nor regressing.';
    case 'regressing':
      return 'Longitudinal trajectory is regressing on at least one input.';
    case 'not_yet_readable':
      return 'Longitudinal trajectory is not yet readable.';
  }
}
