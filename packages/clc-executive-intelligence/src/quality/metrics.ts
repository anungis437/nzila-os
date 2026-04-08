/**
 * CLC Executive Intelligence — Recommendation Quality Metrics
 *
 * Aggregates decision outcomes into quality metrics for executive visibility.
 * Supports org-scoped, time-windowed, action-type and signal-type grouping.
 *
 * Design:
 * - Low-sample suppression: returns insufficient-sample flag below threshold
 * - Trend computation from sequential windows
 * - Groups by action type and signal type for drill-down
 *
 * @module quality/metrics
 */

import type {
  DecisionOutcome,
  RecommendationAccuracy,
  RecommendationQualityMetrics,
  LowPerformanceFlag,
} from '../contracts/index';
import { computeRecommendationAccuracy, flagLowPerformancePatterns, getMinSampleSize } from '../learning/feedback-engine';

// ── Quality Metrics ─────────────────────────────────────────────────────────

/**
 * Compute recommendation quality metrics for a set of outcomes.
 *
 * @param outcomes - Outcome data (already filtered to the desired window/org)
 * @param windowStart - ISO timestamp for window start
 * @param windowEnd - ISO timestamp for window end
 * @param previousAccuracy - Previous window accuracy for trend computation
 * @param organizationId - Optional org scope
 */
export function computeRecommendationQualityMetrics(
  outcomes: DecisionOutcome[],
  windowStart: string,
  windowEnd: string,
  previousAccuracy?: RecommendationAccuracy,
  organizationId?: string,
): RecommendationQualityMetrics {
  const minSample = getMinSampleSize();
  const isSufficientSample = outcomes.length >= minSample;

  // Overall accuracy
  const accuracy = computeRecommendationAccuracy(outcomes);

  // Group by action type
  const byActionType = groupAccuracyByField(outcomes, (o) => o.recommendedAction);

  // Group by signal type (signalId prefix or 'unknown')
  const bySignalType = groupAccuracyByField(outcomes, (o) => o.signalId ?? 'unknown');

  // Performance flags
  const performanceFlags = isSufficientSample
    ? flagLowPerformancePatterns(outcomes)
    : [];

  // Trend computation
  const qualityTrend = computeQualityTrend(accuracy, previousAccuracy);

  return {
    windowStart,
    windowEnd,
    organizationId,
    totalOutcomes: outcomes.length,
    accuracy,
    byActionType,
    bySignalType,
    performanceFlags,
    qualityTrend,
    isSufficientSample,
  };
}

// ── Grouped Accuracy ────────────────────────────────────────────────────────

/**
 * Group outcomes by a field extractor and compute accuracy for each group.
 */
function groupAccuracyByField(
  outcomes: DecisionOutcome[],
  fieldExtractor: (o: DecisionOutcome) => string,
): Record<string, RecommendationAccuracy> {
  const groups: Record<string, DecisionOutcome[]> = {};

  for (const outcome of outcomes) {
    const key = fieldExtractor(outcome);
    const group = groups[key];
    if (group) {
      group.push(outcome);
    } else {
      groups[key] = [outcome];
    }
  }

  const result: Record<string, RecommendationAccuracy> = {};
  for (const [key, groupOutcomes] of Object.entries(groups)) {
    if (groupOutcomes) {
      result[key] = computeRecommendationAccuracy(groupOutcomes);
    }
  }

  return result;
}

// ── Trend Computation ───────────────────────────────────────────────────────

/** Threshold for classifying trend direction */
const TREND_THRESHOLD = 0.05;

/**
 * Compute the quality trend by comparing current vs previous accuracy.
 */
function computeQualityTrend(
  current: RecommendationAccuracy,
  previous?: RecommendationAccuracy,
): 'improving' | 'stable' | 'declining' {
  if (!previous || previous.totalOutcomes === 0) return 'stable';

  const delta = current.successRate - previous.successRate;

  if (delta > TREND_THRESHOLD) return 'improving';
  if (delta < -TREND_THRESHOLD) return 'declining';
  return 'stable';
}

// ── Quality Summary for Brief ───────────────────────────────────────────────

/**
 * Build a recommendation quality summary suitable for the executive brief.
 */
export function buildQualitySummary(
  metrics: RecommendationQualityMetrics,
  pendingProposals: number = 0,
  confidenceAdjustmentExplanation?: string,
): import('../contracts/index').RecommendationQualitySummary {
  const topPerformers: Array<{ actionType: string; successRate: number }> = [];
  const underperformers: Array<{ actionType: string; successRate: number; issue: string }> = [];

  for (const [actionType, accuracy] of Object.entries(metrics.byActionType)) {
    if (!accuracy) continue;
    if (accuracy.totalOutcomes < 3) continue; // Skip tiny groups

    if (accuracy.successRate >= 0.7) {
      topPerformers.push({ actionType, successRate: accuracy.successRate });
    }
    if (accuracy.successRate < 0.4) {
      underperformers.push({
        actionType,
        successRate: accuracy.successRate,
        issue: `${(accuracy.successRate * 100).toFixed(0)}% success rate across ${accuracy.totalOutcomes} outcomes`,
      });
    }
  }

  // Sort: top performers descending, underperformers ascending
  topPerformers.sort((a, b) => b.successRate - a.successRate);
  underperformers.sort((a, b) => a.successRate - b.successRate);

  // Build reliability note
  const reliabilityNote = buildReliabilityNote(metrics);

  // Compute feedback coverage (outcomes vs a rough estimate)
  // Since we don't have total recommendations count, use 1.0 if sample is sufficient
  const feedbackCoverage = metrics.isSufficientSample ? 1.0 : metrics.totalOutcomes / getMinSampleSize();

  return {
    overallSuccessRate: metrics.accuracy.successRate,
    totalOutcomes: metrics.totalOutcomes,
    isSufficientSample: metrics.isSufficientSample,
    topPerformers,
    underperformers,
    qualityTrend: metrics.qualityTrend,
    historicalReliabilityNote: reliabilityNote,
    feedbackCoverage: Math.min(1.0, Math.round(feedbackCoverage * 100) / 100),
    pendingProposals,
    confidenceAdjustmentExplanation,
  };
}

/**
 * Build a human-readable reliability note from metrics.
 */
function buildReliabilityNote(metrics: RecommendationQualityMetrics): string {
  if (!metrics.isSufficientSample) {
    return `Insufficient data (${metrics.totalOutcomes} outcomes, need ${getMinSampleSize()}) — reliability assessment deferred.`;
  }

  const rate = metrics.accuracy.successRate;
  if (rate >= 0.8) {
    return `Strong track record: ${(rate * 100).toFixed(0)}% success rate across ${metrics.totalOutcomes} evaluated outcomes.`;
  }
  if (rate >= 0.6) {
    return `Moderate reliability: ${(rate * 100).toFixed(0)}% success rate. Some recommendation categories may need attention.`;
  }
  return `Below-target reliability: ${(rate * 100).toFixed(0)}% success rate across ${metrics.totalOutcomes} outcomes. Review weight adjustment proposals.`;
}
