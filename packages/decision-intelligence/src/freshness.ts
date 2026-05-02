/**
 * Freshness SLA utilities for the decision aggregate materialization pipeline.
 *
 * SLA thresholds:
 *   warning  — lag >= 1 hour
 *   breached — lag >= 2 hours (default; overridable per call-site)
 */

export const FRESHNESS_WARNING_THRESHOLD_MS = 3_600_000 // 1 hour
export const FRESHNESS_BREACH_THRESHOLD_MS = 7_200_000 // 2 hours

export type FreshnessStatus = 'healthy' | 'warning' | 'breached'

/**
 * Computes the lag between the most recent audit record ingested and the
 * latest window that has been materialised into decision_aggregates.
 *
 * A positive lag means there are audit records newer than the newest aggregate
 * window end — i.e. data that has not yet been rolled up.
 */
export function computeFreshnessLag({
  latestAuditRecordAt,
  latestAggregateWindowEnd,
}: {
  latestAuditRecordAt: Date
  latestAggregateWindowEnd: Date
}): { lagMs: number } {
  const lagMs = Math.max(0, latestAuditRecordAt.getTime() - latestAggregateWindowEnd.getTime())
  return { lagMs }
}

/**
 * Maps a freshness lag value to a three-level SLA status.
 *
 * @param lagMs       — milliseconds computed by `computeFreshnessLag`
 * @param thresholdMs — breach threshold in ms (default 2 hours)
 */
export function evaluateFreshnessSla({
  lagMs,
  thresholdMs = FRESHNESS_BREACH_THRESHOLD_MS,
}: {
  lagMs: number
  thresholdMs?: number
}): { status: FreshnessStatus } {
  if (lagMs >= thresholdMs) return { status: 'breached' }
  if (lagMs >= FRESHNESS_WARNING_THRESHOLD_MS) return { status: 'warning' }
  return { status: 'healthy' }
}
