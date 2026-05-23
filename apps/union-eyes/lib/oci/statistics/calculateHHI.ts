/**
 * ARTIFACT TYPE: IP / Framework
 * MODULE: lib/oci/statistics/calculateHHI
 * DOCTRINE_VERSION: 1.0.0
 *
 * Herfindahl-Hirschman Index for stewardship/governance/continuity
 * concentration. Operates on aggregate weights only — no holder names
 * inspected.
 *
 * Bounds invariants:
 *   - value ∈ [1/n, 1] for n ≥ 1; 0 when n=0.
 *   - scaled = round(value * 10000), in [0, 10000].
 *   - bands: HIGHLY_CONCENTRATED ≥ 0.25, CONCENTRATED ≥ 0.15,
 *            MODERATE ≥ 0.10, otherwise DISTRIBUTED (DOJ-style anchors).
 */

import type { ConcentrationInput, HHIResult, HHIBand } from './statisticalAnchorContracts';
import type { CautionState } from '@nzila/oci-confidence';
import { buildConfidenceEnvelope } from '@nzila/oci-confidence';

const HHI_THRESHOLDS = Object.freeze({
  highlyConcentrated: 0.25,
  concentrated: 0.15,
  moderate: 0.1,
});

function bandFor(value: number): HHIBand {
  if (value >= HHI_THRESHOLDS.highlyConcentrated) return 'HIGHLY_CONCENTRATED';
  if (value >= HHI_THRESHOLDS.concentrated) return 'CONCENTRATED';
  if (value >= HHI_THRESHOLDS.moderate) return 'MODERATE';
  return 'DISTRIBUTED';
}

export function calculateHHI(inputs: ReadonlyArray<ConcentrationInput>): HHIResult {
  const valid = inputs.filter(
    (x) => typeof x.weight === 'number' && Number.isFinite(x.weight) && x.weight > 0,
  );
  const population = valid.length;

  if (population === 0) {
    const env = buildConfidenceEnvelope(0, { sampleSize: 0 });
    return Object.freeze({
      value: 0,
      scaled: 0,
      band: 'DISTRIBUTED',
      population: 0,
      confidence: env.confidence,
      cautionStates: env.cautionStates,
      rationale: Object.freeze(['no valid weights provided']),
    });
  }

  const total = valid.reduce((acc, x) => acc + x.weight, 0);
  if (total <= 0) {
    return Object.freeze({
      value: 0,
      scaled: 0,
      band: 'DISTRIBUTED',
      population,
      confidence: 'INSUFFICIENT',
      cautionStates: Object.freeze<CautionState[]>(['INCOMPLETE_VISIBILITY']),
      rationale: Object.freeze(['total weight is zero']),
    });
  }

  const sumOfSquares = valid.reduce((acc, x) => {
    const share = x.weight / total;
    return acc + share * share;
  }, 0);

  // Numerical bound: HHI ∈ [1/n, 1]
  const value = Math.min(1, Math.max(1 / population, sumOfSquares));
  const scaled = Math.round(value * 10000);
  const band = bandFor(value);

  const env = buildConfidenceEnvelope(value, {
    sampleSize: population,
    dataCompleteness: 1,
    stability: 'UNKNOWN',
  });

  return Object.freeze({
    value: Number(value.toFixed(4)),
    scaled,
    band,
    population,
    confidence: env.confidence,
    cautionStates: env.cautionStates,
    rationale: Object.freeze([
      `population=${population}`,
      `sumOfSquares=${sumOfSquares.toFixed(4)}`,
      `band=${band}`,
    ]),
  });
}

export const HHI_BAND_THRESHOLDS = HHI_THRESHOLDS;
