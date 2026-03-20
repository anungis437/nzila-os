/**
 * @nzila/zonga-intelligence — Creator Insights Engine
 *
 * Aggregates creator performance metrics, audience segments,
 * and revenue breakdowns for the creator dashboard.
 */
import type { CreatorInsight, AudienceSegment, CreatorDashboard } from './types'

// ── Types ─────────────────────────────────────────────────────────────────

export interface MetricDataPoint {
  readonly metric: string
  readonly currentValue: number
  readonly previousValue: number
  readonly period: string
}

export interface RevenueEntry {
  readonly source: string
  readonly amount: number
}

export interface TrackPerformance {
  readonly trackId: string
  readonly streams: number
  readonly revenue: number
}

// ── Insight Computation ───────────────────────────────────────────────────

/**
 * Compute trend insights from metric data points.
 */
export function computeInsights(
  artistId: string,
  metrics: readonly MetricDataPoint[],
): CreatorInsight[] {
  return metrics.map((m) => {
    const change = m.previousValue > 0
      ? ((m.currentValue - m.previousValue) / m.previousValue) * 100
      : m.currentValue > 0
        ? 100
        : 0

    const percentChange = Math.round(change * 100) / 100
    let trend: 'rising' | 'stable' | 'declining'
    if (percentChange > 5) trend = 'rising'
    else if (percentChange < -5) trend = 'declining'
    else trend = 'stable'

    return {
      artistId,
      metric: m.metric,
      value: m.currentValue,
      trend,
      percentChange,
      period: m.period,
      comparison: `vs. previous ${m.period}`,
    }
  })
}

/**
 * Build a revenue breakdown from individual entries.
 */
export function buildRevenueBreakdown(
  entries: readonly RevenueEntry[],
): Record<string, number> {
  const breakdown: Record<string, number> = {}
  for (const entry of entries) {
    breakdown[entry.source] = (breakdown[entry.source] ?? 0) + entry.amount
  }
  // Round all values
  for (const key of Object.keys(breakdown)) {
    breakdown[key] = Math.round(breakdown[key]! * 100) / 100
  }
  return breakdown
}

/**
 * Build a complete creator dashboard from raw data.
 */
export function buildCreatorDashboard(
  artistId: string,
  metrics: readonly MetricDataPoint[],
  segments: readonly AudienceSegment[],
  tracks: readonly TrackPerformance[],
  revenue: readonly RevenueEntry[],
): CreatorDashboard {
  const insights = computeInsights(artistId, metrics)
  const revenueBreakdown = buildRevenueBreakdown(revenue)

  const topTracks = [...tracks]
    .sort((a, b) => b.streams - a.streams)
    .slice(0, 10)
    .map((t) => ({
      trackId: t.trackId,
      streams: t.streams,
      revenue: t.revenue,
    }))

  return {
    artistId,
    generatedAt: new Date(),
    insights,
    audienceSegments: [...segments],
    topTracks,
    revenueBreakdown,
  }
}
