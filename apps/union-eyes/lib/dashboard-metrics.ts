/**
 * Dashboard Metrics — Leadership KPI Computation
 *
 * PR-050: Pure computation helpers for dashboard KPI cards,
 * queue aging buckets, and SLA overdue checks.
 *
 * All database access happens in the API route; these functions
 * operate on pre-fetched arrays so they are easily testable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaseRow {
  id: string;
  status: string;
  priority: string;
  type: string;
  assignee: string | null;
  worksite: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface KPICards {
  totalOpen: number;
  newThisWeek: number;
  overdueAcknowledgement: number;
  overdueResolution: number;
}

export interface AgingBucket {
  label: string;
  count: number;
}

export interface CategoryCount {
  type: string;
  count: number;
}

export interface WorksiteCount {
  worksite: string;
  count: number;
}

export interface AssigneeCount {
  assignee: string;
  count: number;
}

export interface ClosureTrendPoint {
  week: string;        // ISO date of week start (Monday)
  closedCount: number;
}

export interface CaseFilter {
  timeframeDays?: number;
  status?: string;
  worksite?: string;
}

// ---------------------------------------------------------------------------
// SLA thresholds (days)
// ---------------------------------------------------------------------------

export const SLA_THRESHOLDS = {
  /** Max days from creation to acknowledgement */
  acknowledgement: 2,
  /** Max days from creation to resolution by priority */
  resolution: {
    critical: 3,
    high: 7,
    medium: 14,
    low: 30,
  } as Record<string, number>,
} as const;

// ---------------------------------------------------------------------------
// Computation helpers
// ---------------------------------------------------------------------------

/**
 * Compute KPI cards from a set of cases.
 */
export function computeKPIs(cases: CaseRow[], now: Date = new Date()): KPICards {
  const openStatuses = new Set(['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation']);
  const openCases = cases.filter((c) => openStatuses.has(c.status));

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const newThisWeek = cases.filter((c) => c.createdAt >= weekAgo).length;

  let overdueAck = 0;
  let overdueRes = 0;
  for (const c of openCases) {
    const ageDays = daysBetween(c.createdAt, now);

    // Overdue acknowledgement: submitted > 2 days
    if (c.status === 'submitted' && ageDays > SLA_THRESHOLDS.acknowledgement) {
      overdueAck++;
    }

    // Overdue resolution: open > priority SLA
    const slaDays = SLA_THRESHOLDS.resolution[c.priority] ?? SLA_THRESHOLDS.resolution.low;
    if (ageDays > slaDays) {
      overdueRes++;
    }
  }

  return {
    totalOpen: openCases.length,
    newThisWeek,
    overdueAcknowledgement: overdueAck,
    overdueResolution: overdueRes,
  };
}

/**
 * Bucket open cases by age.
 */
export function computeAgingBuckets(cases: CaseRow[], now: Date = new Date()): AgingBucket[] {
  const openStatuses = new Set(['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation']);
  const openCases = cases.filter((c) => openStatuses.has(c.status));

  const buckets = [
    { label: '0–7 days', min: 0, max: 7, count: 0 },
    { label: '8–14 days', min: 8, max: 14, count: 0 },
    { label: '15–30 days', min: 15, max: 30, count: 0 },
    { label: '30+ days', min: 31, max: Infinity, count: 0 },
  ];

  for (const c of openCases) {
    const age = daysBetween(c.createdAt, now);
    for (const b of buckets) {
      if (age >= b.min && age <= b.max) {
        b.count++;
        break;
      }
    }
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}

/**
 * Count cases by type.
 */
export function computeTypeCounts(cases: CaseRow[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const c of cases) {
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Count open cases by worksite.
 */
export function computeWorksiteCounts(cases: CaseRow[]): WorksiteCount[] {
  const openStatuses = new Set(['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation']);
  const openCases = cases.filter((c) => openStatuses.has(c.status));
  const counts = new Map<string, number>();
  for (const c of openCases) {
    const ws = c.worksite ?? 'Unassigned';
    counts.set(ws, (counts.get(ws) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([worksite, count]) => ({ worksite, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Count open cases by assignee.
 */
export function computeAssigneeCounts(cases: CaseRow[]): AssigneeCount[] {
  const openStatuses = new Set(['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation']);
  const openCases = cases.filter((c) => openStatuses.has(c.status));
  const counts = new Map<string, number>();
  for (const c of openCases) {
    const assignee = c.assignee ?? 'Unassigned';
    counts.set(assignee, (counts.get(assignee) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([assignee, count]) => ({ assignee, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute weekly closure trends over the last N weeks.
 * Returns one data point per ISO week (Monday start).
 */
export function computeClosureTrends(
  cases: CaseRow[],
  weeks: number = 12,
  now: Date = new Date(),
): ClosureTrendPoint[] {
  const closedStatuses = new Set(['resolved', 'closed', 'denied']);
  const closedCases = cases.filter(
    (c) => closedStatuses.has(c.status) && c.resolvedAt != null,
  );

  // Build week buckets (Monday starts)
  const points: ClosureTrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const count = closedCases.filter(
      (c) => c.resolvedAt! >= weekStart && c.resolvedAt! < weekEnd,
    ).length;

    points.push({
      week: weekStart.toISOString().slice(0, 10),
      closedCount: count,
    });
  }
  return points;
}

/**
 * Filter cases by timeframe, status, and worksite.
 */
export function filterCases(
  cases: CaseRow[],
  filter: CaseFilter,
  now: Date = new Date(),
): CaseRow[] {
  let result = cases;

  if (filter.timeframeDays != null) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - filter.timeframeDays);
    result = result.filter((c) => c.createdAt >= cutoff);
  }

  if (filter.status) {
    result = result.filter((c) => c.status === filter.status);
  }

  if (filter.worksite) {
    result = result.filter((c) => c.worksite === filter.worksite);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ga-check:exempt — TTL cache, not primary persistence
const cache = new Map<string, CacheEntry<unknown>>();

/** Default TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Wrap a computation with a 5-minute TTL cache.
 * Key should uniquely identify the query (e.g. orgId + filter hash).
 */
export function cachedComputation<T>(
  key: string,
  compute: () => T,
  ttlMs: number = DEFAULT_TTL_MS,
): T {
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.data;
  }
  const data = compute();
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** Clear all cached entries (useful for testing). */
export function clearMetricsCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
