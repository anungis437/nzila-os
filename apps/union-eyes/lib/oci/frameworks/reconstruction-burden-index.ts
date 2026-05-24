/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Reconstruction Burden Index™
 * DOCTRINE_VERSION: 1.0.0
 *
 * Estimates the cost (in operational disruption units) of reconstructing
 * organizational knowledge after a continuity break. Composes carrier
 * count, criticality distribution, and successor readiness into a single
 * deterministic scalar.
 *
 * Pure, deterministic. Typed scaffold; Self-Guided Edition exposes the
 * scalar in the PDF executive narrative. Full breakdown lands in
 * Facilitated Edition.
 *
 * Hardening invariants:
 *   1. Negative or non-finite carrier counts are coerced to 0.
 *   2. densityIndex is clamped to [0,1].
 *   3. governanceEntropyOrdinal is validated to be an integer in 1..5;
 *      anything else falls back to the documented default of 2.
 *   4. Final score is always finite and in [0,10].
 */

export interface ReconstructionInputs {
  /** Count of continuity carriers without identified successors. */
  exposedCarriers: number;
  /** Count of carriers tagged institution-critical. */
  institutionCriticalCarriers: number;
  /** Stewardship Density Index (0–1). */
  densityIndex: number;
  /** Optional governance entropy ordinal (1–5). Defaults to 2 (recognised drift). */
  governanceEntropyOrdinal?: 1 | 2 | 3 | 4 | 5;
}

export interface ReconstructionBurdenResult {
  /** 0–10 scale. Operational-disruption units. */
  score: number;
  band: 'minimal' | 'moderate' | 'substantial' | 'severe';
  posture: string;
}

const EXPOSED_CAP = 4;
const CRITICAL_CAP = 3;
const DEFAULT_ENTROPY_ORDINAL = 2;
const MAX_SCORE = 10;

export function computeReconstructionBurden(
  inputs: ReconstructionInputs,
): ReconstructionBurdenResult {
  const exposed = nonNegative(inputs?.exposedCarriers);
  const critical = nonNegative(inputs?.institutionCriticalCarriers);
  const density = clamp01Safe(inputs?.densityIndex);
  const entropyOrdinal = validOrdinal(inputs?.governanceEntropyOrdinal);

  const exposedComponent = Math.min(EXPOSED_CAP, exposed * 0.8);
  const criticalComponent = Math.min(CRITICAL_CAP, critical * 1.0);
  const densityComponent = density * 2.0;
  const entropyComponent = (entropyOrdinal - 1) * 0.25;

  const raw = exposedComponent + criticalComponent + densityComponent + entropyComponent;
  const safe = Number.isFinite(raw) ? clamp(raw, 0, MAX_SCORE) : 0;
  const score = round1(safe);

  return {
    score,
    band: classifyBurden(score),
    posture: posturalStatement(score),
  };
}

function classifyBurden(score: number): ReconstructionBurdenResult['band'] {
  if (score >= 7) return 'severe';
  if (score >= 5) return 'substantial';
  if (score >= 3) return 'moderate';
  return 'minimal';
}

function posturalStatement(score: number): string {
  if (score >= 7) {
    return 'Reconstruction would require sustained organizational effort and an external facilitator. Continuity break before then would have multi-year operational impact.';
  }
  if (score >= 5) {
    return 'Reconstruction would require months of internal effort and may not fully recover prior practice. Stabilization is appropriate.';
  }
  if (score >= 3) {
    return 'Reconstruction is feasible with planning. Recording lineage and identifying successors materially reduces the burden.';
  }
  return 'Reconstruction burden is modest. Continue periodic review.';
}

function nonNegative(n: number | undefined | null): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return n;
}

function clamp01Safe(n: number | undefined | null): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return clamp(n, 0, 1);
}

function validOrdinal(n: unknown): 1 | 2 | 3 | 4 | 5 {
  if (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5) {
    return n as 1 | 2 | 3 | 4 | 5;
  }
  return DEFAULT_ENTROPY_ORDINAL;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
