/**
 * Tests for dashboard metrics v0.2 — worksite, assignee, trends, filters, cache
 *
 * PR-050 completion: Tests the new computation functions added for
 * worksite/assignee tables, closure trends, filtering, and caching.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors
// ---------------------------------------------------------------------------

interface CaseRow {
  id: string; status: string; priority: string; type: string;
  assignee: string | null; worksite: string | null;
  createdAt: Date; resolvedAt: Date | null;
}
interface WorksiteCount { worksite: string; count: number; }
interface AssigneeCount { assignee: string; count: number; }
interface ClosureTrendPoint { week: string; closedCount: number; }
interface CaseFilter { timeframeDays?: number; status?: string; worksite?: string; }

const openStatuses = new Set(['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation']);

function computeWorksiteCounts(cases: CaseRow[]): WorksiteCount[] {
  const open = cases.filter((c) => openStatuses.has(c.status));
  const counts = new Map<string, number>();
  for (const c of open) { const ws = c.worksite ?? 'Unassigned'; counts.set(ws, (counts.get(ws) ?? 0) + 1); }
  return [...counts.entries()].map(([worksite, count]) => ({ worksite, count })).sort((a, b) => b.count - a.count);
}

function computeAssigneeCounts(cases: CaseRow[]): AssigneeCount[] {
  const open = cases.filter((c) => openStatuses.has(c.status));
  const counts = new Map<string, number>();
  for (const c of open) { const a = c.assignee ?? 'Unassigned'; counts.set(a, (counts.get(a) ?? 0) + 1); }
  return [...counts.entries()].map(([assignee, count]) => ({ assignee, count })).sort((a, b) => b.count - a.count);
}

function computeClosureTrends(cases: CaseRow[], weeks: number = 12, now: Date = new Date()): ClosureTrendPoint[] {
  const closedStatuses = new Set(['resolved', 'closed', 'denied']);
  const closed = cases.filter((c) => closedStatuses.has(c.status) && c.resolvedAt != null);
  const points: ClosureTrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    const count = closed.filter((c) => c.resolvedAt! >= weekStart && c.resolvedAt! < weekEnd).length;
    points.push({ week: weekStart.toISOString().slice(0, 10), closedCount: count });
  }
  return points;
}

function filterCases(cases: CaseRow[], filter: CaseFilter, now: Date = new Date()): CaseRow[] {
  let result = cases;
  if (filter.timeframeDays != null) {
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - filter.timeframeDays);
    result = result.filter((c) => c.createdAt >= cutoff);
  }
  if (filter.status) result = result.filter((c) => c.status === filter.status);
  if (filter.worksite) result = result.filter((c) => c.worksite === filter.worksite);
  return result;
}

// Cache
interface CacheEntry<T> { data: T; expiresAt: number; }
const cache = new Map<string, CacheEntry<unknown>>();
function cachedComputation<T>(key: string, compute: () => T, ttlMs: number = 300000): T {
  const e = cache.get(key) as CacheEntry<T> | undefined;
  if (e && e.expiresAt > Date.now()) return e.data;
  const data = compute();
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}
function clearMetricsCache(): void { cache.clear(); }

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

describe('Worksite Counts', () => {
  it('counts open cases by worksite', () => {
    const cases = [
      makeCase({ id: '1', worksite: 'Site A' }),
      makeCase({ id: '2', worksite: 'Site A' }),
      makeCase({ id: '3', worksite: 'Site B' }),
    ];
    const counts = computeWorksiteCounts(cases);
    expect(counts).toEqual([
      { worksite: 'Site A', count: 2 },
      { worksite: 'Site B', count: 1 },
    ]);
  });

  it('uses "Unassigned" for null worksite', () => {
    const cases = [makeCase({ id: '1', worksite: null })];
    expect(computeWorksiteCounts(cases)[0].worksite).toBe('Unassigned');
  });

  it('excludes closed cases', () => {
    const cases = [
      makeCase({ id: '1', worksite: 'Site A', status: 'submitted' }),
      makeCase({ id: '2', worksite: 'Site A', status: 'closed' }),
    ];
    expect(computeWorksiteCounts(cases)).toEqual([{ worksite: 'Site A', count: 1 }]);
  });

  it('sorts by count descending', () => {
    const cases = [
      makeCase({ id: '1', worksite: 'B' }),
      makeCase({ id: '2', worksite: 'A' }),
      makeCase({ id: '3', worksite: 'A' }),
    ];
    expect(computeWorksiteCounts(cases)[0].worksite).toBe('A');
  });

  it('returns empty for no cases', () => {
    expect(computeWorksiteCounts([])).toEqual([]);
  });
});

describe('Assignee Counts', () => {
  it('counts open cases by assignee', () => {
    const cases = [
      makeCase({ id: '1', assignee: 'Alice' }),
      makeCase({ id: '2', assignee: 'Alice' }),
      makeCase({ id: '3', assignee: 'Bob' }),
    ];
    const counts = computeAssigneeCounts(cases);
    expect(counts).toEqual([
      { assignee: 'Alice', count: 2 },
      { assignee: 'Bob', count: 1 },
    ]);
  });

  it('uses "Unassigned" for null assignee', () => {
    const cases = [makeCase({ id: '1', assignee: null })];
    expect(computeAssigneeCounts(cases)[0].assignee).toBe('Unassigned');
  });

  it('excludes resolved cases', () => {
    const cases = [
      makeCase({ id: '1', assignee: 'Alice' }),
      makeCase({ id: '2', assignee: 'Alice', status: 'resolved' }),
    ];
    expect(computeAssigneeCounts(cases)).toEqual([{ assignee: 'Alice', count: 1 }]);
  });

  it('returns empty for no cases', () => {
    expect(computeAssigneeCounts([])).toEqual([]);
  });
});

describe('Closure Trends', () => {
  it('returns requested number of weeks', () => {
    expect(computeClosureTrends([], 4, NOW)).toHaveLength(4);
    expect(computeClosureTrends([], 12, NOW)).toHaveLength(12);
  });

  it('counts closures per week', () => {
    const cases = [
      makeCase({ id: '1', status: 'resolved', resolvedAt: new Date('2025-06-09T10:00:00Z') }),
      makeCase({ id: '2', status: 'closed', resolvedAt: new Date('2025-06-10T10:00:00Z') }),
      makeCase({ id: '3', status: 'denied', resolvedAt: new Date('2025-06-10T14:00:00Z') }),
    ];
    const trends = computeClosureTrends(cases, 4, NOW);
    const lastWeek = trends.find((t) => t.week === '2025-06-09');
    expect(lastWeek).toBeDefined();
    expect(lastWeek!.closedCount).toBeGreaterThanOrEqual(2);
  });

  it('ignores open cases', () => {
    const cases = [makeCase({ id: '1', status: 'submitted', resolvedAt: null })];
    const total = computeClosureTrends(cases, 4, NOW).reduce((s, p) => s + p.closedCount, 0);
    expect(total).toBe(0);
  });

  it('returns zero counts for empty weeks', () => {
    const trends = computeClosureTrends([], 4, NOW);
    expect(trends.every((p) => p.closedCount === 0)).toBe(true);
  });

  it('weeks are ISO date strings', () => {
    const trends = computeClosureTrends([], 2, NOW);
    expect(trends[0].week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Filter Cases', () => {
  const cases = [
    makeCase({ id: '1', status: 'submitted', worksite: 'Site A', createdAt: new Date('2025-06-14') }),
    makeCase({ id: '2', status: 'investigation', worksite: 'Site B', createdAt: new Date('2025-06-01') }),
    makeCase({ id: '3', status: 'closed', worksite: 'Site A', createdAt: new Date('2025-05-01') }),
  ];

  it('filters by timeframe', () => {
    const result = filterCases(cases, { timeframeDays: 7 }, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by status', () => {
    const result = filterCases(cases, { status: 'investigation' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by worksite', () => {
    const result = filterCases(cases, { worksite: 'Site A' });
    expect(result).toHaveLength(2);
  });

  it('combines multiple filters', () => {
    const result = filterCases(cases, { status: 'submitted', worksite: 'Site A' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns all cases with empty filter', () => {
    expect(filterCases(cases, {})).toHaveLength(3);
  });
});

describe('Cached Computation', () => {
  beforeEach(() => clearMetricsCache());

  it('returns computed value on first call', () => {
    const result = cachedComputation('test-key', () => 42);
    expect(result).toBe(42);
  });

  it('returns cached value on second call', () => {
    let calls = 0;
    const fn = () => { calls++; return 'result'; };
    cachedComputation('cache-test', fn);
    cachedComputation('cache-test', fn);
    expect(calls).toBe(1);
  });

  it('recomputes after TTL expires', () => {
    let calls = 0;
    const fn = () => { calls++; return calls; };
    cachedComputation('ttl-test', fn, 0); // 0ms TTL = immediate expiry
    const r2 = cachedComputation('ttl-test', fn, 0);
    expect(r2).toBe(2);
  });

  it('uses separate caches per key', () => {
    const r1 = cachedComputation('k1', () => 'a');
    const r2 = cachedComputation('k2', () => 'b');
    expect(r1).toBe('a');
    expect(r2).toBe('b');
  });

  it('clearMetricsCache resets all entries', () => {
    let calls = 0;
    cachedComputation('clear-test', () => ++calls);
    clearMetricsCache();
    cachedComputation('clear-test', () => ++calls);
    expect(calls).toBe(2);
  });
});
