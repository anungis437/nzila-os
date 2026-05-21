/**
 * ARTIFACT TYPE: Continuity Redistribution Intelligence
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity redistribution intelligence.
 *
 * Reads a sequence of stewardship evolution records and characterises the
 * durability of redistribution: did the institution actually move continuity
 * outward, or did it temporarily diffuse before reconcentrating?
 */

import type {
  StewardshipEvolutionBand,
  StewardshipEvolutionRecord,
} from '../contracts/intelligenceContracts';

export const CONTINUITY_REDISTRIBUTION_INTELLIGENCE_VERSION = '1.0.0' as const;

export type RedistributionDurabilityBand =
  | 'not_yet_readable'
  | 'durable_redistribution'
  | 'holding_redistribution'
  | 'reconcentration_observed';

export interface RedistributionDurabilityReading {
  readonly institutionRefHash: string;
  readonly band: RedistributionDurabilityBand;
  readonly basedOn: number;
}

const RANK: Readonly<Record<StewardshipEvolutionBand, number>> = {
  not_yet_readable: -1,
  reconcentrating: 0,
  holding: 1,
  redistributing: 2,
};

export function readRedistributionDurability(
  institutionRefHash: string,
  records: ReadonlyArray<StewardshipEvolutionRecord>,
): RedistributionDurabilityReading {
  const filtered = records.filter(
    (r) => r.handle.institutionRefHash === institutionRefHash,
  );
  if (filtered.length < 2) {
    return { institutionRefHash, band: 'not_yet_readable', basedOn: 0 };
  }
  const meaningful = filtered
    .filter((r) => r.evolution !== 'not_yet_readable')
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (meaningful.length < 2) {
    return { institutionRefHash, band: 'not_yet_readable', basedOn: 0 };
  }
  const first = meaningful[0]!;
  const last = meaningful[meaningful.length - 1]!;
  let band: RedistributionDurabilityBand;
  if (last.evolution === 'reconcentrating') {
    band = 'reconcentration_observed';
  } else if (
    last.evolution === 'redistributing' &&
    RANK[last.evolution] >= RANK[first.evolution]
  ) {
    band = 'durable_redistribution';
  } else {
    band = 'holding_redistribution';
  }
  return { institutionRefHash, band, basedOn: meaningful.length };
}
