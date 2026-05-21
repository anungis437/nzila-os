/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Stabilization Progression
 * DOCTRINE_VERSION: 2.0.0
 *
 * Composes ociMaturityPathway into a stabilization-facing maturity
 * progression reading. Names current stage and legal next stage.
 *
 * Pure, deterministic.
 */

import type {
  OciMaturityPathwayResult,
  OciMaturityStage,
} from '../ociMaturityPathway';

export const ENGINE_VERSION = '2.0.0';

export interface MaturityProgressionReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly currentStage: OciMaturityStage | 'unknown';
  readonly nextStage: OciMaturityStage | null;
  readonly atTerminalStage: boolean;
  readonly reading: string;
}

const STAGE_ORDER: readonly OciMaturityStage[] = [
  'recognition_only',
  'mapping_underway',
  'stabilization_underway',
  'infrastructure_underway',
  'intelligence_underway',
];

const PHASE_TO_STAGE: Record<string, OciMaturityStage> = {
  recognition: 'recognition_only',
  mapping: 'mapping_underway',
  stabilization: 'stabilization_underway',
  infrastructure: 'infrastructure_underway',
  intelligence: 'intelligence_underway',
};

export function readMaturityProgression(
  pathway: OciMaturityPathwayResult | null,
): MaturityProgressionReading {
  if (!pathway) {
    return {
      engineVersion: ENGINE_VERSION,
      currentStage: 'unknown',
      nextStage: null,
      atTerminalStage: false,
      reading: 'Maturity stage has not been located; reading is deferred.',
    };
  }
  const currentStage = PHASE_TO_STAGE[pathway.currentPhase] ?? 'unknown';
  const idx = STAGE_ORDER.findIndex((s) => s === currentStage);
  const nextStage = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
  const atTerminalStage = currentStage === 'intelligence_underway';
  return {
    engineVersion: ENGINE_VERSION,
    currentStage,
    nextStage,
    atTerminalStage,
    reading: atTerminalStage
      ? 'Maturity placement is at the longitudinal intelligence stage; no further forward stage is defined.'
      : nextStage
        ? `Maturity placement is at ${humanize(currentStage)}; the legal next stage is ${humanize(nextStage)}.`
        : `Maturity placement is at ${humanize(currentStage)}.`,
  };
}

function humanize(stage: OciMaturityStage | 'unknown'): string {
  return stage.replace(/_/g, ' ');
}
