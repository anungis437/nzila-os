/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Reconstruction Burden Index\u2122
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
 */

export interface ReconstructionInputs {
  /** Count of continuity carriers without identified successors. */
  exposedCarriers: number;
  /** Count of carriers tagged institution-critical. */
  institutionCriticalCarriers: number;
  /** Stewardship Density Index (0\u20131). */
  densityIndex: number;
  /** Optional governance entropy ordinal (1\u20135). Defaults to 2 (recognised drift). */
  governanceEntropyOrdinal?: 1 | 2 | 3 | 4 | 5;
}

export interface ReconstructionBurdenResult {
  /** 0\u201310 scale. Operational-disruption units. */
  score: number;
  band: 'minimal' | 'moderate' | 'substantial' | 'severe';
  posture: string;
}

export function computeReconstructionBurden(
  inputs: ReconstructionInputs,
): ReconstructionBurdenResult {
  const exposedComponent = Math.min(4, inputs.exposedCarriers * 0.8);
  const criticalComponent = Math.min(3, inputs.institutionCriticalCarriers * 1.0);
  const densityComponent = inputs.densityIndex * 2.0;
  const entropyComponent = ((inputs.governanceEntropyOrdinal ?? 2) - 1) * 0.25;

  const score = round1(
    Math.min(10, exposedComponent + criticalComponent + densityComponent + entropyComponent),
  );

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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
