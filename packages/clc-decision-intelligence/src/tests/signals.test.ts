/**
 * Time-Series Signals — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  computeTrendVelocity,
  computeAcceleration,
  detectInflectionPoint,
  classifySignalPersistence,
  analyzeTrend,
} from '../signals/index';
import type { TimeSeriesPoint } from '../contracts/index';

function makeSeries(values: number[]): TimeSeriesPoint[] {
  return values.map((value, i) => ({ period: `2026-Q${i + 1}`, value }));
}

describe('signals / time-series', () => {
  describe('computeTrendVelocity', () => {
    it('returns 0 for a single point', () => {
      expect(computeTrendVelocity(makeSeries([10]))).toBe(0);
    });

    it('returns positive velocity for rising series', () => {
      expect(computeTrendVelocity(makeSeries([10, 20, 30]))).toBeGreaterThan(0);
    });

    it('returns negative velocity for falling series', () => {
      expect(computeTrendVelocity(makeSeries([30, 20, 10]))).toBeLessThan(0);
    });

    it('returns 0 for flat series', () => {
      expect(computeTrendVelocity(makeSeries([5, 5, 5, 5]))).toBe(0);
    });

    it('computes correct average rate of change', () => {
      // [10, 20, 30] → deltas [+10, +10] → avg = 10
      expect(computeTrendVelocity(makeSeries([10, 20, 30]))).toBeCloseTo(10);
    });
  });

  describe('computeAcceleration', () => {
    it('returns 0 for constant velocity', () => {
      // constant velocity = uniform increase
      expect(computeAcceleration(makeSeries([10, 20, 30, 40]))).toBeCloseTo(0);
    });

    it('returns positive for accelerating series', () => {
      // velocities [10, 20, 30] → acceleration > 0
      expect(computeAcceleration(makeSeries([10, 20, 40, 70]))).toBeGreaterThan(0);
    });

    it('returns 0 for fewer than 3 points', () => {
      expect(computeAcceleration(makeSeries([10, 20]))).toBe(0);
    });
  });

  describe('detectInflectionPoint', () => {
    it('returns null for monotonic series', () => {
      expect(detectInflectionPoint(makeSeries([10, 20, 30, 40]))).toBeNull();
    });

    it('detects direction change', () => {
      const result = detectInflectionPoint(makeSeries([10, 20, 30, 25, 20]));
      expect(result).not.toBeNull();
      expect(result!.index).toBe(3); // at value 25, direction changed
    });

    it('returns null for too-short series', () => {
      expect(detectInflectionPoint(makeSeries([10, 20]))).toBeNull();
    });
  });

  describe('classifySignalPersistence', () => {
    it('classifies persistent rising series', () => {
      const result = classifySignalPersistence(makeSeries([10, 20, 30, 40, 50]));
      expect(result.isPersistent).toBe(true);
      expect(result.persistenceScore).toBeGreaterThan(0.7);
    });

    it('classifies volatile series as non-persistent', () => {
      const result = classifySignalPersistence(makeSeries([10, 20, 10, 20, 10]));
      expect(result.isPersistent).toBe(false);
      expect(result.persistenceScore).toBeLessThan(0.5);
    });

    it('handles flat series', () => {
      const result = classifySignalPersistence(makeSeries([5, 5, 5, 5]));
      expect(result.persistenceScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeTrend', () => {
    it('classifies rising steady trend', () => {
      const result = analyzeTrend(makeSeries([10, 15, 20, 25, 30]));
      expect(result.direction).toBe('rising');
      expect(result.classification).toBe('rising_steadily');
      expect(result.velocity).toBeGreaterThan(0);
      expect(result.description).toBeTruthy();
    });

    it('classifies sudden spike', () => {
      const result = analyzeTrend(makeSeries([10, 12, 8, 80]));
      expect(result.classification).toBe('sudden_spike');
    });

    it('classifies stable trend', () => {
      const result = analyzeTrend(makeSeries([10, 10, 11, 10, 10]));
      expect(result.direction).toBe('stable');
      expect(result.classification).toBe('stable');
    });

    it('classifies gradual decline', () => {
      const result = analyzeTrend(makeSeries([30, 27, 24, 21, 18]));
      expect(result.direction).toBe('falling');
      expect(result.classification).toBe('gradual_decline');
    });

    it('returns sensible defaults for short series', () => {
      const result = analyzeTrend(makeSeries([10]));
      expect(result.direction).toBe('stable');
      expect(result.velocity).toBe(0);
    });
  });
});
