/**
 * CLC Decision Intelligence — Confidence Model
 *
 * Multi-factor confidence scoring for decision intelligence outputs.
 * Combines cohort size, data recency, signal agreement, source count,
 * persistence, and missing-data penalties into a composite score.
 *
 * @module confidence
 */

import type { ConfidenceInputs, ConfidenceResult } from '../contracts/index.js';

// ── Factor Weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  cohort: 0.25,
  recency: 0.20,
  agreement: 0.20,
  source: 0.10,
  persistence: 0.15,
  missingData: 0.10,
} as const;

// ── Factor Calculators ──────────────────────────────────────────────────────

/**
 * Cohort factor: larger cohorts → higher confidence.
 * Saturates at ~20 orgs (diminishing returns beyond that).
 */
export function computeCohortFactor(cohortSize: number): number {
  if (cohortSize <= 0) return 0;
  if (cohortSize < 5) return cohortSize * 0.1; // 0.1-0.4 for tiny cohorts
  if (cohortSize < 10) return 0.5 + (cohortSize - 5) * 0.06; // 0.5-0.8
  if (cohortSize < 20) return 0.8 + (cohortSize - 10) * 0.02; // 0.8-1.0
  return 1.0;
}

/**
 * Recency factor: fresher data → higher confidence.
 * Data older than 90 days is penalized significantly.
 */
export function computeRecencyFactor(recencyDays: number): number {
  if (recencyDays <= 0) return 1.0;
  if (recencyDays <= 7) return 0.95;
  if (recencyDays <= 30) return 0.85;
  if (recencyDays <= 60) return 0.65;
  if (recencyDays <= 90) return 0.45;
  return Math.max(0.1, 0.45 - (recencyDays - 90) * 0.003);
}

/**
 * Signal agreement factor: multiple independent signals agreeing → higher confidence.
 * Input is 0-1 where 1 = perfect agreement.
 */
export function computeAgreementFactor(signalAgreement: number): number {
  return Math.max(0, Math.min(1, signalAgreement));
}

/**
 * Source count factor: more independent data sources → higher confidence.
 * Saturates at 5+ sources.
 */
export function computeSourceFactor(sourceCount: number): number {
  if (sourceCount <= 0) return 0;
  if (sourceCount === 1) return 0.4;
  if (sourceCount === 2) return 0.6;
  if (sourceCount === 3) return 0.75;
  if (sourceCount === 4) return 0.9;
  return 1.0;
}

/**
 * Persistence factor: longer-running patterns → higher confidence.
 * Input is 0-1 where 1 = multi-quarter persistence.
 */
export function computePersistenceFactor(persistenceScore: number): number {
  return Math.max(0, Math.min(1, persistenceScore));
}

/**
 * Missing-data penalty: incomplete data → lower confidence.
 * Input is 0-1 where 0 = complete data, 1 = severe gaps.
 */
export function computeMissingDataFactor(missingDataPenalty: number): number {
  return Math.max(0, 1 - Math.min(1, missingDataPenalty));
}

// ── Main Confidence Calculator ──────────────────────────────────────────────

/**
 * Compute composite confidence from multi-factor inputs.
 *
 * Returns a confidence score (0-1), a human-readable band,
 * and a natural-language explanation.
 */
export function computeConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const factors = {
    cohortFactor: computeCohortFactor(inputs.cohortSize),
    recencyFactor: computeRecencyFactor(inputs.recencyDays),
    agreementFactor: computeAgreementFactor(inputs.signalAgreement),
    sourceFactor: computeSourceFactor(inputs.sourceCount),
    persistenceFactor: computePersistenceFactor(inputs.persistenceScore),
    missingDataFactor: computeMissingDataFactor(inputs.missingDataPenalty),
  };

  const confidence =
    factors.cohortFactor * WEIGHTS.cohort +
    factors.recencyFactor * WEIGHTS.recency +
    factors.agreementFactor * WEIGHTS.agreement +
    factors.sourceFactor * WEIGHTS.source +
    factors.persistenceFactor * WEIGHTS.persistence +
    factors.missingDataFactor * WEIGHTS.missingData;

  const rounded = Math.round(confidence * 100) / 100;

  const confidenceBand: ConfidenceResult['confidenceBand'] =
    rounded >= 0.7 ? 'high' : rounded >= 0.4 ? 'medium' : 'low';

  const explanation = buildExplanation(inputs, factors, confidenceBand);

  return { confidence: rounded, confidenceBand, confidenceExplanation: explanation, factors };
}

/**
 * Derive a confidence band from a raw score.
 * Used when confidence is already computed externally.
 */
export function confidenceBandFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

// ── Internal ────────────────────────────────────────────────────────────────

function buildExplanation(
  inputs: ConfidenceInputs,
  factors: ConfidenceResult['factors'],
  band: ConfidenceResult['confidenceBand'],
): string {
  const parts: string[] = [];

  if (factors.cohortFactor < 0.5) {
    parts.push(`small cohort (${inputs.cohortSize} orgs)`);
  } else if (factors.cohortFactor >= 0.8) {
    parts.push(`strong cohort (${inputs.cohortSize} orgs)`);
  }

  if (factors.recencyFactor < 0.5) {
    parts.push(`stale data (${inputs.recencyDays}d old)`);
  } else if (factors.recencyFactor >= 0.85) {
    parts.push('recent data');
  }

  if (factors.agreementFactor < 0.5) {
    parts.push('inconsistent signals');
  } else if (factors.agreementFactor >= 0.8) {
    parts.push('strong signal agreement');
  }

  if (factors.missingDataFactor < 0.5) {
    parts.push('significant data gaps');
  }

  if (factors.persistenceFactor >= 0.7) {
    parts.push('sustained pattern');
  } else if (factors.persistenceFactor < 0.3) {
    parts.push('short-lived signal');
  }

  const summary = parts.length > 0 ? parts.join(', ') : 'balanced factors';
  return `${band.charAt(0).toUpperCase() + band.slice(1)} confidence: ${summary}.`;
}
