/**
 * ARTIFACT TYPE: Sector Baseline Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Sector baseline engine.
 *
 * Combines a sector continuity profile, a sector baseline envelope, and a
 * sector archetype reading into a single reviewer-readable sector reading.
 *
 * Posture:
 *   - The engine refuses to produce a reading from an envelope that fails the
 *     k-anonymity floor; it returns a refusal reading instead.
 *   - No ranking. The reading carries no comparison against any other sector.
 *   - Reviewer-led. The profile is what helps the reviewer interpret the
 *     archetype; the engine never tells the reviewer what to conclude.
 */

import type {
  IntelligenceSector,
  SectorBaselineEnvelope,
} from '../contracts/intelligenceContracts';
import { validateSectorBaseline } from '../ethics/intelligenceEthicsValidators';
import {
  getSectorContinuityProfile,
  type SectorContinuityProfile,
} from './sectorContinuityProfiles';
import {
  readSectorArchetype,
  type SectorArchetypeReading,
} from './sectorArchetypeModel';

export const SECTOR_BASELINE_ENGINE_VERSION = '1.0.0' as const;

export interface SectorBaselineReading {
  readonly sector: IntelligenceSector;
  readonly readable: boolean;
  readonly envelope: SectorBaselineEnvelope;
  readonly profile: SectorContinuityProfile;
  readonly archetype: SectorArchetypeReading;
  readonly refusalReason?: string;
}

export function readSectorBaseline(
  envelope: SectorBaselineEnvelope,
): SectorBaselineReading {
  const profile = getSectorContinuityProfile(envelope.sector);
  const ethics = validateSectorBaseline(envelope);
  const archetype = readSectorArchetype(envelope);

  if (!envelope.readable || !ethics.readable) {
    return {
      sector: envelope.sector,
      readable: false,
      envelope,
      profile,
      archetype,
      refusalReason: !envelope.readable
        ? 'cohort_below_k_anonymity_floor'
        : ethics.reasons[0],
    };
  }

  return {
    sector: envelope.sector,
    readable: true,
    envelope,
    profile,
    archetype,
  };
}
