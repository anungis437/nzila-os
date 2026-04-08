/**
 * Confidence Model — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  computeCohortFactor,
  computeRecencyFactor,
  computeAgreementFactor,
  computeSourceFactor,
  computePersistenceFactor,
  computeMissingDataFactor,
  computeConfidence,
  confidenceBandFromScore,
} from '../confidence/index';

describe('confidence model', () => {
  describe('computeCohortFactor', () => {
    it('returns 0 for cohort size 0', () => {
      expect(computeCohortFactor(0)).toBe(0);
    });

    it('returns ~0.5 for cohort size 5', () => {
      const result = computeCohortFactor(5);
      expect(result).toBeGreaterThan(0.3);
      expect(result).toBeLessThan(0.7);
    });

    it('saturates near 1 for large cohorts', () => {
      expect(computeCohortFactor(50)).toBeGreaterThan(0.9);
      expect(computeCohortFactor(100)).toBeGreaterThan(0.95);
    });

    it('increases monotonically', () => {
      const a = computeCohortFactor(3);
      const b = computeCohortFactor(10);
      const c = computeCohortFactor(20);
      expect(b).toBeGreaterThan(a);
      expect(c).toBeGreaterThan(b);
    });
  });

  describe('computeRecencyFactor', () => {
    it('returns 1 for 0 days (fresh data)', () => {
      expect(computeRecencyFactor(0)).toBe(1);
    });

    it('penalizes old data', () => {
      expect(computeRecencyFactor(90)).toBeLessThan(0.5);
      expect(computeRecencyFactor(180)).toBeLessThan(0.3);
    });

    it('never goes below 0', () => {
      expect(computeRecencyFactor(365)).toBeGreaterThanOrEqual(0);
      expect(computeRecencyFactor(1000)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeAgreementFactor', () => {
    it('passes through input clamped 0-1', () => {
      expect(computeAgreementFactor(0)).toBe(0);
      expect(computeAgreementFactor(0.5)).toBe(0.5);
      expect(computeAgreementFactor(1)).toBe(1);
    });
  });

  describe('computeSourceFactor', () => {
    it('returns 0 for 0 sources', () => {
      expect(computeSourceFactor(0)).toBe(0);
    });

    it('saturates near 1 for many sources', () => {
      expect(computeSourceFactor(10)).toBeGreaterThan(0.85);
    });
  });

  describe('computePersistenceFactor', () => {
    it('returns 0 for no persistence', () => {
      expect(computePersistenceFactor(0)).toBe(0);
    });

    it('returns 1 for full persistence', () => {
      expect(computePersistenceFactor(1)).toBe(1);
    });
  });

  describe('computeMissingDataFactor', () => {
    it('returns 1 for no missing data', () => {
      expect(computeMissingDataFactor(0)).toBe(1);
    });

    it('returns 0 for full missing data penalty', () => {
      expect(computeMissingDataFactor(1)).toBe(0);
    });
  });

  describe('confidenceBandFromScore', () => {
    it('classifies high confidence', () => {
      expect(confidenceBandFromScore(0.7)).toBe('high');
      expect(confidenceBandFromScore(0.9)).toBe('high');
    });

    it('classifies medium confidence', () => {
      expect(confidenceBandFromScore(0.4)).toBe('medium');
      expect(confidenceBandFromScore(0.6)).toBe('medium');
    });

    it('classifies low confidence', () => {
      expect(confidenceBandFromScore(0.1)).toBe('low');
      expect(confidenceBandFromScore(0.39)).toBe('low');
    });
  });

  describe('computeConfidence', () => {
    it('returns high confidence for ideal inputs', () => {
      const result = computeConfidence({
        cohortSize: 30,
        recencyDays: 1,
        signalAgreement: 0.9,
        sourceCount: 8,
        persistenceScore: 0.9,
        missingDataPenalty: 0,
      });
      expect(result.confidenceBand).toBe('high');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.confidenceExplanation).toBeTruthy();
    });

    it('returns low confidence for poor inputs', () => {
      const result = computeConfidence({
        cohortSize: 1,
        recencyDays: 180,
        signalAgreement: 0.1,
        sourceCount: 1,
        persistenceScore: 0.1,
        missingDataPenalty: 0.8,
      });
      expect(result.confidenceBand).toBe('low');
      expect(result.confidence).toBeLessThan(0.4);
    });

    it('includes weighted factor breakdown', () => {
      const result = computeConfidence({
        cohortSize: 10,
        recencyDays: 7,
        signalAgreement: 0.6,
        sourceCount: 4,
        persistenceScore: 0.5,
        missingDataPenalty: 0.1,
      });
      expect(result.factors).toBeDefined();
      expect(result.factors.cohortFactor).toBeGreaterThan(0);
      expect(result.factors.recencyFactor).toBeGreaterThan(0);
    });
  });
});
