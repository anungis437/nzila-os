/**
 * ARTIFACT TYPE: Entropy Trajectory Model
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Entropy trajectory model.
 *
 * Reads a sequence of governance entropy drift readings for a single
 * institution and produces a deterministic trajectory band:
 *
 *   - `not_yet_readable` if fewer than 2 readings exist or all readings are
 *     themselves `not_yet_readable`.
 *   - `regressing`       if the last reading is `regressing`.
 *   - `holding`          if the last reading equals the first meaningful
 *                        reading and is not `regressing`.
 *   - `stabilizing`      otherwise (the last reading is meaningfully better).
 */

import type {
  GovernanceDriftBand,
  GovernanceEntropyDriftRecord,
} from '../contracts/intelligenceContracts';

export const ENTROPY_TRAJECTORY_MODEL_VERSION = '1.0.0' as const;

const DRIFT_RANK: Readonly<Record<GovernanceDriftBand, number>> = {
  not_yet_readable: -1,
  regressing: 0,
  holding: 1,
  stabilizing: 2,
};

export interface EntropyTrajectory {
  readonly institutionRefHash: string;
  readonly band: GovernanceDriftBand;
  readonly basedOn: number;
}

export function readEntropyTrajectory(
  institutionRefHash: string,
  records: ReadonlyArray<GovernanceEntropyDriftRecord>,
): EntropyTrajectory {
  const filtered = records.filter(
    (r) => r.handle.institutionRefHash === institutionRefHash,
  );
  if (filtered.length < 2) {
    return { institutionRefHash, band: 'not_yet_readable', basedOn: 0 };
  }
  const meaningful = filtered
    .filter((r) => r.drift !== 'not_yet_readable')
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (meaningful.length < 2) {
    return { institutionRefHash, band: 'not_yet_readable', basedOn: 0 };
  }
  const first = meaningful[0]!;
  const last = meaningful[meaningful.length - 1]!;
  let band: GovernanceDriftBand;
  if (last.drift === 'regressing') {
    band = 'regressing';
  } else if (DRIFT_RANK[last.drift] > DRIFT_RANK[first.drift]) {
    band = 'stabilizing';
  } else {
    band = 'holding';
  }
  return { institutionRefHash, band, basedOn: meaningful.length };
}
