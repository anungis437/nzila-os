/**
 * CLC Executive Intelligence — Confidence Evolution
 *
 * Enhances the confidence model with historical accuracy modifiers
 * and outcome-based adjustments. The evolved confidence accounts for
 * how well past recommendations in similar categories performed.
 *
 * Formula: evolvedConfidence = clamp(baseConfidence * historicalModifier, 0, 1)
 *
 * @module confidence/evolution
 */

import type {
  EvolvedConfidence,
  DecisionOutcome,
  ConfidenceBreakdown,
  RecommendationQualityMetrics,
} from '../contracts/index';
import type { ConfidenceBand } from '@nzila/clc-decision-intelligence';

// ── Historical Performance → Modifier ───────────────────────────────────────

/**
 * Compute a historical performance modifier from outcome data.
 *
 * Range: 0.5 - 1.5
 * - 1.0 = no historical data or baseline performance
 * - > 1.0 = historically good performance (boosts confidence)
 * - < 1.0 = historically poor performance (reduces confidence)
 */
export function computeHistoricalModifier(
  outcomes: DecisionOutcome[],
  category?: string,
): number {
  if (outcomes.length === 0) return 1.0;

  // Filter by category if provided
  const relevant = category
    ? outcomes.filter((o) => o.recommendedAction === category)
    : outcomes;

  if (relevant.length === 0) return 1.0;

  const avgScore = relevant.reduce((s, o) => s + o.successScore, 0) / relevant.length;

  // Map average success score (0-1) to modifier (0.5-1.5)
  // 0.0 success → 0.5x modifier
  // 0.5 success → 1.0x modifier (baseline)
  // 1.0 success → 1.5x modifier
  return Math.max(0.5, Math.min(1.5, 0.5 + avgScore));
}

/**
 * Compute a modifier directly from a pre-computed performance score.
 *
 * @param performanceScore - A pre-computed score (0-1), e.g. from external metrics
 */
export function computeModifierFromScore(performanceScore: number): number {
  const clamped = Math.max(0, Math.min(1, performanceScore));
  return Math.max(0.5, Math.min(1.5, 0.5 + clamped));
}

// ── Confidence Evolution ────────────────────────────────────────────────────

/**
 * Evolve a base confidence score using historical performance data.
 *
 * The evolved confidence incorporates how well similar recommendations
 * have performed historically, providing a self-correcting feedback loop.
 */
export function evolveConfidence(
  baseConfidence: number,
  historicalPerformanceScore?: number,
  outcomes?: DecisionOutcome[],
  category?: string,
): EvolvedConfidence {
  let historicalModifier = 1.0;
  let source = 'no historical data';

  if (historicalPerformanceScore !== undefined) {
    historicalModifier = computeModifierFromScore(historicalPerformanceScore);
    source = `performance score: ${(historicalPerformanceScore * 100).toFixed(0)}%`;
  } else if (outcomes && outcomes.length > 0) {
    historicalModifier = computeHistoricalModifier(outcomes, category);
    source = `${outcomes.length} historical outcomes`;
  }

  const evolvedConfidence = Math.max(0, Math.min(1,
    baseConfidence * historicalModifier,
  ));

  const direction = historicalModifier > 1.0
    ? 'boosted'
    : historicalModifier < 1.0
      ? 'reduced'
      : 'unchanged';

  return {
    baseConfidence: Math.round(baseConfidence * 100) / 100,
    historicalModifier: Math.round(historicalModifier * 100) / 100,
    evolvedConfidence: Math.round(evolvedConfidence * 100) / 100,
    explanation: `Confidence ${direction} from ${(baseConfidence * 100).toFixed(0)}% to ` +
      `${(evolvedConfidence * 100).toFixed(0)}% (modifier: ${historicalModifier.toFixed(2)}x, ` +
      `based on ${source}).`,
  };
}

// ── NIL vs Deterministic Variance ───────────────────────────────────────────

/**
 * Compute the variance between NIL and deterministic confidence values.
 * Used to track whether NIL is improving or degrading confidence quality.
 */
export function computeNilDeterministicVariance(
  nilConfidence: number,
  deterministicConfidence: number,
): { variance: number; direction: 'nil_higher' | 'deterministic_higher' | 'aligned' } {
  const variance = Math.abs(nilConfidence - deterministicConfidence);

  let direction: 'nil_higher' | 'deterministic_higher' | 'aligned';
  if (variance < 0.05) {
    direction = 'aligned';
  } else if (nilConfidence > deterministicConfidence) {
    direction = 'nil_higher';
  } else {
    direction = 'deterministic_higher';
  }

  return {
    variance: Math.round(variance * 100) / 100,
    direction,
  };
}

// ── Confidence Breakdown for UI ─────────────────────────────────────────────

/**
 * Build a confidence breakdown suitable for tooltip display.
 */
export function buildConfidenceBreakdown(
  confidence: number,
  factors: Record<string, number>,
  descriptions?: Record<string, string>,
): ConfidenceBreakdown {
  const band: ConfidenceBand = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';

  const defaultDescriptions: Record<string, string> = {
    cohort: 'Number of contributing organizations',
    recency: 'How recent the underlying data is',
    agreement: 'Agreement across independent signals',
    sources: 'Number of independent data sources',
    persistence: 'Signal duration and consistency',
    historical: 'Historical accuracy of similar recommendations',
  };

  return {
    confidence: Math.round(confidence * 100) / 100,
    band,
    factors: Object.entries(factors).map(([name, contribution]) => ({
      name,
      contribution: Math.round(contribution * 100) / 100,
      description: descriptions?.[name] ?? defaultDescriptions[name] ?? name,
    })),
  };
}

// ── Confidence Adjustment Explanation ────────────────────────────────────────

/** Maximum bounded modifier for quality-based adjustment */
const MAX_QUALITY_MODIFIER = 0.15;

/**
 * Build a confidence adjustment explanation based on recommendation quality metrics.
 *
 * This integrates historical recommendation quality into the confidence explanation,
 * providing leadership with transparency about how past performance affects current
 * confidence levels.
 */
export function buildConfidenceAdjustmentExplanation(
  qualityMetrics: RecommendationQualityMetrics,
  baseConfidence: number,
): string {
  if (!qualityMetrics.isSufficientSample) {
    return `Confidence at ${(baseConfidence * 100).toFixed(0)}% — insufficient historical data ` +
      `(${qualityMetrics.totalOutcomes} outcomes, need ${10}) for quality-based adjustment.`;
  }

  const modifier = computeModifierFromScore(qualityMetrics.accuracy.averageSuccessScore);
  const direction = modifier > 1.0 ? 'boosted' : modifier < 1.0 ? 'reduced' : 'unchanged';
  const modifierPercent = ((modifier - 1.0) * 100).toFixed(1);

  const parts: string[] = [];
  parts.push(
    `Confidence ${direction} by ${Math.abs(Number(modifierPercent))}% based on ` +
    `${(qualityMetrics.accuracy.successRate * 100).toFixed(0)}% recommendation success rate ` +
    `across ${qualityMetrics.totalOutcomes} outcomes.`,
  );

  if (qualityMetrics.qualityTrend !== 'stable') {
    parts.push(`Quality trend: ${qualityMetrics.qualityTrend}.`);
  }

  if (qualityMetrics.performanceFlags.length > 0) {
    parts.push(
      `${qualityMetrics.performanceFlags.length} underperforming area(s) flagged for review.`,
    );
  }

  return parts.join(' ');
}

/**
 * Compute a bounded reliability modifier from quality metrics.
 * Returns a modifier in the range [1 - MAX_QUALITY_MODIFIER, 1 + MAX_QUALITY_MODIFIER].
 */
export function computeReliabilityModifier(
  qualityMetrics: RecommendationQualityMetrics,
): number {
  if (!qualityMetrics.isSufficientSample) return 1.0;

  // Map success rate to bounded modifier
  // 0.0 success → 1 - MAX_QUALITY_MODIFIER (0.85)
  // 0.5 success → 1.0
  // 1.0 success → 1 + MAX_QUALITY_MODIFIER (1.15)
  const rate = qualityMetrics.accuracy.successRate;
  const unbounded = 1.0 + (rate - 0.5) * (MAX_QUALITY_MODIFIER * 2);
  return Math.max(1.0 - MAX_QUALITY_MODIFIER, Math.min(1.0 + MAX_QUALITY_MODIFIER, unbounded));
}
