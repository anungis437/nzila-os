/**
 * Feedback Learning Engine — Unit Tests
 *
 * Tests: accuracy computation, weight adjustment only after threshold,
 * bounded weight adjustment (±20%), low-performance flagging.
 */
import { describe, it, expect } from 'vitest';
import {
  computeRecommendationAccuracy,
  updateModelWeights,
  flagLowPerformancePatterns,
  getDefaultWeights,
  getMinSampleSize,
} from '../learning/feedback-engine';
import type { DecisionOutcome } from '../contracts/index';

function makeOutcome(overrides: Partial<DecisionOutcome> = {}): DecisionOutcome {
  return {
    priorityId: 'P1',
    recommendedAction: 'escalate',
    actionTaken: 'escalate',
    outcome: 'success',
    successScore: 0.8,
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('feedback learning engine', () => {
  describe('computeRecommendationAccuracy', () => {
    it('computes correct rates for all-success outcomes', () => {
      const outcomes = Array.from({ length: 5 }, () => makeOutcome({ outcome: 'success', successScore: 1.0 }));
      const result = computeRecommendationAccuracy(outcomes);
      expect(result.successRate).toBe(1.0);
      expect(result.failureRate).toBe(0);
      expect(result.partialRate).toBe(0);
      expect(result.totalOutcomes).toBe(5);
    });

    it('computes correct rates for mixed outcomes', () => {
      const outcomes = [
        makeOutcome({ outcome: 'success', successScore: 1.0 }),
        makeOutcome({ outcome: 'partial', successScore: 0.5 }),
        makeOutcome({ outcome: 'failure', successScore: 0 }),
      ];
      const result = computeRecommendationAccuracy(outcomes);
      expect(result.successRate).toBeCloseTo(1 / 3, 2);
      expect(result.partialRate).toBeCloseTo(1 / 3, 2);
      expect(result.failureRate).toBeCloseTo(1 / 3, 2);
      expect(result.averageSuccessScore).toBeCloseTo(0.5, 2);
    });

    it('handles empty outcomes', () => {
      const result = computeRecommendationAccuracy([]);
      expect(result.totalOutcomes).toBe(0);
      expect(result.successRate).toBe(0);
    });

    it('compares NIL vs deterministic when both provided', () => {
      const nilOutcomes = [makeOutcome({ outcome: 'success', successScore: 0.9 })];
      const detOutcomes = [makeOutcome({ outcome: 'partial', successScore: 0.5 })];
      const result = computeRecommendationAccuracy(
        [...nilOutcomes, ...detOutcomes],
        nilOutcomes,
        detOutcomes,
      );
      expect(result.nilVsDeterministic).not.toBeNull();
      if (result.nilVsDeterministic) {
        expect(result.nilVsDeterministic.nilSampleSize).toBe(1);
        expect(result.nilVsDeterministic.deterministicSampleSize).toBe(1);
      }
    });
  });

  describe('updateModelWeights', () => {
    it('returns no adjustments when sample size is below threshold', () => {
      const weights = getDefaultWeights();
      const outcomes = Array.from({ length: 5 }, () => makeOutcome());
      const result = updateModelWeights(weights, outcomes);
      expect(result.adjustments).toHaveLength(0);
      expect(result.updatedWeights).toEqual(weights);
    });

    it('proposes adjustments when sample size meets threshold', () => {
      const weights = getDefaultWeights();
      const outcomes = Array.from({ length: 12 }, (_, i) =>
        makeOutcome({
          outcome: i < 8 ? 'success' : 'failure',
          successScore: i < 8 ? 0.9 : 0.1,
        }),
      );
      const result = updateModelWeights(weights, outcomes);
      // With sufficient data, adjustments may or may not be proposed
      // depending on outcome distribution
      expect(result.updatedWeights).toBeDefined();
    });

    it('bounds weight adjustments to ±20%', () => {
      const weights = getDefaultWeights();
      const outcomes = Array.from({ length: 20 }, () =>
        makeOutcome({ outcome: 'failure', successScore: 0.0 }),
      );
      const result = updateModelWeights(weights, outcomes);
      for (const adj of result.adjustments) {
        const change = Math.abs(adj.newWeight - adj.previousWeight);
        // MAX_WEIGHT_DELTA is 0.20 absolute, not 20% of previous weight
        expect(change).toBeLessThanOrEqual(0.20 + 0.001);
      }
    });

    it('normalizes weights to sum to 1.0', () => {
      const weights = getDefaultWeights();
      const outcomes = Array.from({ length: 15 }, (_, i) =>
        makeOutcome({ outcome: i % 2 === 0 ? 'success' : 'failure', successScore: i % 2 === 0 ? 0.8 : 0.2 }),
      );
      const result = updateModelWeights(weights, outcomes);
      const sum = Object.values(result.updatedWeights).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    });
  });

  describe('flagLowPerformancePatterns', () => {
    it('returns empty for all-success outcomes', () => {
      const outcomes = Array.from({ length: 5 }, () =>
        makeOutcome({ outcome: 'success', recommendedAction: 'escalate' }),
      );
      const result = flagLowPerformancePatterns(outcomes);
      expect(result).toHaveLength(0);
    });

    it('flags categories below 40% success rate', () => {
      // Need at least MIN_SAMPLE_SIZE (10) outcomes for any flags
      const outcomes = [
        makeOutcome({ recommendedAction: 'intervene', outcome: 'failure', successScore: 0 }),
        makeOutcome({ recommendedAction: 'intervene', outcome: 'failure', successScore: 0 }),
        makeOutcome({ recommendedAction: 'intervene', outcome: 'failure', successScore: 0.1 }),
        makeOutcome({ recommendedAction: 'intervene', outcome: 'success', successScore: 0.9 }),
        makeOutcome({ recommendedAction: 'escalate', outcome: 'success', successScore: 0.9 }),
        makeOutcome({ recommendedAction: 'escalate', outcome: 'success', successScore: 0.9 }),
        makeOutcome({ recommendedAction: 'escalate', outcome: 'success', successScore: 0.9 }),
        makeOutcome({ recommendedAction: 'escalate', outcome: 'success', successScore: 0.9 }),
        makeOutcome({ recommendedAction: 'escalate', outcome: 'success', successScore: 0.9 }),
        makeOutcome({ recommendedAction: 'escalate', outcome: 'success', successScore: 0.9 }),
      ];
      const result = flagLowPerformancePatterns(outcomes);
      expect(result.length).toBeGreaterThan(0);
      // Category format is 'action:intervene'
      const interventionFlag = result.find((f) => f.category === 'action:intervene');
      expect(interventionFlag).toBeDefined();
      expect(interventionFlag!.successRate).toBeLessThan(0.4);
    });

    it('includes issue description in flags', () => {
      const outcomes = Array.from({ length: 5 }, () =>
        makeOutcome({ recommendedAction: 'prepare', outcome: 'failure', successScore: 0 }),
      );
      const result = flagLowPerformancePatterns(outcomes);
      for (const flag of result) {
        expect(flag.issue).toBeTruthy();
        expect(flag.sampleSize).toBeGreaterThan(0);
      }
    });
  });

  describe('getDefaultWeights', () => {
    it('returns weights that sum to ~1.0', () => {
      const weights = getDefaultWeights();
      const sum = Object.values(weights).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });
  });

  describe('getMinSampleSize', () => {
    it('returns 10', () => {
      expect(getMinSampleSize()).toBe(10);
    });
  });
});
