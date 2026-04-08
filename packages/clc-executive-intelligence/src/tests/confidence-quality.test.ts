/**
 * Tests for Confidence Evolution — Quality-based Extensions
 */
import { describe, it, expect } from 'vitest';
import {
  buildConfidenceAdjustmentExplanation,
  computeReliabilityModifier,
} from '../confidence/evolution';
import type { RecommendationQualityMetrics } from '../contracts/index';

function makeAccuracy(overrides: Partial<{ totalOutcomes: number; successRate: number; partialRate: number; failureRate: number; averageSuccessScore: number }> = {}) {
  return {
    totalOutcomes: overrides.totalOutcomes ?? 20,
    successRate: overrides.successRate ?? 0.8,
    partialRate: overrides.partialRate ?? 0,
    failureRate: overrides.failureRate ?? 0.2,
    averageSuccessScore: overrides.averageSuccessScore ?? 0.75,
    nilVsDeterministic: null,
  };
}

function makeMetrics(overrides: Partial<RecommendationQualityMetrics> = {}): RecommendationQualityMetrics {
  return {
    windowStart: '2026-01-01T00:00:00Z',
    windowEnd: '2026-03-01T00:00:00Z',
    totalOutcomes: 20,
    accuracy: makeAccuracy(),
    byActionType: {},
    bySignalType: {},
    performanceFlags: [],
    qualityTrend: 'stable',
    isSufficientSample: true,
    ...overrides,
  };
}

describe('buildConfidenceAdjustmentExplanation', () => {
  it('returns insufficient-data explanation when sample is too small', () => {
    const metrics = makeMetrics({ isSufficientSample: false, totalOutcomes: 3 });
    const result = buildConfidenceAdjustmentExplanation(metrics, 0.7);
    expect(result).toContain('insufficient');
    expect(result).toContain('3 outcomes');
    expect(result).toContain('70%');
  });

  it('explains boost for high success rate', () => {
    const metrics = makeMetrics({
      accuracy: makeAccuracy({ successRate: 0.9, failureRate: 0.1, averageSuccessScore: 0.85 }),
    });
    const result = buildConfidenceAdjustmentExplanation(metrics, 0.6);
    expect(result).toContain('boosted');
    expect(result).toContain('90%');
    expect(result).toContain('20 outcomes');
  });

  it('explains reduction for low success rate', () => {
    const metrics = makeMetrics({
      accuracy: makeAccuracy({ successRate: 0.3, failureRate: 0.7, averageSuccessScore: 0.25 }),
    });
    const result = buildConfidenceAdjustmentExplanation(metrics, 0.6);
    expect(result).toContain('reduced');
    expect(result).toContain('30%');
  });

  it('includes quality trend in explanation when non-stable', () => {
    const metrics = makeMetrics({ qualityTrend: 'declining', performanceFlags: [] });
    const result = buildConfidenceAdjustmentExplanation(metrics, 0.6);
    expect(result).toContain('declining');
  });

  it('includes performance flag count in explanation', () => {
    const metrics = makeMetrics({
      performanceFlags: [
        { category: 'escalate', successRate: 0.3, issue: 'low', sampleSize: 12 },
        { category: 'negotiate', successRate: 0.2, issue: 'low', sampleSize: 10 },
      ],
    });
    const result = buildConfidenceAdjustmentExplanation(metrics, 0.6);
    expect(result).toContain('2 underperforming');
  });
});

describe('computeReliabilityModifier', () => {
  it('returns 1.0 for insufficient sample', () => {
    const metrics = makeMetrics({ isSufficientSample: false });
    expect(computeReliabilityModifier(metrics)).toBe(1.0);
  });

  it('returns > 1.0 for high success rate', () => {
    const metrics = makeMetrics({
      accuracy: makeAccuracy({ successRate: 1.0, failureRate: 0.0, averageSuccessScore: 0.95 }),
    });
    const modifier = computeReliabilityModifier(metrics);
    expect(modifier).toBeGreaterThan(1.0);
    expect(modifier).toBeLessThanOrEqual(1.15);
  });

  it('returns < 1.0 for low success rate', () => {
    const metrics = makeMetrics({
      accuracy: makeAccuracy({ successRate: 0.1, failureRate: 0.9, averageSuccessScore: 0.1 }),
    });
    const modifier = computeReliabilityModifier(metrics);
    expect(modifier).toBeLessThan(1.0);
    expect(modifier).toBeGreaterThanOrEqual(0.85);
  });

  it('returns exactly 1.0 for 50% success rate', () => {
    const metrics = makeMetrics({
      accuracy: makeAccuracy({ successRate: 0.5, failureRate: 0.5, averageSuccessScore: 0.5 }),
    });
    expect(computeReliabilityModifier(metrics)).toBe(1.0);
  });

  it('stays within ±15% bounds', () => {
    const high = makeMetrics({
      accuracy: makeAccuracy({ totalOutcomes: 50, successRate: 1.0, failureRate: 0.0, averageSuccessScore: 1.0 }),
    });
    const low = makeMetrics({
      accuracy: makeAccuracy({ totalOutcomes: 50, successRate: 0.0, failureRate: 1.0, averageSuccessScore: 0.0 }),
    });
    expect(computeReliabilityModifier(high)).toBeLessThanOrEqual(1.15);
    expect(computeReliabilityModifier(low)).toBeGreaterThanOrEqual(0.85);
  });
});
