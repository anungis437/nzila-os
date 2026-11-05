/**
 * Usage Metering
 *
 * Per-org resource consumption tracking.
 * Records usage events and aggregates by period for
 * quota enforcement, billing, and FinOps analysis.
 *
 * Invariant: Every usage record is org-scoped.
 */

import { z } from 'zod';

// ── Types ─────────────────────────────────────────────────────────────────────

export const UsageRecordSchema = z.object({
  orgId: z.string().min(1),
  resource: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  timestamp: z.string().datetime(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type UsageRecord = z.infer<typeof UsageRecordSchema>;

export interface AggregatedUsage {
  orgId: string;
  resource: string;
  totalQuantity: number;
  unit: string;
  recordCount: number;
  periodStart: string;
  periodEnd: string;
  peakQuantity: number;
  avgQuantity: number;
}

export interface UsageMeter {
  record(event: UsageRecord): void;
  getRecords(orgId: string, resource?: string): UsageRecord[];
  flush(): UsageRecord[];
}

// ── Meter Implementation ──────────────────────────────────────────────────────

/**
 * Create an in-memory usage meter for recording resource consumption.
 *
 * In production, this would flush to a durable store (PostgreSQL / Azure Table).
 * The in-memory buffer is suitable for batching and local testing.
 */
export function createUsageMeter(): UsageMeter {
  const buffer: UsageRecord[] = [];

  return {
    record(event: UsageRecord): void {
      const validated = UsageRecordSchema.parse(event);
      buffer.push(validated);
    },

    getRecords(orgId: string, resource?: string): UsageRecord[] {
      return buffer.filter(
        (r) => r.orgId === orgId && (resource == null || r.resource === resource),
      );
    },

    flush(): UsageRecord[] {
      const records = [...buffer];
      buffer.length = 0;
      return records;
    },
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregate usage records by org + resource for a given time window.
 */
export function aggregateUsage(
  records: UsageRecord[],
  periodStart: string,
  periodEnd: string,
): AggregatedUsage[] {
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();

  // Filter to period
  const inPeriod = records.filter((r) => {
    const ts = new Date(r.timestamp).getTime();
    return ts >= startMs && ts <= endMs;
  });

  // Group by orgId + resource
  const groups = new Map<string, UsageRecord[]>();
  for (const record of inPeriod) {
    const key = `${record.orgId}:${record.resource}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  // Aggregate each group
  const results: AggregatedUsage[] = [];
  for (const [, group] of groups) {
    const first = group[0]!;
    const quantities = group.map((r) => r.quantity);
    const total = quantities.reduce((sum, q) => sum + q, 0);

    results.push({
      orgId: first.orgId,
      resource: first.resource,
      totalQuantity: total,
      unit: first.unit,
      recordCount: group.length,
      periodStart,
      periodEnd,
      peakQuantity: Math.max(...quantities),
      avgQuantity: total / group.length,
    });
  }

  return results.sort((a, b) => b.totalQuantity - a.totalQuantity);
}
