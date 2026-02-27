/**
 * Nzila OS — Performance Metrics Engine
 *
 * Tracks per-request latency/status and computes P50/P95/P99
 * percentile envelopes. All data from platform_request_metrics table.
 *
 * @module @nzila/platform-performance
 */
import { platformDb } from '@nzila/db/platform'
import { platformRequestMetrics } from '@nzila/db/schema'
import { eq, and, gte } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

export interface RequestMetric {
  route: string
  orgId: string
  latencyMs: number
  statusCode: number
  timestamp?: Date
}

export interface PerformanceEnvelope {
  /** Median latency */
  p50: number
  /** 95th percentile latency */
  p95: number
  /** 99th percentile latency */
  p99: number
  /** Error rate as percentage (0-100) */
  errorRate: number
  /** Requests per minute */
  throughput: number
  /** Breakdown by app/route */
  perApp: AppThroughput[]
  /** Total data points in window */
  sampleSize: number
}

export interface AppThroughput {
  route: string
  requestCount: number
  avgLatencyMs: number
  errorRate: number
}

// ── Track ───────────────────────────────────────────────────────────────────

/**
 * Persist a single request metric to the platform_request_metrics table.
 *
 * No secrets are stored — only route, orgId, latency, status, and timestamp.
 */
export async function trackRequestMetrics(metric: RequestMetric): Promise<void> {
  await platformDb.insert(platformRequestMetrics).values({
    route: metric.route,
    entityId: metric.orgId,
    latencyMs: metric.latencyMs,
    statusCode: metric.statusCode,
    recordedAt: metric.timestamp ?? new Date(),
  })
}

// ── Query — Org-scoped ──────────────────────────────────────────────────────

/**
 * Compute performance envelope for a single org.
 * Org-scoped visibility — no cross-org data leakage.
 */
export async function getPerformanceEnvelope(
  orgId: string,
  options?: { windowMinutes?: number },
): Promise<PerformanceEnvelope> {
  const windowMinutes = options?.windowMinutes ?? 60
  const windowStart = new Date(Date.now() - windowMinutes * 60_000)

  const rows = await platformDb
    .select({
      route: platformRequestMetrics.route,
      latencyMs: platformRequestMetrics.latencyMs,
      statusCode: platformRequestMetrics.statusCode,
      recordedAt: platformRequestMetrics.recordedAt,
    })
    .from(platformRequestMetrics)
    .where(
      and(
        eq(platformRequestMetrics.entityId, orgId),
        gte(platformRequestMetrics.recordedAt, windowStart),
      ),
    )
    .orderBy(platformRequestMetrics.latencyMs)

  return computeEnvelope(rows, windowMinutes)
}

// ── Query — Global (platform admin) ────────────────────────────────────────

/**
 * Compute global performance envelope across all orgs.
 * Platform admin global view.
 */
export async function getGlobalPerformanceEnvelope(
  options?: { windowMinutes?: number },
): Promise<PerformanceEnvelope> {
  const windowMinutes = options?.windowMinutes ?? 60
  const windowStart = new Date(Date.now() - windowMinutes * 60_000)

  const rows = await platformDb
    .select({
      route: platformRequestMetrics.route,
      latencyMs: platformRequestMetrics.latencyMs,
      statusCode: platformRequestMetrics.statusCode,
      recordedAt: platformRequestMetrics.recordedAt,
    })
    .from(platformRequestMetrics)
    .where(gte(platformRequestMetrics.recordedAt, windowStart))
    .orderBy(platformRequestMetrics.latencyMs)

  return computeEnvelope(rows, windowMinutes)
}

// ── Percentile computation ──────────────────────────────────────────────────

interface MetricRow {
  route: string
  latencyMs: number
  statusCode: number
  recordedAt: Date
}

/**
 * Pure computation — deterministic percentile + throughput calculation.
 * Exported for unit testing.
 */
export function computeEnvelope(
  rows: MetricRow[],
  windowMinutes: number,
): PerformanceEnvelope {
  if (rows.length === 0) {
    return {
      p50: 0, p95: 0, p99: 0,
      errorRate: 0, throughput: 0,
      perApp: [], sampleSize: 0,
    }
  }

  const sorted = [...rows].sort((a, b) => a.latencyMs - b.latencyMs)
  const latencies = sorted.map((r) => r.latencyMs)

  const p50 = percentile(latencies, 50)
  const p95 = percentile(latencies, 95)
  const p99 = percentile(latencies, 99)

  const errors = rows.filter((r) => r.statusCode >= 400).length
  const errorRate = (errors / rows.length) * 100
  const throughput = rows.length / Math.max(windowMinutes, 1)

  // Per-app breakdown
  const routeMap = new Map<string, { count: number; totalLatency: number; errors: number }>()
  for (const row of rows) {
    const entry = routeMap.get(row.route) ?? { count: 0, totalLatency: 0, errors: 0 }
    entry.count++
    entry.totalLatency += row.latencyMs
    if (row.statusCode >= 400) entry.errors++
    routeMap.set(row.route, entry)
  }

  const perApp: AppThroughput[] = Array.from(routeMap.entries()).map(([route, data]) => ({
    route,
    requestCount: data.count,
    avgLatencyMs: Math.round(data.totalLatency / data.count),
    errorRate: (data.errors / data.count) * 100,
  }))

  return {
    p50, p95, p99,
    errorRate: Math.round(errorRate * 100) / 100,
    throughput: Math.round(throughput * 100) / 100,
    perApp,
    sampleSize: rows.length,
  }
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((pct / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}
