/**
 * ARTIFACT TYPE: Survivability Trajectory Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Survivability trajectory engine.
 *
 * Reads a sequence of onboarding survivability records and returns a
 * survivability progression band describing whether onboarding survivability
 * is strengthening, holding, or weakening across the window.
 */

import type {
  SurvivabilityProgressionBand,
  SurvivabilityProgressionRecord,
} from '../contracts/intelligenceContracts';

export const SURVIVABILITY_TRAJECTORY_VERSION = '1.0.0' as const;

const RANK: Readonly<Record<SurvivabilityProgressionBand, number>> = {
  not_yet_readable: -1,
  weakening: 0,
  holding: 1,
  strengthening: 2,
};

export interface SurvivabilityTrajectory {
  readonly institutionRefHash: string;
  readonly band: SurvivabilityProgressionBand;
  readonly basedOn: number;
}

export function readSurvivabilityTrajectory(
  institutionRefHash: string,
  records: ReadonlyArray<SurvivabilityProgressionRecord>,
): SurvivabilityTrajectory {
  const filtered = records.filter(
    (r) => r.handle.institutionRefHash === institutionRefHash,
  );
  if (filtered.length < 2) {
    return { institutionRefHash, band: 'not_yet_readable', basedOn: 0 };
  }
  const meaningful = filtered
    .filter((r) => r.progression !== 'not_yet_readable')
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (meaningful.length < 2) {
    return { institutionRefHash, band: 'not_yet_readable', basedOn: 0 };
  }
  const first = meaningful[0]!;
  const last = meaningful[meaningful.length - 1]!;
  let band: SurvivabilityProgressionBand;
  if (last.progression === 'weakening') {
    band = 'weakening';
  } else if (RANK[last.progression] > RANK[first.progression]) {
    band = 'strengthening';
  } else {
    band = 'holding';
  }
  return { institutionRefHash, band, basedOn: meaningful.length };
}
