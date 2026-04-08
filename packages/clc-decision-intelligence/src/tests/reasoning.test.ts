/**
 * Strategic Reasoning / Data Products — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import type { CorrelatedPattern, DecisionRecommendation } from '../contracts/index.js';
import type { SectorAggregate, SectorTimeSeries } from '../correlation/index.js';
import {
  deriveMovementRiskPosture,
  analyzeSectorDivergence,
  deriveBargainingWatch,
  generateExecutiveBriefingCards,
  runDecisionIntelligencePipeline,
} from '../reasoning/index.js';

function makePattern(id: string, overrides: Partial<CorrelatedPattern> = {}): CorrelatedPattern {
  return {
    id,
    patternType: 'cross_affiliate_issue_cluster',
    title: `Pattern ${id}`,
    summary: `Summary for ${id}`,
    affectedSectors: ['Mining'],
    affectedAffiliateTypes: [],
    confidence: 0.7,
    watchLevel: 'elevated',
    evidenceRefs: [`ref:${id}`],
    ...overrides,
  };
}

function makeSectors(): SectorAggregate[] {
  return [
    { sector: 'Mining', clauseCount: 30, precedentCount: 10, totalCitations: 50, totalViews: 200, uniqueOrgs: 10, topClauseTypes: [{ clauseType: 'Wages', count: 15 }, { clauseType: 'Safety', count: 10 }] },
    { sector: 'Education', clauseCount: 20, precedentCount: 5, totalCitations: 30, totalViews: 150, uniqueOrgs: 8, topClauseTypes: [{ clauseType: 'Wages', count: 10 }, { clauseType: 'Benefits', count: 8 }] },
    { sector: 'Healthcare', clauseCount: 25, precedentCount: 8, totalCitations: 40, totalViews: 180, uniqueOrgs: 9, topClauseTypes: [{ clauseType: 'Hours', count: 12 }, { clauseType: 'Wages', count: 10 }] },
  ];
}

describe('reasoning / data products', () => {
  describe('deriveMovementRiskPosture', () => {
    it('returns steady for no patterns', () => {
      const result = deriveMovementRiskPosture([], makeSectors());
      expect(result.posture).toBe('steady');
      expect(result.watchAreas).toEqual([]);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('returns vigilant for some high-watch patterns', () => {
      const patterns = [makePattern('P1', { watchLevel: 'high' })];
      const result = deriveMovementRiskPosture(patterns, makeSectors());
      expect(result.posture).toBe('vigilant');
      expect(result.watchAreas.length).toBe(1);
    });

    it('returns heightened for many high-watch patterns', () => {
      const patterns = [
        makePattern('P1', { watchLevel: 'high' }),
        makePattern('P2', { watchLevel: 'high' }),
        makePattern('P3', { watchLevel: 'critical' }),
      ];
      const result = deriveMovementRiskPosture(patterns, makeSectors());
      expect(result.posture).toBe('heightened');
    });

    it('identifies rising sectors from bargaining pressure', () => {
      const patterns = [
        makePattern('P1', {
          patternType: 'bargaining_pressure_signal',
          affectedSectors: ['Mining'],
        }),
      ];
      const result = deriveMovementRiskPosture(patterns, makeSectors());
      expect(result.risingSectors).toContain('Mining');
    });

    it('includes summary text', () => {
      const result = deriveMovementRiskPosture([], makeSectors());
      expect(result.summary).toBeTruthy();
    });
  });

  describe('analyzeSectorDivergence', () => {
    it('returns empty for fewer than 2 sectors', () => {
      expect(analyzeSectorDivergence([makeSectors()[0]], [])).toEqual([]);
    });

    it('returns a divergence entry per sector', () => {
      const sectors = makeSectors();
      const result = analyzeSectorDivergence(sectors, []);
      expect(result.length).toBe(sectors.length);
    });

    it('computes divergenceScore for each sector', () => {
      const sectors = makeSectors();
      const result = analyzeSectorDivergence(sectors, []);
      for (const d of result) {
        expect(d.divergenceScore).toBeGreaterThanOrEqual(0);
        expect(d.sector).toBeTruthy();
      }
    });

    it('identifies unique factors', () => {
      const sectors = makeSectors();
      const result = analyzeSectorDivergence(sectors, []);
      // Mining has "Safety" that no other sector has
      const mining = result.find((d) => d.sector === 'Mining');
      expect(mining).toBeDefined();
      expect(mining!.uniqueFactors).toContain('Safety');
    });

    it('uses time series for velocity when available', () => {
      const sectors = makeSectors();
      const sts: SectorTimeSeries[] = [{
        sector: 'Mining',
        series: [
          { period: '2026-Q1', value: 10 },
          { period: '2026-Q2', value: 20 },
          { period: '2026-Q3', value: 30 },
        ],
      }];
      const result = analyzeSectorDivergence(sectors, sts);
      const mining = result.find((d) => d.sector === 'Mining');
      expect(mining!.velocity).toBeGreaterThan(0);
    });
  });

  describe('deriveBargainingWatch', () => {
    it('returns null when no bargaining patterns', () => {
      const patterns = [makePattern('P1', { patternType: 'cross_sector_shift' })];
      expect(deriveBargainingWatch(patterns, [])).toBeNull();
    });

    it('creates watch for bargaining pressure patterns', () => {
      const patterns = [
        makePattern('P1', {
          patternType: 'bargaining_pressure_signal',
          affectedSectors: ['Mining'],
          confidence: 0.75,
        }),
      ];
      const recs: DecisionRecommendation[] = [{
        id: 'REC-P1',
        signalId: 'P1',
        recommendedAction: 'escalate',
        rationale: 'Test',
        timeframe: 'now',
        targetAudience: 'clc_executive',
        confidence: 0.75,
      }];
      const watch = deriveBargainingWatch(patterns, recs);
      expect(watch).not.toBeNull();
      expect(watch!.sectors).toContain('Mining');
      expect(watch!.recommendedAction).toBe('escalate');
      expect(watch!.signalStrength).toBeTruthy();
    });

    it('deduplicates sectors from multiple patterns', () => {
      const patterns = [
        makePattern('P1', { patternType: 'bargaining_pressure_signal', affectedSectors: ['Mining'] }),
        makePattern('P2', { patternType: 'bargaining_pressure_signal', affectedSectors: ['Mining', 'Education'] }),
      ];
      const watch = deriveBargainingWatch(patterns, []);
      expect(watch!.sectors).toEqual(['Mining', 'Education']);
    });
  });

  describe('generateExecutiveBriefingCards', () => {
    it('creates cards from patterns', () => {
      const patterns = [
        makePattern('P1', { patternType: 'cross_affiliate_issue_cluster' }),
        makePattern('P2', { patternType: 'bargaining_pressure_signal' }),
      ];
      const recs: DecisionRecommendation[] = [
        { id: 'REC-P1', signalId: 'P1', recommendedAction: 'prepare', rationale: 'Test', timeframe: '30_days', targetAudience: 'clc_staff', confidence: 0.7 },
      ];
      const cards = generateExecutiveBriefingCards(patterns, recs);
      expect(cards.length).toBe(2);
      expect(cards[0].category).toBe('risk');
      expect(cards[1].category).toBe('trend');
    });

    it('links recommendations to cards', () => {
      const patterns = [makePattern('P1')];
      const recs: DecisionRecommendation[] = [
        { id: 'REC-P1', signalId: 'P1', recommendedAction: 'escalate', rationale: 'Test', timeframe: 'now', targetAudience: 'clc_executive', confidence: 0.8 },
      ];
      const cards = generateExecutiveBriefingCards(patterns, recs);
      expect(cards[0].recommendedAction).toBe('escalate');
      expect(cards[0].timeframe).toBe('now');
    });

    it('includes confidence band', () => {
      const cards = generateExecutiveBriefingCards([makePattern('P1', { confidence: 0.8 })], []);
      expect(cards[0].confidenceBand).toBe('high');
    });
  });

  describe('runDecisionIntelligencePipeline', () => {
    it('produces complete output', () => {
      const sectors = makeSectors();
      const affiliateTypes = [{ organizationType: 'Public', affiliateCount: 10, clausesShared: 50, precedentsShared: 20 }];
      const sts: SectorTimeSeries[] = [];

      const output = runDecisionIntelligencePipeline(sectors, affiliateTypes, sts);
      expect(output.riskPosture).toBeDefined();
      expect(output.sectorDivergence).toBeDefined();
      expect(Array.isArray(output.patterns)).toBe(true);
      expect(Array.isArray(output.recommendations)).toBe(true);
      expect(Array.isArray(output.briefingCards)).toBe(true);
    });

    it('produces consistent cross-references', () => {
      const sectors = makeSectors();
      const output = runDecisionIntelligencePipeline(sectors, [], []);

      // Every recommendation should reference a real pattern
      for (const rec of output.recommendations) {
        const pattern = output.patterns.find((p) => p.id === rec.signalId);
        expect(pattern).toBeDefined();
      }

      // Every briefing card should have a valid confidence band
      for (const card of output.briefingCards) {
        expect(['high', 'medium', 'low']).toContain(card.confidenceBand);
      }
    });
  });
});
