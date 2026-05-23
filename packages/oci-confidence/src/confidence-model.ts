/**
 * ARTIFACT TYPE: IP / Framework
 * PACKAGE: @nzila/oci-confidence
 * MODULE: confidence-model (Universal OCI Confidence Model™)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Wraps a primary OCI framework value in the Universal Confidence
 * Envelope. Deterministic. Composes:
 *   - sample-size threshold logic
 *   - data-completeness scoring
 *   - stability classification
 *   - temporal decay
 *   - reviewer-variance signal
 *   - interpretive cautions
 *
 * No probability claims. No ranking. No behavioural inference.
 */

import type {
  ConfidenceEnvelope,
  ConfidenceInputs,
  ConfidenceState,
  CautionState,
  StabilityState,
} from './confidenceContracts';
import { applyDecay, classifyDecay } from './confidence-decay';

const DEFAULT_MIN_SAMPLE_HIGH = 10;
const DEFAULT_MIN_SAMPLE_MODERATE = 5;
const HIGH_VARIANCE_THRESHOLD = 0.4;

export interface ConfidenceModelOptions {
  readonly minSampleHigh?: number;
  readonly minSampleModerate?: number;
}

function classifyByCompleteness(completeness: number): ConfidenceState {
  if (completeness >= 0.85) return 'HIGH';
  if (completeness >= 0.6) return 'MODERATE';
  if (completeness > 0) return 'LOW';
  return 'INSUFFICIENT';
}

function classifyBySample(
  sample: number,
  options: ConfidenceModelOptions,
): ConfidenceState {
  const high = options.minSampleHigh ?? DEFAULT_MIN_SAMPLE_HIGH;
  const moderate = options.minSampleModerate ?? DEFAULT_MIN_SAMPLE_MODERATE;
  if (sample <= 0) return 'INSUFFICIENT';
  if (sample >= high) return 'HIGH';
  if (sample >= moderate) return 'MODERATE';
  return 'LOW';
}

function lower(a: ConfidenceState, b: ConfidenceState): ConfidenceState {
  const order: Record<ConfidenceState, number> = {
    HIGH: 3,
    MODERATE: 2,
    LOW: 1,
    INSUFFICIENT: 0,
  };
  return order[a] <= order[b] ? a : b;
}

function dedupeCautions(cautions: ReadonlyArray<CautionState | null>): ReadonlyArray<CautionState> {
  const seen = new Set<CautionState>();
  const out: CautionState[] = [];
  for (const c of cautions) {
    if (c == null || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return Object.freeze(out);
}

function clamp01(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function buildConfidenceEnvelope<TScore>(
  score: TScore,
  inputs: ConfidenceInputs = {},
  options: ConfidenceModelOptions = {},
): ConfidenceEnvelope<TScore> {
  const sampleSize = Math.max(0, Math.floor(Number(inputs.sampleSize ?? 0)));
  const completeness = clamp01(inputs.dataCompleteness);
  const stability: StabilityState = inputs.stability ?? 'UNKNOWN';
  const ageDays =
    typeof inputs.assessmentAgeDays === 'number' && Number.isFinite(inputs.assessmentAgeDays)
      ? Math.max(0, inputs.assessmentAgeDays)
      : null;
  const variance = clamp01(inputs.reviewerVariance);

  const decay = classifyDecay(ageDays);
  const sampleBand = classifyBySample(sampleSize, options);
  const completenessBand =
    inputs.dataCompleteness == null ? sampleBand : classifyByCompleteness(completeness);

  let base: ConfidenceState = lower(sampleBand, completenessBand);

  if (stability === 'VOLATILE') base = lower(base, 'LOW');
  else if (stability === 'TRANSITIONAL') base = lower(base, 'MODERATE');

  if (variance >= HIGH_VARIANCE_THRESHOLD) base = lower(base, 'LOW');

  if (inputs.governanceEvidencePresent === false) base = lower(base, 'LOW');

  const finalConfidence = applyDecay(base, decay.band);

  const cautions: Array<CautionState | null> = [];
  if (sampleBand === 'LOW' || sampleBand === 'INSUFFICIENT') cautions.push('SMALL_SAMPLE');
  if (
    inputs.dataCompleteness != null &&
    (completenessBand === 'LOW' || completenessBand === 'INSUFFICIENT' || completenessBand === 'MODERATE')
  ) {
    cautions.push('INCOMPLETE_VISIBILITY');
  }
  if (stability === 'TRANSITIONAL' || stability === 'VOLATILE') cautions.push('TRANSITIONAL_INSTABILITY');
  if (variance >= HIGH_VARIANCE_THRESHOLD) cautions.push('HIGH_VARIANCE');
  if (inputs.governanceEvidencePresent === false) cautions.push('LIMITED_GOVERNANCE_EVIDENCE');
  cautions.push(decay.caution);

  const cautionStates = dedupeCautions(cautions);

  const rationale: string[] = [];
  rationale.push(`sample size: ${sampleSize} (band ${sampleBand})`);
  if (inputs.dataCompleteness != null)
    rationale.push(`data completeness: ${completeness.toFixed(2)} (band ${completenessBand})`);
  rationale.push(`stability: ${stability}`);
  rationale.push(`decay: ${decay.band}${ageDays != null ? ` at ${ageDays}d` : ''}`);
  if (variance > 0) rationale.push(`reviewer variance: ${variance.toFixed(2)}`);
  rationale.push(`final confidence: ${finalConfidence}`);

  return Object.freeze({
    score,
    confidence: finalConfidence,
    sampleSize,
    dataCompleteness: completeness,
    stability,
    cautionStates,
    confidenceRationale: Object.freeze(rationale),
    decay: decay.band,
    assessmentAgeDays: ageDays,
  });
}

export const CONFIDENCE_DEFAULTS = Object.freeze({
  minSampleHigh: DEFAULT_MIN_SAMPLE_HIGH,
  minSampleModerate: DEFAULT_MIN_SAMPLE_MODERATE,
  highVarianceThreshold: HIGH_VARIANCE_THRESHOLD,
});
