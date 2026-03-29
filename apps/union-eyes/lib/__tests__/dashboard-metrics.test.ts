import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeKPIs,
  computeAgingBuckets,
  computeTypeCounts,
  computeWorksiteCounts,
  computeAssigneeCounts,
  computeClosureTrends,
  filterCases,
  cachedComputation,
  clearMetricsCache,
  SLA_THRESHOLDS,
  type CaseRow,
} from '../dashboard-metrics';

function makeCase(overrides: Partial<CaseRow> = {}): CaseRow {
  return {
    id: '1',
    status: 'submitted',
    priority: 'medium',
    type: 'grievance',
    assignee: null,
    worksite: null,
    createdAt: new Date('2026-03-01'),
    resolvedAt: null,
    ...overrides,
  };
}

describe('dashboard-metrics', () => {
  const now = new Date('2026-03-28');

  beforeEach(() => {
    clearMetricsCache();
  });

  describe('computeKPIs', () => {
    it('counts open cases', () => {
      const cases = [
        makeCase({ status: 'submitted' }),
        makeCase({ status: 'resolved' }),
        makeCase({ status: 'investigation' }),
      ];
      const kpi = computeKPIs(cases, now);
      expect(kpi.totalOpen).toBe(2);
    });

    it('counts new this week', () => {
      const cases = [
        makeCase({ createdAt: new Date('2026-03-25') }), // within week
        makeCase({ createdAt: new Date('2026-01-01') }), // old
      ];
      const kpi = computeKPIs(cases, now);
      expect(kpi.newThisWeek).toBe(1);
    });

    it('detects overdue acknowledgement', () => {
      const cases = [
        makeCase({ status: 'submitted', createdAt: new Date('2026-03-20') }),
      ];
      const kpi = computeKPIs(cases, now);
      expect(kpi.overdueAcknowledgement).toBe(1);
    });

    it('detects overdue resolution based on priority', () => {
      const cases = [
        makeCase({ status: 'investigation', priority: 'critical', createdAt: new Date('2026-03-01') }),
      ];
      const kpi = computeKPIs(cases, now);
      expect(kpi.overdueResolution).toBe(1);
    });
  });

  describe('computeAgingBuckets', () => {
    it('returns 4 buckets', () => {
      const result = computeAgingBuckets([], now);
      expect(result).toHaveLength(4);
    });

    it('places case in correct bucket', () => {
      const cases = [makeCase({ createdAt: new Date('2026-03-25') })]; // 3 days
      const buckets = computeAgingBuckets(cases, now);
      expect(buckets[0].count).toBe(1); // 0-7 days
    });
  });

  describe('computeTypeCounts', () => {
    it('groups by type', () => {
      const cases = [
        makeCase({ type: 'grievance' }),
        makeCase({ type: 'grievance' }),
        makeCase({ type: 'safety' }),
      ];
      const counts = computeTypeCounts(cases);
      expect(counts[0]).toEqual({ type: 'grievance', count: 2 });
      expect(counts[1]).toEqual({ type: 'safety', count: 1 });
    });
  });

  describe('computeWorksiteCounts', () => {
    it('counts open cases by worksite', () => {
      const cases = [
        makeCase({ worksite: 'Site A', status: 'submitted' }),
        makeCase({ worksite: 'Site A', status: 'submitted' }),
        makeCase({ worksite: 'Site A', status: 'resolved' }),
      ];
      const counts = computeWorksiteCounts(cases);
      expect(counts[0]).toEqual({ worksite: 'Site A', count: 2 });
    });
  });

  describe('computeAssigneeCounts', () => {
    it('assigns null to Unassigned', () => {
      const cases = [makeCase({ assignee: null })];
      const counts = computeAssigneeCounts(cases);
      expect(counts[0].assignee).toBe('Unassigned');
    });
  });

  describe('filterCases', () => {
    it('filters by timeframe', () => {
      const cases = [
        makeCase({ createdAt: new Date('2026-03-25') }),
        makeCase({ createdAt: new Date('2025-01-01') }),
      ];
      const result = filterCases(cases, { timeframeDays: 30 }, now);
      expect(result).toHaveLength(1);
    });

    it('filters by status', () => {
      const cases = [
        makeCase({ status: 'submitted' }),
        makeCase({ status: 'resolved' }),
      ];
      const result = filterCases(cases, { status: 'submitted' }, now);
      expect(result).toHaveLength(1);
    });
  });

  describe('cachedComputation', () => {
    it('caches and returns same result', () => {
      let counter = 0;
      const fn = () => ++counter;
      const r1 = cachedComputation('key1', fn);
      const r2 = cachedComputation('key1', fn);
      expect(r1).toBe(r2);
      expect(counter).toBe(1);
    });
  });

  describe('SLA_THRESHOLDS', () => {
    it('has acknowledgement threshold of 2', () => {
      expect(SLA_THRESHOLDS.acknowledgement).toBe(2);
    });

    it('has resolution thresholds by priority', () => {
      expect(SLA_THRESHOLDS.resolution.critical).toBe(3);
      expect(SLA_THRESHOLDS.resolution.high).toBe(7);
    });
  });
});
