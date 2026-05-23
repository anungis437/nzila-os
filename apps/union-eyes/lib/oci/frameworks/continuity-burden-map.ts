/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Continuity Burden Map™
 * DOCTRINE_VERSION: 1.0.0
 *
 * Identifies and weights the invisible continuity burden a few people are
 * absorbing on behalf of the institution. Composes the Stewardship Density
 * Index with cross-dimensional burden indicators (informal documentation,
 * reconstruction risk, human compensation).
 *
 * Currently shaped as a typed surface that consumes Workbook memory-holder
 * aggregates and ICRA burden index outputs. Full visualization lands in
 * the Facilitated Edition; the Self-Guided Edition exposes the underlying
 * aggregate via the Memory Holders module + PDF export.
 *
 * Hardening invariants:
 *   1. All numeric inputs are clamped to [0,1]; NaN/Infinity coerced to 0.
 *   2. Composite is always finite and in [0,1].
 *   3. Returned arrays are frozen.
 *   4. Component weights sum to 1.0 (0.6 + 0.25 + 0.15).
 */

import type { StewardshipDensityResult } from './stewardship-density-index';

export interface ContinuityBurdenInputs {
  density: StewardshipDensityResult;
  /** Optional ICRA-derived burden index (0–1). */
  icraBurdenIndex?: number;
  /** Optional reconstruction risk score (0–1). */
  reconstructionRisk?: number;
}

export interface ContinuityBurdenMapResult {
  /** 0.0 – 1.0. Composite burden carried by named carriers. */
  composite: number;
  /** Plain-language posture statement (en-CA). */
  posture: string;
  contributingFactors: ReadonlyArray<{
    factor: string;
    weight: number;
  }>;
}

const DENSITY_WEIGHT = 0.6;
const ICRA_WEIGHT = 0.25;
const RECONSTRUCTION_WEIGHT = 0.15;

export function computeContinuityBurdenMap(
  inputs: ContinuityBurdenInputs,
): ContinuityBurdenMapResult {
  const densityIndex = safe01(inputs?.density?.index);
  const icra = safe01(inputs?.icraBurdenIndex);
  const reconstruction = safe01(inputs?.reconstructionRisk);

  const densityComponent = densityIndex * DENSITY_WEIGHT;
  const icraComponent = icra * ICRA_WEIGHT;
  const reconstructionComponent = reconstruction * RECONSTRUCTION_WEIGHT;

  const composite = round2(
    clamp01(densityComponent + icraComponent + reconstructionComponent),
  );

  const factors = [
    { factor: 'Stewardship Density Index\u2122', weight: round2(densityComponent) },
    { factor: 'ICRA continuity burden indicator', weight: round2(icraComponent) },
    { factor: 'Reconstruction risk', weight: round2(reconstructionComponent) },
  ].filter((f) => f.weight > 0);

  return {
    composite,
    posture: posturalStatement(composite),
    contributingFactors: Object.freeze(factors.map((f) => Object.freeze(f))),
  };
}

function posturalStatement(composite: number): string {
  if (composite >= 0.7) {
    return 'A significant share of operational coherence is being held by a small number of carriers without redundancy.';
  }
  if (composite >= 0.5) {
    return 'Continuity burden is concentrated enough that a single transition would meaningfully reduce institutional capacity.';
  }
  if (composite >= 0.3) {
    return 'Continuity burden is recognisable. Identifying successors and recording lineage would reduce institutional exposure.';
  }
  return 'Continuity burden appears reasonably distributed. Periodic review remains appropriate.';
}

function safe01(n: number | undefined | null): number {
  if (n === undefined || n === null) return 0;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return clamp01(n);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
