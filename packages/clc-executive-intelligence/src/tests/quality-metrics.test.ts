/**
 * Tests for Recommendation Quality Metrics
 */
import { describe, it, expect } from 'vitest';
import { computeRecommendationQualityMetrics, buildQualitySummary } from '../quality/metrics';
import type { DecisionOutcome, RecommendationAccuracy } from '../contracts/index';

function makeOutcome(overrides: Partial<DecisionOutcome> = {}): DecisionOutcome {
  return {
    priorityId: 'P1',
    recommendedAction: 'escalate',
    actionTaken: 'escalated',
    outcome: 'success',
    successScore: 0.8,
    createdAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

function makeOutcomes(count: number, overrides: Partial<DecisionOutcome> = {}): DecisionOutcome[] {
  return Array.from({ length: count }, (_, i) => makeOutcome({
    priorityId: `P${i}`,
    createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    ...overrides,
  }));
}

describe('computeRecommendationQualityMetrics', () => {
  it('computes metrics for sufficient sample', () => {
    const outcomes = makeOutcomes(15);
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    expect(metrics.totalOutcomes).toBe(15);
    expect(metrics.isSufficientSample).toBe(true);
    expect(metrics.accuracy.successRate).toBe(1.0);
    expect(metrics.qualityTrend).toBe('stable');
  });

  it('flags insufficient sample below minimum', () => {
    const outcomes = makeOutcomes(5);
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    expect(metrics.isSufficientSample).toBe(false);
    expect(metrics.performanceFlags).toHaveLength(0); // Suppressed
  });

  it('groups by action type', () => {
    const outcomes = [
      ...makeOutcomes(5, { recommendedAction: 'escalate' }),
      ...makeOutcomes(5, { recommendedAction: 'monitor' }),
    ];
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    expect(Object.keys(metrics.byActionType)).toContain('escalate');
    expect(Object.keys(metrics.byActionType)).toContain('monitor');
  });

  it('groups by signal type', () => {
    const outcomes = [
      ...makeOutcomes(5, { signalId: 'pattern:cross_affiliate' }),
      ...makeOutcomes(5, { signalId: 'pattern:bargaining' }),
    ];
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    expect(Object.keys(metrics.bySignalType)).toContain('pattern:cross_affiliate');
    expect(Object.keys(metrics.bySignalType)).toContain('pattern:bargaining');
  });

  it('detects improving trend', () => {
    const outcomes = makeOutcomes(12);
    const previousAccuracy: RecommendationAccuracy = {
      totalOutcomes: 10,
      successRate: 0.5,
      partialRate: 0.3,
      failureRate: 0.2,
      averageSuccessScore: 0.5,
      nilVsDeterministic: null,
    };
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z', previousAccuracy,
    );
    expect(metrics.qualityTrend).toBe('improving');
  });

  it('detects declining trend', () => {
    const outcomes = makeOutcomes(12, { outcome: 'failure', successScore: 0.2 });
    const previousAccuracy: RecommendationAccuracy = {
      totalOutcomes: 10,
      successRate: 0.8,
      partialRate: 0.1,
      failureRate: 0.1,
      averageSuccessScore: 0.8,
      nilVsDeterministic: null,
    };
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z', previousAccuracy,
    );
    expect(metrics.qualityTrend).toBe('declining');
  });

  it('includes window boundaries', () => {
    const metrics = computeRecommendationQualityMetrics(
      makeOutcomes(10), '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    expect(metrics.windowStart).toBe('2026-01-01T00:00:00Z');
    expect(metrics.windowEnd).toBe('2026-01-31T00:00:00Z');
  });

  it('includes org scope', () => {
    const metrics = computeRecommendationQualityMetrics(
      makeOutcomes(10), '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
      undefined, 'org-X',
    );
    expect(metrics.organizationId).toBe('org-X');
  });
});

describe('buildQualitySummary', () => {
  it('builds summary with top performers and underperformers', () => {
    const outcomes = [
      ...makeOutcomes(5, { recommendedAction: 'escalate', outcome: 'success', successScore: 0.9 }),
      ...makeOutcomes(5, { recommendedAction: 'monitor', outcome: 'failure', successScore: 0.1 }),
    ];
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    const summary = buildQualitySummary(metrics);
    expect(summary.topPerformers.length).toBeGreaterThanOrEqual(1);
    expect(summary.underperformers.length).toBeGreaterThanOrEqual(1);
 });

  it('includes reliability note for sufficient sample', () => {
    const outcomes = makeOutcomes(15);
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    const summary = buildQualitySummary(metrics);
    expect(summary.historicalReliabilityNote).toContain('track record');
    expect(summary.isSufficientSample).toBe(true);
  });

  it('defers reliability for insufficient sample', () => {
    const outcomes = makeOutcomes(5);
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    const summary = buildQualitySummary(metrics);
    expect(summary.historicalReliabilityNote).toContain('Insufficient');
    expect(summary.isSufficientSample).toBe(false);
  });

  it('includes pending proposals count', () => {
    const outcomes = makeOutcomes(10);
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    const summary = buildQualitySummary(metrics, 3);
    expect(summary.pendingProposals).toBe(3);
  });

  it('includes confidence adjustment explanation', () => {
    const outcomes = makeOutcomes(10);
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    const summary = buildQualitySummary(metrics, 0, 'Confidence boosted by 5%.');
    expect(summary.confidenceAdjustmentExplanation).toBe('Confidence boosted by 5%.');
  });

  it('caps feedback coverage at 100%', () => {
    const outcomes = makeOutcomes(20);
    const metrics = computeRecommendationQualityMetrics(
      outcomes, '2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z',
    );
    const summary = buildQualitySummary(metrics);
    expect(summary.feedbackCoverage).toBeLessThanOrEqual(1.0);
  });
});
