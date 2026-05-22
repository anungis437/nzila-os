/**
 * ARTIFACT TYPE: Sector Archetype Model
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Sector archetype model.
 *
 * Reads a sector baseline envelope and returns a deterministic, named archetype
 * describing the sector's continuity character at that reading. Archetypes are
 * descriptive, not evaluative; they never carry a "good" or "bad" label.
 *
 * Archetypes:
 *   - `cohesive_continuity`     : majority readable as holding or stabilizing
 *   - `mixed_continuity`        : a roughly even mix of bands
 *   - `recovering_continuity`   : majority stabilizing
 *   - `fragmenting_continuity`  : meaningful regressing presence
 *   - `not_yet_readable`        : envelope is below the k-anonymity floor
 */

import type {
  ContinuityTrajectoryBand,
  IntelligenceSector,
  SectorBaselineEnvelope,
} from '../contracts/intelligenceContracts';

export const SECTOR_ARCHETYPE_MODEL_VERSION = '1.0.0' as const;

export type SectorArchetype =
  | 'not_yet_readable'
  | 'cohesive_continuity'
  | 'mixed_continuity'
  | 'recovering_continuity'
  | 'fragmenting_continuity';

export interface SectorArchetypeReading {
  readonly sector: IntelligenceSector;
  readonly archetype: SectorArchetype;
  readonly basedOn: number;
}

function fraction(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function readSectorArchetype(
  envelope: SectorBaselineEnvelope,
): SectorArchetypeReading {
  if (!envelope.readable) {
    return {
      sector: envelope.sector,
      archetype: 'not_yet_readable',
      basedOn: envelope.contributingInstitutions,
    };
  }
  const dist = envelope.trajectoryDistribution;
  const meaningfulTotal =
    dist.holding + dist.stabilizing + dist.regressing;

  if (meaningfulTotal === 0) {
    return {
      sector: envelope.sector,
      archetype: 'not_yet_readable',
      basedOn: envelope.contributingInstitutions,
    };
  }

  const regressingShare = fraction(dist.regressing, meaningfulTotal);
  const stabilizingShare = fraction(dist.stabilizing, meaningfulTotal);
  const cohesiveShare = fraction(
    dist.holding + dist.stabilizing,
    meaningfulTotal,
  );

  let archetype: SectorArchetype;
  if (regressingShare >= 0.4) {
    archetype = 'fragmenting_continuity';
  } else if (stabilizingShare >= 0.6) {
    archetype = 'recovering_continuity';
  } else if (cohesiveShare >= 0.7) {
    archetype = 'cohesive_continuity';
  } else {
    archetype = 'mixed_continuity';
  }

  return {
    sector: envelope.sector,
    archetype,
    basedOn: envelope.contributingInstitutions,
  };
}

// Re-exported so consumers of the archetype reading can label distributions.
export const TRAJECTORY_BAND_ORDER: ReadonlyArray<ContinuityTrajectoryBand> = [
  'not_yet_readable',
  'regressing',
  'holding',
  'stabilizing',
];
