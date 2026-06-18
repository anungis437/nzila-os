import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import {
  aggregateWithPrivacy,
  calculateTrendWithConfidence,
  compareTrends,
  generateLegislativeBrief,
  validateAggregationRequest,
} from '../aggregation-service';
import type { AggregationInput } from '../aggregation-service';
import type { MovementTrend } from '@/types/marketing';

function points(n: number, value = 10, weight?: number) {
  return Array.from({ length: n }, (_, i) => ({ organizationId: `org-${i}`, value, weight }));
}

function trend(overrides: Partial<MovementTrend> = {}): MovementTrend {
  return {
    id: 't1',
    trendType: 'win-rate',
    aggregatedValue: 50,
    participatingOrgs: 10,
    totalCases: 50,
    timeframe: 'month',
    calculatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MovementTrend;
}

describe('lib/movement-insights/aggregation-service', () => {
  describe('aggregateWithPrivacy', () => {
    it('rejects when too few organizations', () => {
      expect(aggregateWithPrivacy({ trendType: 'x', timeframe: 'month', dataPoints: points(3) })).toBeNull();
    });
    it('rejects when too few cases (weighted)', () => {
      expect(
        aggregateWithPrivacy({ trendType: 'x', timeframe: 'month', dataPoints: points(6, 10, 1) }, { minCases: 100 }),
      ).toBeNull();
    });
    it('computes a simple average without noise', () => {
      const t = aggregateWithPrivacy(
        { trendType: 'x', timeframe: 'month', dataPoints: points(10, 20) },
        { addNoise: false, minCases: 1 },
      );
      expect(t?.aggregatedValue).toBe(20);
      expect(t?.participatingOrgs).toBe(10);
    });
    it('computes a weighted average with noise', () => {
      const t = aggregateWithPrivacy(
        { trendType: 'x', timeframe: 'month', dataPoints: points(10, 20, 2) },
        { addNoise: true, minCases: 1 },
      );
      expect(t).not.toBeNull();
      expect(t?.totalCases).toBe(20);
    });
  });

  describe('calculateTrendWithConfidence', () => {
    it('returns low confidence when no trend', () => {
      const r = calculateTrendWithConfidence({ trendType: 'x', timeframe: 'month', dataPoints: points(2) });
      expect(r.trend).toBeNull();
      expect(r.confidence).toBe('low');
    });
    it('returns high confidence for large samples', () => {
      const r = calculateTrendWithConfidence(
        { trendType: 'x', timeframe: 'month', dataPoints: points(25, 10, 5) },
        { addNoise: false, minCases: 1 },
      );
      expect(r.confidence).toBe('high');
    });
    it('returns medium confidence for moderate samples', () => {
      const r = calculateTrendWithConfidence(
        { trendType: 'x', timeframe: 'month', dataPoints: points(12, 10, 5) },
        { addNoise: false, minCases: 1 },
      );
      expect(r.confidence).toBe('medium');
    });
    it('returns low confidence at minimum threshold', () => {
      const r = calculateTrendWithConfidence(
        { trendType: 'x', timeframe: 'month', dataPoints: points(6, 10, 2) },
        { addNoise: false, minCases: 1 },
      );
      expect(r.confidence).toBe('low');
    });
  });

  describe('compareTrends', () => {
    it('detects stable trends', () => {
      const r = compareTrends(trend({ aggregatedValue: 51 }), trend({ aggregatedValue: 50 }));
      expect(r.direction).toBe('stable');
    });
    it('improving when higher-is-better grows significantly', () => {
      const r = compareTrends(trend({ aggregatedValue: 80 }), trend({ aggregatedValue: 50 }));
      expect(r.direction).toBe('improving');
      expect(r.significance).toBe('significant');
    });
    it('improving when lower-is-better decreases', () => {
      const r = compareTrends(
        trend({ trendType: 'avg-resolution-time', aggregatedValue: 30 }),
        trend({ trendType: 'avg-resolution-time', aggregatedValue: 50 }),
      );
      expect(r.direction).toBe('improving');
    });
    it('handles zero previous value and minor significance', () => {
      const r = compareTrends(trend({ aggregatedValue: 5.5 }), trend({ aggregatedValue: 5 }));
      expect(r.changePercent).toBe(10);
      const z = compareTrends(trend({ aggregatedValue: 10 }), trend({ aggregatedValue: 0 }));
      expect(z.changePercent).toBe(0);
    });
  });

  describe('generateLegislativeBrief', () => {
    it('builds findings and recommendations across trend types', () => {
      const brief = generateLegislativeBrief(
        [
          trend({ trendType: 'avg-resolution-time', aggregatedValue: 70, participatingOrgs: 12, totalCases: 100 }),
          trend({ trendType: 'win-rate', aggregatedValue: 40, participatingOrgs: 8, totalCases: 60 }),
          trend({ trendType: 'member-satisfaction', aggregatedValue: 4.2, participatingOrgs: 9 }),
        ],
        'Resolution',
      );
      expect(brief.keyFindings.length).toBe(3);
      expect(brief.recommendations.length).toBe(2);
    });
  });

  describe('validateAggregationRequest', () => {
    it('valid when enough consenting orgs', () => {
      const consent = new Map([...Array(6)].map((_, i) => [`org-${i}`, true] as const));
      const ids = [...Array(6)].map((_, i) => `org-${i}`);
      expect(validateAggregationRequest(ids, 'x', consent).valid).toBe(true);
    });
    it('invalid when too few consenting orgs', () => {
      const consent = new Map([['a', true], ['b', false]]);
      const r = validateAggregationRequest(['a', 'b'], 'x', consent);
      expect(r.valid).toBe(false);
      expect(r.ineligibleOrgs).toContain('b');
    });
  });
});
