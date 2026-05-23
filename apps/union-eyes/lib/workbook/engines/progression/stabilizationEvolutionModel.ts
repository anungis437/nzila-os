/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Stabilization Progression
 * DOCTRINE_VERSION: 2.0.0
 *
 * Composes organizationalEvolutionTracker into a stabilization-facing
 * evolution model. Reads only — no scoring, no analytics.
 *
 * Pure, deterministic.
 */

import type { OrganizationalEvolutionResult, EvolutionPosture } from '../organizationalEvolutionTracker';

export const ENGINE_VERSION = '2.0.0';

export type StabilizationEvolutionDirection =
  | 'advancing'
  | 'holding'
  | 'regressing'
  | 'unknown';

export interface StabilizationEvolutionReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly direction: StabilizationEvolutionDirection;
  readonly posture: EvolutionPosture | 'unknown';
  readonly continuityRate: number;
  readonly reading: string;
}

export function readStabilizationEvolution(
  evolution: OrganizationalEvolutionResult | null,
): StabilizationEvolutionReading {
  if (!evolution) {
    return {
      engineVersion: ENGINE_VERSION,
      direction: 'unknown',
      posture: 'unknown',
      continuityRate: 0,
      reading: 'Organizational evolution has not been read; direction is unknown.',
    };
  }
  const direction = directionFromPosture(evolution.posture);
  return {
    engineVersion: ENGINE_VERSION,
    direction,
    posture: evolution.posture,
    continuityRate: evolution.continuityRate,
    reading: readingFor(direction, evolution.posture),
  };
}

function directionFromPosture(posture: EvolutionPosture): StabilizationEvolutionDirection {
  switch (posture) {
    case 'continuous':
    case 'evolved':
      return 'advancing';
    case 'reinterpreted':
      return 'holding';
    case 'fractured':
      return 'regressing';
  }
}

function readingFor(direction: StabilizationEvolutionDirection, posture: EvolutionPosture): string {
  switch (direction) {
    case 'advancing':
      return `Organizational evolution is recorded as ${posture}; lineage is preserved across eras.`;
    case 'holding':
      return 'Organizational evolution is recorded as reinterpreted; lineage is preserved with reinterpretation.';
    case 'regressing':
      return 'Organizational evolution is recorded as fractured; lineage has not been preserved across at least one era.';
    case 'unknown':
      return 'Organizational evolution has not been read.';
  }
}
