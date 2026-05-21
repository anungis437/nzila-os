/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Continuity Breakpoints
 * DOCTRINE_VERSION: 2.0.0
 *
 * Reconstruction Burden Analyzer — composes Reconstruction Burden Index™
 * outputs across the workbook's named carriers and processes into a
 * per-breakpoint reconstruction estimate.
 *
 * Pure, deterministic.
 */

import {
  computeReconstructionBurden,
  type ReconstructionBurdenResult,
} from '../../oci/frameworks/reconstruction-burden-index';

export interface BreakpointReconstructionInput {
  /** Stable abstract id for the breakpoint, e.g. "process_A_continuity". */
  readonly id: string;
  /** Abstract subject label. */
  readonly subject: string;
  readonly exposedCarriers: number;
  readonly institutionCriticalCarriers: number;
  readonly densityIndex: number;
  readonly governanceEntropyOrdinal?: 1 | 2 | 3 | 4 | 5;
}

export interface BreakpointReconstructionResult {
  readonly id: string;
  readonly subject: string;
  readonly burden: ReconstructionBurdenResult;
}

export function analyzeReconstructionBurden(
  inputs: readonly BreakpointReconstructionInput[],
): readonly BreakpointReconstructionResult[] {
  return inputs.map((input) => ({
    id: input.id,
    subject: input.subject,
    burden: computeReconstructionBurden({
      exposedCarriers: input.exposedCarriers,
      institutionCriticalCarriers: input.institutionCriticalCarriers,
      densityIndex: input.densityIndex,
      governanceEntropyOrdinal: input.governanceEntropyOrdinal,
    }),
  }));
}

export function aggregateReconstructionBurden(
  results: readonly BreakpointReconstructionResult[],
): {
  readonly meanScore: number;
  readonly maxScore: number;
  readonly severeCount: number;
  readonly substantialCount: number;
} {
  if (results.length === 0) {
    return { meanScore: 0, maxScore: 0, severeCount: 0, substantialCount: 0 };
  }
  let sum = 0;
  let max = 0;
  let severe = 0;
  let substantial = 0;
  for (const r of results) {
    sum += r.burden.score;
    if (r.burden.score > max) max = r.burden.score;
    if (r.burden.band === 'severe') severe += 1;
    if (r.burden.band === 'substantial') substantial += 1;
  }
  return {
    meanScore: Math.round((sum / results.length) * 10) / 10,
    maxScore: Math.round(max * 10) / 10,
    severeCount: severe,
    substantialCount: substantial,
  };
}
