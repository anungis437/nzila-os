/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Stewardship Density Index™
 * DOCTRINE_VERSION: 1.0.0
 *
 * Quantifies how concentrated institutional knowledge is in too few
 * continuity carriers. The index is the percentage of institution-critical
 * or load-bearing knowledge sitting with carriers who have NO identified
 * successor, weighted by the criticality band.
 *
 * Pure, deterministic. No I/O. Consumed by:
 *   - lib/workbook/engines/stewardshipCartography.ts
 *   - lib/workbook-pdf/workbookNarrativeEngine.ts
 *   - lib/hubspot/workbookPropertyMapper.ts
 *
 * Anti-surveillance: this module operates on aggregates only. Holder names
 * and free-text notes are never inspected.
 */

export type Criticality =
  | 'routine'
  | 'important'
  | 'load_bearing'
  | 'institution_critical';

export type TenureBand = '0_3y' | '3_7y' | '7_15y' | '15y_plus';

export interface HolderForIndex {
  criticality: Criticality | null;
  tenureBand: TenureBand | null;
  successorIdentified: boolean;
}

const CRITICALITY_WEIGHT: Record<Criticality, number> = {
  routine: 0.25,
  important: 0.5,
  load_bearing: 0.85,
  institution_critical: 1.0,
};

const TENURE_AMPLIFIER: Record<TenureBand, number> = {
  '0_3y': 0.6,
  '3_7y': 0.85,
  '7_15y': 1.0,
  '15y_plus': 1.15,
};

export interface DensityBand {
  id: 'distributed' | 'observed' | 'concentrated' | 'fragile' | 'critical';
  label: string;
  posture: string;
  /** Lower bound, inclusive. The first band whose lower bound is <= index wins (descending check). */
  lowerBound: number;
}

export const DENSITY_BANDS: readonly DensityBand[] = [
  {
    id: 'critical',
    label: 'Critical concentration',
    posture:
      'A small number of carriers hold institution-critical responsibility without identified successors. This is the configuration in which continuity is most likely to fail quietly.',
    lowerBound: 0.7,
  },
  {
    id: 'fragile',
    label: 'Fragile concentration',
    posture:
      'Continuity is carried by too few people relative to the institutional weight involved. Stabilization is appropriate before the next personnel transition.',
    lowerBound: 0.5,
  },
  {
    id: 'concentrated',
    label: 'Concentrated stewardship',
    posture:
      'Stewardship is recognisable but narrow. Identifying successors for load-bearing roles would meaningfully reduce continuity risk.',
    lowerBound: 0.3,
  },
  {
    id: 'observed',
    label: 'Observed but uneven',
    posture:
      'Stewardship is observed across multiple carriers, but distribution is uneven. Modest broadening is appropriate.',
    lowerBound: 0.15,
  },
  {
    id: 'distributed',
    label: 'Distributed stewardship',
    posture:
      'Stewardship appears reasonably distributed across continuity carriers. Periodic review is sufficient.',
    lowerBound: 0,
  },
] as const;

export interface StewardshipDensityResult {
  /** 0.0 \u2013 1.0. Higher is more concentrated and more fragile. */
  index: number;
  band: DensityBand;
  totalCarriers: number;
  loadBearingCount: number;
  institutionCriticalCount: number;
  unsuccessedLoadBearingCount: number;
  unsuccessedInstitutionCriticalCount: number;
  /** Sum of criticality weights for all carriers (denominator). */
  totalWeight: number;
  /** Sum of criticality\u00d7tenure weight for carriers without identified successor. */
  exposedWeight: number;
}

export function computeStewardshipDensity(
  holders: readonly HolderForIndex[],
): StewardshipDensityResult {
  if (!Array.isArray(holders) || holders.length === 0) return buildEmptyResult();

  let totalWeight = 0;
  let exposedWeight = 0;
  let loadBearingCount = 0;
  let institutionCriticalCount = 0;
  let unsuccessedLoadBearingCount = 0;
  let unsuccessedInstitutionCriticalCount = 0;

  let totalCarriers = 0;

  for (const h of holders) {
    if (!h || typeof h !== 'object') continue;
    totalCarriers += 1;
    const holder = h as Partial<HolderForIndex>;
    const crit = isCriticality(holder.criticality) ? holder.criticality : null;
    if (!crit) continue;
    const critWeight = CRITICALITY_WEIGHT[crit];
    const tenureWeight = isTenureBand(holder.tenureBand) ? TENURE_AMPLIFIER[holder.tenureBand] : 1.0;
    const weight = critWeight * tenureWeight;

    totalWeight += weight;
    if (!holder.successorIdentified) exposedWeight += weight;

    if (crit === 'load_bearing') {
      loadBearingCount += 1;
      if (!holder.successorIdentified) unsuccessedLoadBearingCount += 1;
    }
    if (crit === 'institution_critical') {
      institutionCriticalCount += 1;
      if (!holder.successorIdentified) unsuccessedInstitutionCriticalCount += 1;
    }
  }

  const index = totalWeight === 0 ? 0 : exposedWeight / totalWeight;
  const band = classifyDensity(index);

  return {
    index: round2(index),
    band,
    totalCarriers,
    loadBearingCount,
    institutionCriticalCount,
    unsuccessedLoadBearingCount,
    unsuccessedInstitutionCriticalCount,
    totalWeight: round2(totalWeight),
    exposedWeight: round2(exposedWeight),
  };
}

export function classifyDensity(index: number): DensityBand {
  const normalized = sanitizeUnitInterval(index);
  for (const band of DENSITY_BANDS) {
    if (normalized >= band.lowerBound) return band;
  }
  return DENSITY_BANDS[DENSITY_BANDS.length - 1];
}

function buildEmptyResult(): StewardshipDensityResult {
  return {
    index: 0,
    band: DENSITY_BANDS[DENSITY_BANDS.length - 1],
    totalCarriers: 0,
    loadBearingCount: 0,
    institutionCriticalCount: 0,
    unsuccessedLoadBearingCount: 0,
    unsuccessedInstitutionCriticalCount: 0,
    totalWeight: 0,
    exposedWeight: 0,
  };
}

function isCriticality(value: HolderForIndex['criticality'] | undefined): value is Criticality {
  return value === 'routine' || value === 'important' || value === 'load_bearing' || value === 'institution_critical';
}

function isTenureBand(value: HolderForIndex['tenureBand'] | undefined): value is TenureBand {
  return value === '0_3y' || value === '3_7y' || value === '7_15y' || value === '15y_plus';
}

function sanitizeUnitInterval(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

for (const band of DENSITY_BANDS) Object.freeze(band);
Object.freeze(DENSITY_BANDS);
