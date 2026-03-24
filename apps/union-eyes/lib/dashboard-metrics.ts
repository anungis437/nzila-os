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

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
