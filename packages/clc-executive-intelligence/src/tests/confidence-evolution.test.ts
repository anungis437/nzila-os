/**
 * Confidence Evolution — Unit Tests
 *
 * Tests: historical modifier ranges, evolved confidence clamping,
 * NIL vs deterministic variance, confidence breakdown.
 */
import { describe, it, expect } from 'vitest';
import {
  computeHistoricalModifier,
  computeModifierFromScore,
  evolveConfidence,
  computeNilDeterministicVariance,
  buildConfidenceBreakdown,
} from '../confidence/evolution';
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

describe('confidence evolution', () => {
  describe('computeHistoricalModifier', () => {
    it('returns 1.0 for empty outcomes', () => {
      expect(computeHistoricalModifier([])).toBe(1.0);
    });

    it('returns 1.0 when no matching category', () => {
      const outcomes = [makeOutcome({ recommendedAction: 'escalate' })];
      expect(computeHistoricalModifier(outcomes, 'monitor')).toBe(1.0);
    });

    it('returns > 1.0 for high success scores', () => {
      const outcomes = [
        makeOutcome({ successScore: 0.9 }),
        makeOutcome({ successScore: 0.95 }),
      ];
      const modifier = computeHistoricalModifier(outcomes);
      expect(modifier).toBeGreaterThan(1.0);
      expect(modifier).toBeLessThanOrEqual(1.5);
    });

    it('returns < 1.0 for low success scores', () => {
      const outcomes = [
        makeOutcome({ successScore: 0.1 }),
        makeOutcome({ successScore: 0.2 }),
      ];
      const modifier = computeHistoricalModifier(outcomes);
      expect(modifier).toBeLessThan(1.0);
      expect(modifier).toBeGreaterThanOrEqual(0.5);
    });

    it('modifier is bounded [0.5, 1.5]', () => {
      const perfect = [makeOutcome({ successScore: 1.0 })];
      expect(computeHistoricalModifier(perfect)).toBe(1.5);

      const terrible = [makeOutcome({ successScore: 0.0 })];
      expect(computeHistoricalModifier(terrible)).toBe(0.5);
    });

    it('filters by category when provided', () => {
      const outcomes = [
        makeOutcome({ recommendedAction: 'escalate', successScore: 0.9 }),
        makeOutcome({ recommendedAction: 'monitor', successScore: 0.1 }),
      ];
      const escalateModifier = computeHistoricalModifier(outcomes, 'escalate');
      const monitorModifier = computeHistoricalModifier(outcomes, 'monitor');
      expect(escalateModifier).toBeGreaterThan(monitorModifier);
    });
  });

  describe('computeModifierFromScore', () => {
    it('maps 0.5 to 1.0', () => {
      expect(computeModifierFromScore(0.5)).toBe(1.0);
    });

    it('maps 1.0 to 1.5', () => {
      expect(computeModifierFromScore(1.0)).toBe(1.5);
    });

    it('maps 0.0 to 0.5', () => {
      expect(computeModifierFromScore(0.0)).toBe(0.5);
    });

    it('clamps out-of-range inputs', () => {
      expect(computeModifierFromScore(-1)).toBe(0.5);
      expect(computeModifierFromScore(2)).toBe(1.5);
    });
  });

  describe('evolveConfidence', () => {
    it('returns identity when no historical data', () => {
      const result = evolveConfidence(0.7);
      expect(result.evolvedConfidence).toBe(0.7);
      expect(result.historicalModifier).toBe(1.0);
      expect(result.explanation).toContain('unchanged');
    });

    it('boosts confidence with high performance score', () => {
      const result = evolveConfidence(0.6, 0.9);
      expect(result.evolvedConfidence).toBeGreaterThan(0.6);
      expect(result.historicalModifier).toBeGreaterThan(1.0);
      expect(result.explanation).toContain('boosted');
    });

    it('reduces confidence with low performance score', () => {
      const result = evolveConfidence(0.8, 0.2);
      expect(result.evolvedConfidence).toBeLessThan(0.8);
      expect(result.historicalModifier).toBeLessThan(1.0);
      expect(result.explanation).toContain('reduced');
    });

    it('clamps evolved confidence to [0, 1]', () => {
      const result = evolveConfidence(0.9, 1.0);
      expect(result.evolvedConfidence).toBeLessThanOrEqual(1);

      const result2 = evolveConfidence(0.1, 0.0);
      expect(result2.evolvedConfidence).toBeGreaterThanOrEqual(0);
    });

    it('uses outcome-based modifier when no performance score', () => {
      const outcomes = [
        makeOutcome({ successScore: 0.9 }),
        makeOutcome({ successScore: 0.85 }),
      ];
      const result = evolveConfidence(0.7, undefined, outcomes);
      expect(result.evolvedConfidence).toBeGreaterThan(0.7);
      expect(result.explanation).toContain('historical outcomes');
    });

    it('prefers performance score over outcomes', () => {
      const outcomes = [makeOutcome({ successScore: 0.1 })]; // low
      const result = evolveConfidence(0.7, 0.9, outcomes); // high score
      expect(result.evolvedConfidence).toBeGreaterThan(0.7); // score wins
    });
  });

  describe('computeNilDeterministicVariance', () => {
    it('reports aligned when values are close', () => {
      const result = computeNilDeterministicVariance(0.72, 0.74);
      expect(result.direction).toBe('aligned');
      expect(result.variance).toBeLessThan(0.05);
    });

    it('reports nil_higher when NIL exceeds deterministic', () => {
      const result = computeNilDeterministicVariance(0.8, 0.5);
      expect(result.direction).toBe('nil_higher');
      expect(result.variance).toBeCloseTo(0.3, 2);
    });

    it('reports deterministic_higher when deterministic exceeds NIL', () => {
      const result = computeNilDeterministicVariance(0.3, 0.7);
      expect(result.direction).toBe('deterministic_higher');
      expect(result.variance).toBeCloseTo(0.4, 2);
    });
  });

  describe('buildConfidenceBreakdown', () => {
    it('builds breakdown with correct band', () => {
      const result = buildConfidenceBreakdown(0.8, { cohort: 0.3, agreement: 0.5 });
      expect(result.band).toBe('high');
      expect(result.factors).toHaveLength(2);
    });

    it('classifies medium band', () => {
      const result = buildConfidenceBreakdown(0.5, { cohort: 0.5 });
      expect(result.band).toBe('medium');
    });

    it('classifies low band', () => {
      const result = buildConfidenceBreakdown(0.2, { cohort: 0.2 });
      expect(result.band).toBe('low');
    });

    it('uses custom descriptions when provided', () => {
      const result = buildConfidenceBreakdown(
        0.7,
        { custom: 0.7 },
        { custom: 'My custom factor' },
      );
      expect(result.factors[0]!.description).toBe('My custom factor');
    });

    it('uses default descriptions for known factors', () => {
      const result = buildConfidenceBreakdown(0.7, { cohort: 0.3 });
      expect(result.factors[0]!.description).toContain('organization');
    });
  });
});
