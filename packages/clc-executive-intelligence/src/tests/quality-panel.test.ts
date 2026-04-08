/**
 * Tests for Recommendation Quality Panel (UI)
 */
import { describe, it, expect } from 'vitest';
import {
  buildRecommendationQualityPanel,
} from '../ui/index';
import type { RecommendationQualitySummary } from '../contracts/index';

function makeSummary(overrides: Partial<RecommendationQualitySummary> = {}): RecommendationQualitySummary {
  return {
    overallSuccessRate: 0.75,
    totalOutcomes: 20,
    isSufficientSample: true,
    topPerformers: [],
    underperformers: [],
    qualityTrend: 'stable',
    historicalReliabilityNote: 'Strong reliability based on 20 outcomes.',
    feedbackCoverage: 0.6,
    pendingProposals: 0,
    ...overrides,
  };
}

describe('buildRecommendationQualityPanel', () => {
  it('returns null for null input', () => {
    expect(buildRecommendationQualityPanel(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(buildRecommendationQualityPanel(undefined)).toBeNull();
  });

  it('builds panel with correct success rate percentage', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ overallSuccessRate: 0.82 }));
    expect(panel!.successRatePercent).toBe(82);
  });

  it('classifies high success rate as success severity', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ overallSuccessRate: 0.85 }));
    expect(panel!.severity).toBe('success');
  });

  it('classifies moderate success rate as warning severity', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ overallSuccessRate: 0.55 }));
    expect(panel!.severity).toBe('warning');
  });

  it('classifies low success rate as danger severity', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ overallSuccessRate: 0.3 }));
    expect(panel!.severity).toBe('danger');
  });

  it('shows improving trend correctly', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ qualityTrend: 'improving' }));
    expect(panel!.trendLabel).toBe('Improving');
    expect(panel!.trendIcon).toBe('arrow-up');
  });

  it('shows declining trend correctly', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ qualityTrend: 'declining' }));
    expect(panel!.trendLabel).toBe('Declining');
    expect(panel!.trendIcon).toBe('arrow-down');
  });

  it('shows stable trend correctly', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ qualityTrend: 'stable' }));
    expect(panel!.trendLabel).toBe('Stable');
    expect(panel!.trendIcon).toBe('minus');
  });

  it('maps top performers into display format', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({
      topPerformers: [
        { actionType: 'escalate', successRate: 0.92 },
        { actionType: 'engage', successRate: 0.85 },
      ],
    }));
    expect(panel!.topPerformers).toHaveLength(2);
    expect(panel!.topPerformers[0]!.label).toBe('escalate');
    expect(panel!.topPerformers[0]!.percent).toBe(92);
  });

  it('maps underperformers into alerts', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({
      underperformers: [
        { actionType: 'negotiate', successRate: 0.25, issue: 'Below target' },
      ],
    }));
    expect(panel!.alerts).toHaveLength(1);
    expect(panel!.alerts[0]!.label).toBe('negotiate');
    expect(panel!.alerts[0]!.percent).toBe(25);
    expect(panel!.alerts[0]!.message).toBe('Below target');
  });

  it('exposes pending proposals count', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ pendingProposals: 3 }));
    expect(panel!.pendingProposals).toBe(3);
  });

  it('exposes sufficient data flag', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ isSufficientSample: false }));
    expect(panel!.hasSufficientData).toBe(false);
  });

  it('rounds coverage to nearest percent', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({ feedbackCoverage: 0.667 }));
    expect(panel!.coveragePercent).toBe(67);
  });

  it('includes confidence note when provided', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({
      confidenceAdjustmentExplanation: 'Confidence boosted by 5%',
    }));
    expect(panel!.confidenceNote).toBe('Confidence boosted by 5%');
  });

  it('omits confidence note when not provided', () => {
    const panel = buildRecommendationQualityPanel(makeSummary());
    expect(panel!.confidenceNote).toBeUndefined();
  });

  it('shows reliability note from summary', () => {
    const panel = buildRecommendationQualityPanel(makeSummary({
      historicalReliabilityNote: 'Moderate reliability',
    }));
    expect(panel!.reliabilityNote).toBe('Moderate reliability');
  });
});
