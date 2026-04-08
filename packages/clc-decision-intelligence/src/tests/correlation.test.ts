/**
 * Correlation Engine — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import type { SectorAggregate, SectorTimeSeries } from '../correlation/index.js';
import {
  detectIssueCluster,
  detectSectorShift,
  detectPrecedentConcentration,
  detectBargainingPressure,
  detectAllPatterns,
} from '../correlation/index.js';

function makeSectors(count: number): SectorAggregate[] {
  const clauseTypes = ['Wages', 'Working Hours', 'Benefits', 'Safety'];
  return Array.from({ length: count }, (_, i) => ({
    sector: `Sector-${i + 1}`,
    clauseCount: 20 + i * 5,
    precedentCount: 5 + i * 2,
    totalCitations: 30,
    totalViews: 100,
    uniqueOrgs: 8,
    topClauseTypes: clauseTypes.slice(0, 2 + (i % 3)).map((ct) => ({ clauseType: ct, count: 5 + i })),
  }));
}

describe('correlation engine', () => {
  describe('detectIssueCluster', () => {
    it('returns empty for fewer than 2 sectors', () => {
      expect(detectIssueCluster(makeSectors(1))).toEqual([]);
    });

    it('detects clusters when clause type appears in 3+ sectors', () => {
      const sectors = makeSectors(5);
      // "Wages" appears in all 5 sectors via topClauseTypes
      const patterns = detectIssueCluster(sectors);
      const wagesCluster = patterns.find((p) => p.id.includes('wages'));
      expect(wagesCluster).toBeDefined();
      expect(wagesCluster!.patternType).toBe('cross_affiliate_issue_cluster');
      expect(wagesCluster!.affectedSectors.length).toBeGreaterThanOrEqual(3);
    });

    it('includes evidence refs', () => {
      const patterns = detectIssueCluster(makeSectors(5));
      for (const p of patterns) {
        expect(p.evidenceRefs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('detectSectorShift', () => {
    it('returns empty for fewer than 3 sectors', () => {
      expect(detectSectorShift(makeSectors(2))).toEqual([]);
    });

    it('detects divergent sectors', () => {
      const sectors: SectorAggregate[] = [
        { sector: 'Normal-1', clauseCount: 20, precedentCount: 5, totalCitations: 30, totalViews: 100, uniqueOrgs: 8, topClauseTypes: [] },
        { sector: 'Normal-2', clauseCount: 22, precedentCount: 6, totalCitations: 30, totalViews: 100, uniqueOrgs: 8, topClauseTypes: [] },
        { sector: 'Normal-3', clauseCount: 18, precedentCount: 4, totalCitations: 30, totalViews: 100, uniqueOrgs: 8, topClauseTypes: [] },
        { sector: 'Divergent', clauseCount: 100, precedentCount: 50, totalCitations: 30, totalViews: 100, uniqueOrgs: 8, topClauseTypes: [] },
      ];
      const patterns = detectSectorShift(sectors);
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns.some((p) => p.affectedSectors.includes('Divergent'))).toBe(true);
    });
  });

  describe('detectPrecedentConcentration', () => {
    it('returns empty for fewer than 2 sectors', () => {
      expect(detectPrecedentConcentration(makeSectors(1))).toEqual([]);
    });

    it('detects high precedent-to-clause ratios', () => {
      const sectors: SectorAggregate[] = [
        { sector: 'Normal', clauseCount: 20, precedentCount: 3, totalCitations: 30, totalViews: 100, uniqueOrgs: 8, topClauseTypes: [] },
        { sector: 'Normal-2', clauseCount: 25, precedentCount: 4, totalCitations: 30, totalViews: 100, uniqueOrgs: 8, topClauseTypes: [] },
        { sector: 'HighDispute', clauseCount: 5, precedentCount: 30, totalCitations: 30, totalViews: 100, uniqueOrgs: 8, topClauseTypes: [] },
      ];
      const patterns = detectPrecedentConcentration(sectors);
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns[0]!.affectedSectors).toContain('HighDispute');
      expect(patterns[0]!.patternType).toBe('precedent_concentration');
    });
  });

  describe('detectBargainingPressure', () => {
    it('returns empty for short time series', () => {
      const sts: SectorTimeSeries[] = [
        { sector: 'Mining', series: [{ period: '2026-Q1', value: 10 }] },
      ];
      expect(detectBargainingPressure(sts, makeSectors(1))).toEqual([]);
    });

    it('detects accelerating persistent trends', () => {
      const sts: SectorTimeSeries[] = [
        {
          sector: 'Mining',
          series: [
            { period: '2026-Q1', value: 10 },
            { period: '2026-Q2', value: 15 },
            { period: '2026-Q3', value: 22 },
            { period: '2026-Q4', value: 30 },
            { period: '2027-Q1', value: 40 },
          ],
        },
      ];
      const sectors = [{ sector: 'Mining', clauseCount: 40, precedentCount: 10, totalCitations: 50, totalViews: 200, uniqueOrgs: 12, topClauseTypes: [] }];
      const patterns = detectBargainingPressure(sts, sectors);
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns[0]!.patternType).toBe('bargaining_pressure_signal');
    });
  });

  describe('detectAllPatterns', () => {
    it('combines all pattern types sorted by watch level', () => {
      const sectors = makeSectors(5);
      const affiliateTypes = [{ organizationType: 'Public', affiliateCount: 10, clausesShared: 50, precedentsShared: 20 }];
      const sts: SectorTimeSeries[] = [];
      const patterns = detectAllPatterns(sectors, affiliateTypes, sts);
      expect(Array.isArray(patterns)).toBe(true);
      // Should have at least issue cluster patterns
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('returns sorted by watch level then confidence', () => {
      const sectors = makeSectors(5);
      const patterns = detectAllPatterns(sectors, [], []);
      if (patterns.length >= 2) {
        const watchOrder: Record<string, number> = { critical: 0, high: 1, elevated: 2, monitor: 3 };
        for (let i = 1; i < patterns.length; i++) {
          const prev = watchOrder[patterns[i - 1]!.watchLevel]!;
          const curr = watchOrder[patterns[i]!.watchLevel]!;
          if (prev === curr) {
            expect(patterns[i - 1]!.confidence).toBeGreaterThanOrEqual(patterns[i]!.confidence);
          } else {
            expect(prev).toBeLessThanOrEqual(curr);
          }
        }
      }
    });
  });
});
