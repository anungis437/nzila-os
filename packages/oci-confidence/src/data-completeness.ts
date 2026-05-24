/**
 * ARTIFACT TYPE: IP / Module
 * PACKAGE: @nzila/oci-confidence
 * MODULE: data-completeness
 * DOCTRINE_VERSION: 1.0.0
 *
 * Data-completeness scoring. Maps a present-count over expected-count
 * to a clamped score in [0,1] and surfaces a caution when below
 * the methodology threshold.
 */

import type { CautionState } from './confidenceContracts';

const COMPLETE_THRESHOLD = 0.85;
const PARTIAL_THRESHOLD = 0.6;

export interface CompletenessResult {
  readonly score: number;
  readonly band: 'complete' | 'partial' | 'incomplete';
  readonly caution: CautionState | null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function scoreCompleteness(present: number, expected: number): CompletenessResult {
  if (!Number.isFinite(present) || !Number.isFinite(expected) || expected <= 0) {
    return Object.freeze({ score: 0, band: 'incomplete', caution: 'INCOMPLETE_VISIBILITY' });
  }
  const score = clamp01(present / expected);
  if (score >= COMPLETE_THRESHOLD) {
    return Object.freeze({ score, band: 'complete', caution: null });
  }
  if (score >= PARTIAL_THRESHOLD) {
    return Object.freeze({ score, band: 'partial', caution: 'INCOMPLETE_VISIBILITY' });
  }
  return Object.freeze({ score, band: 'incomplete', caution: 'INCOMPLETE_VISIBILITY' });
}

export const COMPLETENESS_THRESHOLDS = Object.freeze({
  complete: COMPLETE_THRESHOLD,
  partial: PARTIAL_THRESHOLD,
});
