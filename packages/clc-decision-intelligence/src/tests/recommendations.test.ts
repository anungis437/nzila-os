/**
 * Recommendation Engine — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import type { CorrelatedPattern, TrendAnalysis, ConfidenceResult } from '../contracts/index.js';
import {
  recommendForPattern,
  generateRecommendations,
  recommendFromTrend,
} from '../recommendations/index.js';

function makePattern(overrides: Partial<CorrelatedPattern> = {}): CorrelatedPattern {
  return {
    id: 'TEST-001',
    patternType: 'cross_affiliate_issue_cluster',
    title: 'Test pattern',
    summary: 'Test summary',
    affectedSectors: ['Mining'],
    affectedAffiliateTypes: [],
    confidence: 0.7,
    watchLevel: 'elevated',
    evidenceRefs: ['ref:1'],
    ...overrides,
  };
}

describe('recommendation engine', () => {
  describe('recommendForPattern', () => {
    it('recommends intervene for high-watch issue cluster', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'cross_affiliate_issue_cluster',
        watchLevel: 'high',
      }));
      expect(rec.recommendedAction).toBe('intervene');
      expect(rec.targetAudience).toBe('federation_leadership');
      expect(rec.signalId).toBe('TEST-001');
    });

    it('recommends prepare for elevated issue cluster', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'cross_affiliate_issue_cluster',
        watchLevel: 'elevated',
      }));
      expect(rec.recommendedAction).toBe('prepare');
    });

    it('recommends escalate for high bargaining pressure', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'bargaining_pressure_signal',
        watchLevel: 'high',
      }));
      expect(rec.recommendedAction).toBe('escalate');
      expect(rec.timeframe).toBe('now');
      expect(rec.targetAudience).toBe('clc_executive');
    });

    it('recommends prepare for elevated bargaining pressure', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'bargaining_pressure_signal',
        watchLevel: 'elevated',
      }));
      expect(rec.recommendedAction).toBe('prepare');
      expect(rec.timeframe).toBe('7_days');
    });

    it('recommends escalate for high cross-sector shift', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'cross_sector_shift',
        watchLevel: 'high',
      }));
      expect(rec.recommendedAction).toBe('escalate');
    });

    it('recommends monitor for elevated cross-sector shift', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'cross_sector_shift',
        watchLevel: 'elevated',
      }));
      expect(rec.recommendedAction).toBe('monitor');
    });

    it('recommends intervene for high precedent concentration', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'precedent_concentration',
        watchLevel: 'high',
      }));
      expect(rec.recommendedAction).toBe('intervene');
      expect(rec.targetAudience).toBe('research_policy_team');
    });

    it('falls back to monitor for unknown pattern types', () => {
      const rec = recommendForPattern(makePattern({
        patternType: 'employer_pattern',
        watchLevel: 'monitor',
      }));
      expect(rec.recommendedAction).toBe('prepare');
    });

    it('includes rationale text', () => {
      const rec = recommendForPattern(makePattern());
      expect(rec.rationale).toBeTruthy();
      expect(rec.rationale.length).toBeGreaterThan(10);
    });
  });

  describe('generateRecommendations', () => {
    it('returns sorted by action urgency', () => {
      const patterns = [
        makePattern({ id: 'P1', patternType: 'cross_sector_shift', watchLevel: 'elevated' }), // monitor
        makePattern({ id: 'P2', patternType: 'bargaining_pressure_signal', watchLevel: 'high' }), // escalate
        makePattern({ id: 'P3', patternType: 'cross_affiliate_issue_cluster', watchLevel: 'high' }), // intervene
      ];
      const recs = generateRecommendations(patterns);
      expect(recs.length).toBe(3);
      expect(recs[0].recommendedAction).toBe('intervene');
      expect(recs[1].recommendedAction).toBe('escalate');
      expect(recs[2].recommendedAction).toBe('monitor');
    });

    it('returns empty for no patterns', () => {
      expect(generateRecommendations([])).toEqual([]);
    });
  });

  describe('recommendFromTrend', () => {
    it('returns escalate for sudden spike', () => {
      const trend: TrendAnalysis = {
        direction: 'rising',
        classification: 'sudden_spike',
        velocity: 20,
        acceleration: 10,
        hasInflectionPoint: false,
        inflectionPeriod: null,
        isPersistent: false,
        persistenceScore: 0.3,
        description: 'Sudden spike in activity',
      };
      const confidence: ConfidenceResult = {
        confidence: 0.7,
        confidenceBand: 'high',
        confidenceExplanation: 'test',
        factors: { cohortFactor: 0.8, recencyFactor: 0.9, agreementFactor: 0.7, sourceFactor: 0.6, persistenceFactor: 0.5, missingDataFactor: 0.9 },
      };
      const rec = recommendFromTrend('ClauseActivity', trend, confidence);
      expect(rec).not.toBeNull();
      expect(rec!.recommendedAction).toBe('escalate');
      expect(rec!.timeframe).toBe('now');
    });

    it('returns null for stable trends', () => {
      const trend: TrendAnalysis = {
        direction: 'stable',
        classification: 'stable',
        velocity: 0,
        acceleration: 0,
        hasInflectionPoint: false,
        inflectionPeriod: null,
        isPersistent: true,
        persistenceScore: 0.8,
        description: 'Stable',
      };
      const confidence: ConfidenceResult = {
        confidence: 0.6,
        confidenceBand: 'medium',
        confidenceExplanation: 'test',
        factors: { cohortFactor: 0.7, recencyFactor: 0.8, agreementFactor: 0.6, sourceFactor: 0.5, persistenceFactor: 0.8, missingDataFactor: 0.9 },
      };
      expect(recommendFromTrend('Activity', trend, confidence)).toBeNull();
    });

    it('returns prepare for pre-bargaining acceleration', () => {
      const trend: TrendAnalysis = {
        direction: 'rising',
        classification: 'pre_bargaining_acceleration',
        velocity: 5,
        acceleration: 2,
        hasInflectionPoint: false,
        inflectionPeriod: null,
        isPersistent: true,
        persistenceScore: 0.7,
        description: 'Pre-bargaining acceleration',
      };
      const confidence: ConfidenceResult = {
        confidence: 0.65,
        confidenceBand: 'medium',
        confidenceExplanation: 'test',
        factors: { cohortFactor: 0.7, recencyFactor: 0.8, agreementFactor: 0.6, sourceFactor: 0.5, persistenceFactor: 0.7, missingDataFactor: 0.9 },
      };
      const rec = recommendFromTrend('SectorClauses', trend, confidence);
      expect(rec).not.toBeNull();
      expect(rec!.recommendedAction).toBe('prepare');
    });
  });
});
