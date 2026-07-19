import { describe, expect, it } from 'vitest';

import {
  calculateConcentrationGrowthRate,
  estimateCrisisDate,
  forecastContinuityHealth,
  identifyApproachingThresholds,
  projectGovernanceErosion,
  projectRedundancyErosion,
  projectUndocumentedWorkflowGrowth,
  projectVendorConcentrationRisk,
} from '../forecast-models';

describe('lib/knowledge-transfer/forecasting/forecast-models', () => {
  describe('calculateConcentrationGrowthRate', () => {
    it('returns 0 when there are no knowledge areas', () => {
      expect(calculateConcentrationGrowthRate(1, 0, 0)).toBe(0);
    });
    it('returns positive growth when concentration worsens', () => {
      expect(calculateConcentrationGrowthRate(6, 4, 10)).toBeCloseTo(20, 5);
    });
  });

  describe('projectUndocumentedWorkflowGrowth', () => {
    it('produces 12 monotonically non-decreasing capped projections', () => {
      const p = projectUndocumentedWorkflowGrowth(50, 0, 10);
      expect(p).toHaveLength(12);
      expect(p[0]).toBeGreaterThanOrEqual(50);
      expect(Math.max(...p)).toBeLessThanOrEqual(100);
    });
  });

  describe('projectGovernanceErosion', () => {
    it('decays maturity but never below 10', () => {
      expect(projectGovernanceErosion(100, 1)).toBeCloseTo(98, 5);
      expect(projectGovernanceErosion(10, 12)).toBe(10);
    });
  });

  describe('projectRedundancyErosion', () => {
    it('erodes redundancy under turnover and floors at 1', () => {
      const p = projectRedundancyErosion(20, 50, 0);
      expect(p).toHaveLength(12);
      expect(p[p.length - 1]).toBeGreaterThanOrEqual(1);
    });
    it('retraining offsets loss', () => {
      const noRetrain = projectRedundancyErosion(20, 50, 0)[0];
      const retrain = projectRedundancyErosion(20, 50, 1)[0];
      expect(retrain).toBeGreaterThanOrEqual(noRetrain);
    });
  });

  describe('projectVendorConcentrationRisk', () => {
    it('grows faster with minimal documentation', () => {
      const minimal = projectVendorConcentrationRisk(10, 3, 'minimal')[0];
      const good = projectVendorConcentrationRisk(10, 3, 'good')[0];
      expect(minimal).toBeGreaterThan(good);
    });
  });

  describe('forecastContinuityHealth', () => {
    it('produces a 0-100 weighted score', () => {
      const h = forecastContinuityHealth(20, 80, 70, 90);
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(100);
    });
  });

  describe('identifyApproachingThresholds', () => {
    it('flags warning and critical risk levels and low health', () => {
      const thresholds = identifyApproachingThresholds({
        trackedRisks: [
          { riskType: 'vendor_risk', projectedValue: 80, isFavorable: false } as never,
          { riskType: 'governance_drift', projectedValue: 90, isFavorable: false } as never,
        ],
        projections: [{ healthScore: 30 } as never],
      } as never);
      expect(thresholds.some((t) => t.includes('warning threshold'))).toBe(true);
      expect(thresholds.some((t) => t.startsWith('CRITICAL'))).toBe(true);
    });
  });

  describe('estimateCrisisDate', () => {
    it('returns null when rate is zero or beyond horizon', () => {
      expect(estimateCrisisDate(50, 0, 85, 'increasing')).toBeNull();
      expect(estimateCrisisDate(0, 1, 100, 'increasing')).toBeNull();
    });
    it('returns a future date within the horizon', () => {
      const d = estimateCrisisDate(70, 5, 85, 'increasing');
      expect(d).toBeInstanceOf(Date);
    });
  });
});
