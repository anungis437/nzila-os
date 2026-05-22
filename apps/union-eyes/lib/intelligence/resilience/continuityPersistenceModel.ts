/**
 * ARTIFACT TYPE: Resilience Model
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity persistence model.
 *
 * Reads a sequence of trajectory bands and returns a persistence reading: how
 * stably a band has held across the window. The model refuses to read
 * persistence from fewer than two observations.
 */

import type { ContinuityTrajectoryBand } from '../contracts/intelligenceContracts';

export const CONTINUITY_PERSISTENCE_MODEL_VERSION = '1.0.0' as const;

export type PersistenceReadingBand =
  | 'not_yet_readable'
  | 'persisting'
  | 'holding'
  | 'eroding';

export interface PersistenceReading {
  readonly band: PersistenceReadingBand;
  readonly basedOn: number;
}

export function readContinuityPersistence(
  bands: ReadonlyArray<ContinuityTrajectoryBand>,
): PersistenceReading {
  const meaningful = bands.filter((b) => b !== 'not_yet_readable');
  if (meaningful.length < 2) {
    return { band: 'not_yet_readable', basedOn: 0 };
  }
  const last = meaningful[meaningful.length - 1]!;
  if (last === 'regressing') {
    return { band: 'eroding', basedOn: meaningful.length };
  }
  // Persisting requires that the band did not regress across the window.
  if (
    (last === 'stabilizing' || last === 'holding') &&
    !meaningful.some((b) => b === 'regressing')
  ) {
    return { band: 'persisting', basedOn: meaningful.length };
  }
  return { band: 'holding', basedOn: meaningful.length };
}
