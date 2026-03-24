/**
 * Tests for dashboard metrics computation
 *
 * PR-050: Validates KPI cards, aging buckets, and type counts.
 * Pure computation — no DB dependencies.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors of types + logic from dashboard-metrics.ts
// ---------------------------------------------------------------------------

interface CaseRow {
  id: string; status: string; priority: string; type: string;
  assignee: string | null; worksite: string | null;
  createdAt: Date; resolvedAt: Date | null;
}

interface KPICards {
  totalOpen: number; newThisWeek: number;
  overdueAcknowledgement: number; overdueResolution: number;
}

interface AgingBucket { label: string; count: number; }
interface CategoryCount { type: string; count: number; }

const SLA_THRESHOLDS = {
  acknowledgement: 2,
  resolution: { critical: 3, high: 7, medium: 14, low: 30 } as Record<string, number>,
};

const openStatuses = new Set(['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation']);

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function computeKPIs(cases: CaseRow[], now: Date = new Date()): KPICards {
  const openCases = cases.filter((c) => openStatuses.has(c.status));
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const newThisWeek = cases.filter((c) => c.createdAt >= weekAgo).length;
  let overdueAck = 0, overdueRes = 0;
  for (const c of openCases) {
    const age = daysBetween(c.createdAt, now);
    if (c.status === 'submitted' && age > SLA_THRESHOLDS.acknowledgement) overdueAck++;
    const sla = SLA_THRESHOLDS.resolution[c.priority] ?? SLA_THRESHOLDS.resolution.low;
    if (age > sla) overdueRes++;
  }
  return { totalOpen: openCases.length, newThisWeek, overdueAcknowledgement: overdueAck, overdueResolution: overdueRes };
}

function computeAgingBuckets(cases: CaseRow[], now: Date = new Date()): AgingBucket[] {
  const openCases = cases.filter((c) => openStatuses.has(c.status));
  const buckets = [
    { label: '0–7 days', min: 0, max: 7, count: 0 },
    { label: '8–14 days', min: 8, max: 14, count: 0 },
    { label: '15–30 days', min: 15, max: 30, count: 0 },
    { label: '30+ days', min: 31, max: Infinity, count: 0 },
  ];
  for (const c of openCases) {
    const age = daysBetween(c.createdAt, now);
    for (const b of buckets) { if (age >= b.min && age <= b.max) { b.count++; break; } }
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

function computeTypeCounts(cases: CaseRow[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const c of cases) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2025-06-15T12:00:00Z');

function makeCase(overrides: Partial<CaseRow> & { id: string }): CaseRow {
  return {
    status: 'submitted', priority: 'medium', type: 'workplace_safety',
    assignee: null, worksite: 'Site A', createdAt: new Date('2025-06-01'),
    resolvedAt: null, ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KPI Cards', () => {
  it('counts open cases (excludes resolved/rejected/closed)', () => {
    const cases = [
      makeCase({ id: '1', status: 'submitted' }),
      makeCase({ id: '2', status: 'investigation' }),
      makeCase({ id: '3', status: 'resolved' }),
      makeCase({ id: '4', status: 'closed' }),
    ];
    expect(computeKPIs(cases, NOW).totalOpen).toBe(2);
  });

  it('counts new cases this week', () => {
    const cases = [
      makeCase({ id: '1', createdAt: new Date('2025-06-14') }), // 1 day ago
      makeCase({ id: '2', createdAt: new Date('2025-06-10') }), // 5 days ago
      makeCase({ id: '3', createdAt: new Date('2025-06-01') }), // 14 days ago
    ];
    expect(computeKPIs(cases, NOW).newThisWeek).toBe(2);
  });

  it('detects overdue acknowledgement (submitted > 2 days)', () => {
    const cases = [
      makeCase({ id: '1', status: 'submitted', createdAt: new Date('2025-06-12') }), // 3 days
      makeCase({ id: '2', status: 'submitted', createdAt: new Date('2025-06-14') }), // 1 day
      makeCase({ id: '3', status: 'under_review', createdAt: new Date('2025-06-01') }), // not submitted
    ];
    expect(computeKPIs(cases, NOW).overdueAcknowledgement).toBe(1);
  });

  it('detects overdue resolution by priority SLA', () => {
    const cases = [
      makeCase({ id: '1', priority: 'critical', createdAt: new Date('2025-06-10') }), // 5 days > 3
      makeCase({ id: '2', priority: 'high', createdAt: new Date('2025-06-01') }),      // 14 days > 7
      makeCase({ id: '3', priority: 'medium', createdAt: new Date('2025-06-14') }),     // 1 day < 14
    ];
    expect(computeKPIs(cases, NOW).overdueResolution).toBe(2);
  });

  it('returns zeros for empty case list', () => {
    const kpis = computeKPIs([], NOW);
    expect(kpis.totalOpen).toBe(0);
    expect(kpis.newThisWeek).toBe(0);
    expect(kpis.overdueAcknowledgement).toBe(0);
    expect(kpis.overdueResolution).toBe(0);
  });
});

describe('Aging Buckets', () => {
  it('returns 4 buckets', () => {
    expect(computeAgingBuckets([], NOW)).toHaveLength(4);
  });

  it('correctly buckets cases by age', () => {
    const cases = [
      makeCase({ id: '1', createdAt: new Date('2025-06-14') }), // 1 day → 0-7
      makeCase({ id: '2', createdAt: new Date('2025-06-05') }), // 10 days → 8-14
      makeCase({ id: '3', createdAt: new Date('2025-05-25') }), // 21 days → 15-30
      makeCase({ id: '4', createdAt: new Date('2025-05-01') }), // 45 days → 30+
    ];
    const buckets = computeAgingBuckets(cases, NOW);
    expect(buckets[0].count).toBe(1); // 0-7
    expect(buckets[1].count).toBe(1); // 8-14
    expect(buckets[2].count).toBe(1); // 15-30
    expect(buckets[3].count).toBe(1); // 30+
  });

  it('excludes closed cases from aging', () => {
    const cases = [
      makeCase({ id: '1', status: 'submitted', createdAt: new Date('2025-06-14') }),
      makeCase({ id: '2', status: 'closed', createdAt: new Date('2025-05-01') }),
    ];
    const total = computeAgingBuckets(cases, NOW).reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
  });
});

describe('Type Counts', () => {
  it('counts cases by type', () => {
    const cases = [
      makeCase({ id: '1', type: 'workplace_safety' }),
      makeCase({ id: '2', type: 'workplace_safety' }),
      makeCase({ id: '3', type: 'discrimination' }),
    ];
    const counts = computeTypeCounts(cases);
    expect(counts[0]).toEqual({ type: 'workplace_safety', count: 2 });
    expect(counts[1]).toEqual({ type: 'discrimination', count: 1 });
  });

  it('sorts by count descending', () => {
    const cases = [
      makeCase({ id: '1', type: 'a' }),
      makeCase({ id: '2', type: 'b' }),
      makeCase({ id: '3', type: 'b' }),
      makeCase({ id: '4', type: 'c' }),
      makeCase({ id: '5', type: 'c' }),
      makeCase({ id: '6', type: 'c' }),
    ];
    const counts = computeTypeCounts(cases);
    expect(counts[0].type).toBe('c');
    expect(counts[1].type).toBe('b');
    expect(counts[2].type).toBe('a');
  });

  it('returns empty array for no cases', () => {
    expect(computeTypeCounts([])).toEqual([]);
  });
});

describe('SLA Thresholds', () => {
  it('acknowledgement threshold is 2 days', () => {
    expect(SLA_THRESHOLDS.acknowledgement).toBe(2);
  });

  it('has resolution thresholds for all priorities', () => {
    expect(SLA_THRESHOLDS.resolution.critical).toBe(3);
    expect(SLA_THRESHOLDS.resolution.high).toBe(7);
    expect(SLA_THRESHOLDS.resolution.medium).toBe(14);
    expect(SLA_THRESHOLDS.resolution.low).toBe(30);
  });
});
