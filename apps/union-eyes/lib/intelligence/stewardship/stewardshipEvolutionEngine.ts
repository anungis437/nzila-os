/**
 * ARTIFACT TYPE: Stewardship Evolution Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Stewardship Evolution Intelligence™ engine.
 *
 * Composes a reviewer-readable reading describing how stewardship continuity
 * has evolved for a single institution. Combines redistribution durability
 * with dependency recurrence so a reviewer sees both axes at once.
 */

import type { StewardshipEvolutionRecord } from '../contracts/intelligenceContracts';
import {
  readDependencyRecurrence,
  type DependencyRecurrenceReading,
  type DependencyTagObservation,
} from './dependencyRecurrenceModel';
import {
  readRedistributionDurability,
  type RedistributionDurabilityReading,
} from './continuityRedistributionIntelligence';

export const STEWARDSHIP_EVOLUTION_ENGINE_VERSION = '1.0.0' as const;

export interface StewardshipEvolutionInputs {
  readonly institutionRefHash: string;
  readonly stewardships: ReadonlyArray<StewardshipEvolutionRecord>;
  readonly dependencyObservations: ReadonlyArray<DependencyTagObservation>;
}

export interface StewardshipEvolutionReading {
  readonly institutionRefHash: string;
  readonly redistribution: RedistributionDurabilityReading;
  readonly dependencyRecurrence: DependencyRecurrenceReading;
  readonly readable: boolean;
}

export function readStewardshipEvolution(
  inputs: StewardshipEvolutionInputs,
): StewardshipEvolutionReading {
  const redistribution = readRedistributionDurability(
    inputs.institutionRefHash,
    inputs.stewardships,
  );
  const dependencyRecurrence = readDependencyRecurrence(
    inputs.dependencyObservations,
  );
  const readable =
    redistribution.band !== 'not_yet_readable' ||
    dependencyRecurrence.band !== 'not_yet_readable';
  return {
    institutionRefHash: inputs.institutionRefHash,
    redistribution,
    dependencyRecurrence,
    readable,
  };
}
