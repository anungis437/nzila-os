/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Stewardship Density Index™
 * DOCTRINE_VERSION: 1.0.0
 *
 * Quantifies how concentrated organizational knowledge is in too few
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
 *
 * Hardening invariants (do not regress):
 *   1. All exported constants are deeply frozen.
 *   2. computeStewardshipDensity returns a fresh object on every call.
 *   3. Unknown criticality/tenure enum values are skipped (no NaN leakage).
 *   4. classifyDensity clamps its input to [0,1] and tolerates NaN.
 *   5. Result.index is always finite and in [0,1].
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

const CRITICALITY_WEIGHT: Readonly<Record<Criticality, number>> = Object.freeze({
  routine: 0.25,
  important: 0.5,
  load_bearing: 0.85,
  institution_critical: 1.0,
});

const TENURE_AMPLIFIER: Readonly<Record<TenureBand, number>> = Object.freeze({
  '0_3y': 0.6,
  '3_7y': 0.85,
  '7_15y': 1.0,
  '15y_plus': 1.15,
});

export interface DensityBand {
  id: 'distributed' | 'observed' | 'concentrated' | 'fragile' | 'critical';
  label: string;
  posture: string;
  /** Lower bound, inclusive. The first band whose lower bound is <= index wins (descending check). */
  lowerBound: number;
}

export const DENSITY_BANDS: readonly DensityBand[] = Object.freeze([
  Object.freeze({
    id: 'critical' as const,
    label: 'Critical concentration',
    posture:
      'A small number of carriers hold institution-critical responsibility without identified successors. This is the configuration in which continuity is most likely to fail quietly.',
    lowerBound: 0.7,
  }),
  Object.freeze({
    id: 'fragile' as const,
    label: 'Fragile concentration',
    posture:
      'Continuity is carried by too few people relative to the organizational weight involved. Stabilization is appropriate before the next personnel transition.',
    lowerBound: 0.5,
  }),
  Object.freeze({
    id: 'concentrated' as const,
    label: 'Concentrated stewardship',
    posture:
      'Stewardship is recognisable but narrow. Identifying successors for load-bearing roles would meaningfully reduce continuity risk.',
    lowerBound: 0.3,
  }),
  Object.freeze({
    id: 'observed' as const,
    label: 'Observed but uneven',
    posture:
      'Stewardship is observed across multiple carriers, but distribution is uneven. Modest broadening is appropriate.',
    lowerBound: 0.15,
  }),
  Object.freeze({
    id: 'distributed' as const,
    label: 'Distributed stewardship',
    posture:
      'Stewardship appears reasonably distributed across continuity carriers. Periodic review is sufficient.',
    lowerBound: 0,
  }),
]);

export interface StewardshipDensityResult {
  /** 0.0 – 1.0. Higher is more concentrated and more fragile. */
  index: number;
  band: DensityBand;
  totalCarriers: number;
  loadBearingCount: number;
  institutionCriticalCount: number;
  unsuccessedLoadBearingCount: number;
  unsuccessedInstitutionCriticalCount: number;
  /** Sum of criticality weights for all carriers (denominator). */
  totalWeight: number;
  /** Sum of criticality×tenure weight for carriers without identified successor. */
  exposedWeight: number;
}

function emptyResult(): StewardshipDensityResult {
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

function isKnownCriticality(c: unknown): c is Criticality {
  return typeof c === 'string' && Object.prototype.hasOwnProperty.call(CRITICALITY_WEIGHT, c);
}

function isKnownTenure(t: unknown): t is TenureBand {
  return typeof t === 'string' && Object.prototype.hasOwnProperty.call(TENURE_AMPLIFIER, t);
}

export function computeStewardshipDensity(
  holders: readonly HolderForIndex[],
): StewardshipDensityResult {
  if (!Array.isArray(holders) || holders.length === 0) return emptyResult();

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

    const crit = h.criticality;
    if (crit === null || crit === undefined) continue;
    if (!isKnownCriticality(crit)) continue;

    const critWeight = CRITICALITY_WEIGHT[crit];
    const tenureBandValue = h.tenureBand;
    const tenureWeight = isKnownTenure(tenureBandValue) ? TENURE_AMPLIFIER[tenureBandValue] : 1.0;
    const weight = critWeight * tenureWeight;
    if (!Number.isFinite(weight)) continue;

    totalWeight += weight;
    if (!h.successorIdentified) exposedWeight += weight;

    if (crit === 'load_bearing') {
      loadBearingCount += 1;
      if (!h.successorIdentified) unsuccessedLoadBearingCount += 1;
    }
    if (crit === 'institution_critical') {
      institutionCriticalCount += 1;
      if (!h.successorIdentified) unsuccessedInstitutionCriticalCount += 1;
    }
  }

  if (totalCarriers === 0) return emptyResult();

  const rawIndex = totalWeight === 0 ? 0 : exposedWeight / totalWeight;
  const safeIndex = Number.isFinite(rawIndex) ? clamp01(rawIndex) : 0;
  const band = classifyDensity(safeIndex);

  return {
    index: round2(safeIndex),
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
  const safe = Number.isFinite(index) ? clamp01(index) : 0;
  for (const band of DENSITY_BANDS) {
    if (safe >= band.lowerBound) return band;
  }
  return DENSITY_BANDS[DENSITY_BANDS.length - 1];
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
