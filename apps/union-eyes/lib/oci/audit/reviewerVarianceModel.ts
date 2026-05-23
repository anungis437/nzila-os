/**
 * ARTIFACT TYPE: IP / Framework
 * MODULE: lib/oci/audit/reviewerVarianceModel (Reviewer Consistency Layer™)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Tracks reviewer drift, interpretation variance, and escalation
 * frequency across a reviewer cohort.
 *
 * Hard doctrine: PRESERVE REVIEWER-LED INTERPRETATION while
 * CONSTRAINING METHODOLOGICAL DRIFT. This model never overrides a
 * reviewer; it surfaces calibration signals for facilitators.
 */

import type {
  ReviewerVarianceInput,
  ReviewerVarianceResult,
} from './entropyAuditContracts';
import type { ConfidenceState } from '@nzila/oci-confidence';

function mean(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function variance(values: ReadonlyArray<number>): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
}

export function analyseReviewerVariance(
  inputs: ReadonlyArray<ReviewerVarianceInput>,
): ReviewerVarianceResult {
  if (inputs.length === 0) {
    return Object.freeze({
      reviewerAgreement: 0,
      entropyVariance: 0,
      escalationRate: 0,
      calibrationConfidence: 'INSUFFICIENT' as ConfidenceState,
      indicators: Object.freeze(['no reviewer inputs']),
    });
  }

  const ordinals = inputs.map((i) => i.entropyOrdinal);
  const confidences = inputs.map((i) => i.classificationConfidence);
  const escalations = inputs.filter((i) => i.escalated).length;

  const entropyVariance = Number(variance(ordinals).toFixed(4));
  const reviewerAgreement = Number((1 - Math.min(1, entropyVariance / 4)).toFixed(4));
  const escalationRate = Number((escalations / inputs.length).toFixed(4));
  const avgConfidence = mean(confidences);

  const indicators: string[] = [];
  if (entropyVariance > 1) indicators.push('elevated entropy classification disagreement');
  if (escalationRate > 0.3) indicators.push('elevated reviewer escalation rate');
  if (avgConfidence < 0.5) indicators.push('reviewer-reported classification confidence is low');
  if (inputs.length < 3) indicators.push('reviewer panel below calibration threshold');

  let calibrationConfidence: ConfidenceState;
  if (inputs.length < 3 || entropyVariance > 2) calibrationConfidence = 'INSUFFICIENT';
  else if (entropyVariance > 1 || escalationRate > 0.3) calibrationConfidence = 'LOW';
  else if (reviewerAgreement >= 0.9 && avgConfidence >= 0.7) calibrationConfidence = 'HIGH';
  else calibrationConfidence = 'MODERATE';

  return Object.freeze({
    reviewerAgreement,
    entropyVariance,
    escalationRate,
    calibrationConfidence,
    indicators: Object.freeze(indicators),
  });
}
