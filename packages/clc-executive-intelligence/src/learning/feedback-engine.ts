/**
 * CLC Executive Intelligence — Decision Feedback Loop
 *
 * Self-improvement engine that tracks decision outcomes and adjusts
 * scoring weights over time. Enables the system to learn from
 * historical performance.
 *
 * Constraints:
 * - NEVER auto-changes weights without minimum sample threshold
 * - Weight adjustments are bounded (±20% max per factor)
 * - Requires minimum 10 outcomes for any adjustment
 *
 * @module learning/feedback-engine
 */

import type {
  DecisionOutcome,
  WeightAdjustment,
  RecommendationAccuracy,
  LowPerformanceFlag,
} from '../contracts/index';

// ── Constants ───────────────────────────────────────────────────────────────

/** Minimum number of outcomes required before any weight adjustment */
const MIN_SAMPLE_SIZE = 10;

/** Maximum weight change per adjustment cycle (±20%) */
const MAX_WEIGHT_DELTA = 0.20;

/** Threshold below which a category is flagged as low-performance */
const LOW_PERFORMANCE_THRESHOLD = 0.4;

// ── Default Scoring Weights ─────────────────────────────────────────────────

export interface ScoringWeights {
  watchLevel: number;
  actionUrgency: number;
  timeframe: number;
  confidence: number;
  breadth: number;
  velocity: number;
  novelty: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  watchLevel: 0.20,
  actionUrgency: 0.15,
  timeframe: 0.10,
  confidence: 0.15,
  breadth: 0.15,
  velocity: 0.10,
  novelty: 0.15,
};

// ── Recommendation Accuracy ─────────────────────────────────────────────────

/**
 * Compute recommendation accuracy from historical outcomes.
 */
export function computeRecommendationAccuracy(
  outcomes: DecisionOutcome[],
  nilOutcomes?: DecisionOutcome[],
  deterministicOutcomes?: DecisionOutcome[],
): RecommendationAccuracy {
  if (outcomes.length === 0) {
    return {
      totalOutcomes: 0,
      successRate: 0,
      partialRate: 0,
      failureRate: 0,
      averageSuccessScore: 0,
      nilVsDeterministic: null,
    };
  }

  const successCount = outcomes.filter((o) => o.outcome === 'success').length;
  const partialCount = outcomes.filter((o) => o.outcome === 'partial').length;
  const failureCount = outcomes.filter((o) => o.outcome === 'failure').length;
  const total = outcomes.length;

  const avgScore = outcomes.reduce((s, o) => s + o.successScore, 0) / total;

  let nilVsDeterministic: RecommendationAccuracy['nilVsDeterministic'] = null;
  if (nilOutcomes && deterministicOutcomes &&
      nilOutcomes.length > 0 && deterministicOutcomes.length > 0) {
    const nilSuccess = nilOutcomes.filter((o) => o.outcome === 'success').length / nilOutcomes.length;
    const detSuccess = deterministicOutcomes.filter((o) => o.outcome === 'success').length / deterministicOutcomes.length;

    nilVsDeterministic = {
      nilSuccessRate: Math.round(nilSuccess * 100) / 100,
      deterministicSuccessRate: Math.round(detSuccess * 100) / 100,
      nilSampleSize: nilOutcomes.length,
      deterministicSampleSize: deterministicOutcomes.length,
    };
  }

  return {
    totalOutcomes: total,
    successRate: Math.round((successCount / total) * 100) / 100,
    partialRate: Math.round((partialCount / total) * 100) / 100,
    failureRate: Math.round((failureCount / total) * 100) / 100,
    averageSuccessScore: Math.round(avgScore * 100) / 100,
    nilVsDeterministic,
  };
}

// ── Weight Adjustment ───────────────────────────────────────────────────────

/**
 * Attempt to update model weights based on outcome data.
 *
 * Returns proposed adjustments. Does NOT automatically apply them.
 * Requires minimum sample size. Adjustments are bounded.
 */
export function updateModelWeights(
  currentWeights: ScoringWeights,
  outcomes: DecisionOutcome[],
): { adjustments: WeightAdjustment[]; updatedWeights: ScoringWeights } {
  const adjustments: WeightAdjustment[] = [];

  if (outcomes.length < MIN_SAMPLE_SIZE) {
    return { adjustments: [], updatedWeights: { ...currentWeights } };
  }

  const accuracy = computeRecommendationAccuracy(outcomes);
  const updatedWeights = { ...currentWeights };

  // If overall success rate is low, adjust weights
  if (accuracy.successRate < 0.5 && outcomes.length >= MIN_SAMPLE_SIZE) {
    // Increase confidence weight (trust higher-confidence signals more)
    const confidenceDelta = Math.min(MAX_WEIGHT_DELTA, (0.5 - accuracy.successRate) * 0.3);
    if (confidenceDelta > 0.01) {
      const newWeight = Math.min(0.35, currentWeights.confidence + confidenceDelta);
      adjustments.push({
        factor: 'confidence',
        previousWeight: currentWeights.confidence,
        newWeight: Math.round(newWeight * 100) / 100,
        sampleSize: outcomes.length,
        reason: `Success rate (${(accuracy.successRate * 100).toFixed(0)}%) below threshold — increasing confidence weight to prioritize higher-confidence signals.`,
      });
      updatedWeights.confidence = Math.round(newWeight * 100) / 100;
    }

    // Decrease novelty weight (new signals less reliable)
    const noveltyDelta = Math.min(MAX_WEIGHT_DELTA, (0.5 - accuracy.successRate) * 0.2);
    if (noveltyDelta > 0.01) {
      const newWeight = Math.max(0.05, currentWeights.novelty - noveltyDelta);
      adjustments.push({
        factor: 'novelty',
        previousWeight: currentWeights.novelty,
        newWeight: Math.round(newWeight * 100) / 100,
        sampleSize: outcomes.length,
        reason: `Reducing novelty weight — new signals contributing to lower accuracy.`,
      });
      updatedWeights.novelty = Math.round(newWeight * 100) / 100;
    }
  }

  // If success rate is high, slightly increase action urgency weight
  if (accuracy.successRate > 0.8 && outcomes.length >= MIN_SAMPLE_SIZE) {
    const delta = Math.min(MAX_WEIGHT_DELTA, (accuracy.successRate - 0.8) * 0.2);
    if (delta > 0.01) {
      const newWeight = Math.min(0.30, currentWeights.actionUrgency + delta);
      adjustments.push({
        factor: 'actionUrgency',
        previousWeight: currentWeights.actionUrgency,
        newWeight: Math.round(newWeight * 100) / 100,
        sampleSize: outcomes.length,
        reason: `High success rate (${(accuracy.successRate * 100).toFixed(0)}%) — action urgency scoring is well-calibrated, slight boost applied.`,
      });
      updatedWeights.actionUrgency = Math.round(newWeight * 100) / 100;
    }
  }

  // Normalize weights to sum to 1.0
  const totalWeight = Object.values(updatedWeights).reduce((s, v) => s + v, 0);
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    const keys = Object.keys(updatedWeights) as Array<keyof ScoringWeights>;
    for (const key of keys) {
      updatedWeights[key] = Math.round((updatedWeights[key] / totalWeight) * 100) / 100;
    }
  }

  return { adjustments, updatedWeights };
}

// ── Low Performance Pattern Detection ───────────────────────────────────────

/**
 * Flag categories or patterns with consistently low performance.
 */
export function flagLowPerformancePatterns(
  outcomes: DecisionOutcome[],
): LowPerformanceFlag[] {
  const flags: LowPerformanceFlag[] = [];

  if (outcomes.length < MIN_SAMPLE_SIZE) return flags;

  // Group by recommended action
  const byAction = groupBy(outcomes, (o) => o.recommendedAction);

  for (const [action, actionOutcomes] of Object.entries(byAction)) {
    if (actionOutcomes.length < 3) continue;

    const successRate = actionOutcomes.filter(
      (o) => o.outcome === 'success',
    ).length / actionOutcomes.length;

    if (successRate < LOW_PERFORMANCE_THRESHOLD) {
      flags.push({
        category: `action:${action}`,
        successRate: Math.round(successRate * 100) / 100,
        sampleSize: actionOutcomes.length,
        issue: `"${action}" recommendations have a ${(successRate * 100).toFixed(0)}% success rate ` +
          `across ${actionOutcomes.length} outcomes — below the ${(LOW_PERFORMANCE_THRESHOLD * 100).toFixed(0)}% threshold.`,
      });
    }
  }

  // Overall check by outcome result
  const overallFailureRate = outcomes.filter(
    (o) => o.outcome === 'failure',
  ).length / outcomes.length;

  if (overallFailureRate > 0.3) {
    flags.push({
      category: 'overall',
      successRate: 1 - overallFailureRate,
      sampleSize: outcomes.length,
      issue: `Overall failure rate is ${(overallFailureRate * 100).toFixed(0)}% — ` +
        `system recommendations may need recalibration.`,
    });
  }

  return flags;
}

/**
 * Get the default scoring weights.
 */
export function getDefaultWeights(): ScoringWeights {
  return { ...DEFAULT_WEIGHTS };
}

/**
 * Get the minimum sample size for weight adjustments.
 */
export function getMinSampleSize(): number {
  return MIN_SAMPLE_SIZE;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}
