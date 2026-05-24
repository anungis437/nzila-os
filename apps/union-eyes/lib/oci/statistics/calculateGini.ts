/**
 * ARTIFACT TYPE: IP / Framework
 * MODULE: lib/oci/statistics/calculateGini
 * DOCTRINE_VERSION: 1.0.0
 *
 * Gini coefficient for stewardship inequality / continuity burden /
 * governance continuity distribution. Pure, deterministic.
 *
 * Formula (Brown-style on sorted weights):
 *   G = ( sum_{i=1..n} (2i - n - 1) * x_i ) / ( n * sum(x_i) )
 *
 * Bounds invariants:
 *   - value ∈ [0, 1] (clamped numerically).
 *   - bands: EXTREME ≥ 0.6, INEQUITABLE ≥ 0.4, UNEVEN ≥ 0.2, else EVEN.
 */

import type { ConcentrationInput, GiniResult, GiniBand } from './statisticalAnchorContracts';
import type { CautionState } from '@nzila/oci-confidence';
import { buildConfidenceEnvelope } from '@nzila/oci-confidence';

const GINI_THRESHOLDS = Object.freeze({ extreme: 0.6, inequitable: 0.4, uneven: 0.2 });

function bandFor(value: number): GiniBand {
  if (value >= GINI_THRESHOLDS.extreme) return 'EXTREME';
  if (value >= GINI_THRESHOLDS.inequitable) return 'INEQUITABLE';
  if (value >= GINI_THRESHOLDS.uneven) return 'UNEVEN';
  return 'EVEN';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function calculateGini(inputs: ReadonlyArray<ConcentrationInput>): GiniResult {
  const valid = inputs
    .filter((x) => typeof x.weight === 'number' && Number.isFinite(x.weight) && x.weight >= 0)
    .map((x) => x.weight)
    .sort((a, b) => a - b);
  const n = valid.length;

  if (n === 0) {
    return Object.freeze({
      value: 0,
      band: 'EVEN',
      population: 0,
      confidence: 'INSUFFICIENT',
      cautionStates: Object.freeze<CautionState[]>(['SMALL_SAMPLE']),
      rationale: Object.freeze(['no valid weights provided']),
    });
  }
  if (n === 1) {
    return Object.freeze({
      value: 0,
      band: 'EVEN',
      population: 1,
      confidence: 'INSUFFICIENT',
      cautionStates: Object.freeze<CautionState[]>(['SMALL_SAMPLE']),
      rationale: Object.freeze(['single observation; gini undefined, returning 0']),
    });
  }

  const total = valid.reduce((acc, x) => acc + x, 0);
  if (total <= 0) {
    return Object.freeze({
      value: 0,
      band: 'EVEN',
      population: n,
      confidence: 'INSUFFICIENT',
      cautionStates: Object.freeze<CautionState[]>(['INCOMPLETE_VISIBILITY']),
      rationale: Object.freeze(['total weight is zero']),
    });
  }

  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (2 * (i + 1) - n - 1) * valid[i];
  }
  const raw = weightedSum / (n * total);
  const value = clamp01(raw);
  const band = bandFor(value);

  const env = buildConfidenceEnvelope(value, {
    sampleSize: n,
    dataCompleteness: 1,
    stability: 'UNKNOWN',
  });

  return Object.freeze({
    value: Number(value.toFixed(4)),
    band,
    population: n,
    confidence: env.confidence,
    cautionStates: env.cautionStates,
    rationale: Object.freeze([`population=${n}`, `band=${band}`]),
  });
}

export const GINI_BAND_THRESHOLDS = GINI_THRESHOLDS;
