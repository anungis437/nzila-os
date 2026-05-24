/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Continuity Burden Map\u2122
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
 */

import type { StewardshipDensityResult } from './stewardship-density-index';

export interface ContinuityBurdenInputs {
  density: StewardshipDensityResult;
  /** Optional ICRA-derived burden index (0\u20131). */
  icraBurdenIndex?: number;
  /** Optional reconstruction risk score (0\u20131). */
  reconstructionRisk?: number;
}

export interface ContinuityBurdenMapResult {
  /** 0.0 \u2013 1.0. Composite burden carried by named carriers. */
  composite: number;
  /** Plain-language posture statement (en-CA). */
  posture: string;
  contributingFactors: ReadonlyArray<{
    factor: string;
    weight: number;
  }>;
}

export function computeContinuityBurdenMap(
  inputs: ContinuityBurdenInputs,
): ContinuityBurdenMapResult {
  const densityComponent = inputs.density.index * 0.6;
  const icraComponent = (inputs.icraBurdenIndex ?? 0) * 0.25;
  const reconstructionComponent = (inputs.reconstructionRisk ?? 0) * 0.15;
  const composite = round2(
    Math.min(1, densityComponent + icraComponent + reconstructionComponent),
  );

  const factors = [
    { factor: 'Stewardship Density Index\u2122', weight: round2(densityComponent) },
    { factor: 'ICRA continuity burden indicator', weight: round2(icraComponent) },
    { factor: 'Reconstruction risk', weight: round2(reconstructionComponent) },
  ].filter((f) => f.weight > 0);

  return {
    composite,
    posture: posturalStatement(composite),
    contributingFactors: factors,
  };
}

function posturalStatement(composite: number): string {
  if (composite >= 0.7) {
    return 'A significant share of operational coherence is being held by a small number of carriers without redundancy.';
  }
  if (composite >= 0.5) {
    return 'Continuity burden is concentrated enough that a single transition would meaningfully reduce organizational capacity.';
  }
  if (composite >= 0.3) {
    return 'Continuity burden is recognisable. Identifying successors and recording lineage would reduce organizational exposure.';
  }
  return 'Continuity burden appears reasonably distributed. Periodic review remains appropriate.';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
