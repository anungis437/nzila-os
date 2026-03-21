/**
 * @nzila/zonga-growth — Creator Dashboard
 *
 * Real-time earnings, stream analytics, audience demographics,
 * event performance, and track-level breakdowns.
 *
 * Pure computation where possible. I/O through ports.
 *
 * @module @nzila/zonga-growth/creator-dashboard
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreatorOverview {
  readonly creatorId: string
  readonly totalStreams: number
  readonly uniqueListeners: number
  readonly totalRevenue: number
  readonly eventRevenue: number
  readonly followerCount: number
  readonly followerGrowth: number
  readonly periodStart: string
  readonly periodEnd: string
}

export interface TrackPerformance {
  readonly assetId: string
  readonly title: string
  readonly streams: number
  readonly uniqueListeners: number
  readonly revenue: number
  readonly avgCompletionPercent: number
  readonly skipRate: number
}

export interface AudienceGeo {
  readonly country: string
  readonly listenerCount: number
  readonly streamCount: number
  readonly revenueShare: number
}

export interface RevenueBreakdown {
  readonly streaming: number
  readonly events: number
  readonly merchandise: number
  readonly tips: number
  readonly total: number
}

export interface DashboardPeriod {
  readonly start: string
  readonly end: string
}

export interface EarningsTimeSeries {
  readonly date: string
  readonly amount: number
  readonly source: string
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface CreatorAnalyticsRepository {
  getOverview(
    orgId: string,
    creatorId: string,
    period: DashboardPeriod,
  ): Promise<CreatorOverview | null>

  getTrackPerformance(
    orgId: string,
    creatorId: string,
    period: DashboardPeriod,
    limit: number,
  ): Promise<readonly TrackPerformance[]>

  getAudienceGeo(
    orgId: string,
    creatorId: string,
    period: DashboardPeriod,
    limit: number,
  ): Promise<readonly AudienceGeo[]>

  getEarningsTimeSeries(
    orgId: string,
    creatorId: string,
    period: DashboardPeriod,
    granularity: 'day' | 'week' | 'month',
  ): Promise<readonly EarningsTimeSeries[]>

  getFollowerGrowthTimeSeries(
    orgId: string,
    creatorId: string,
    period: DashboardPeriod,
    granularity: 'day' | 'week' | 'month',
  ): Promise<readonly { date: string; count: number }[]>
}

// ── Pure Helpers ────────────────────────────────────────────────────────────

/** Computes revenue breakdown from an overview. */
export function computeRevenueBreakdown(
  overview: CreatorOverview,
): RevenueBreakdown {
  const streaming = overview.totalRevenue - overview.eventRevenue
  return {
    streaming: Math.max(streaming, 0),
    events: overview.eventRevenue,
    merchandise: 0, // future: from merch table
    tips: 0, // future: from tips table
    total: overview.totalRevenue,
  }
}

/** Computes per-stream revenue for a creator. */
export function computePerStreamRevenue(
  totalRevenue: number,
  totalStreams: number,
): number {
  if (totalStreams <= 0) return 0
  return totalRevenue / totalStreams
}

/** Identifies top performing tracks by revenue. */
export function rankTracksByRevenue(
  tracks: readonly TrackPerformance[],
): readonly TrackPerformance[] {
  return [...tracks].sort((a, b) => b.revenue - a.revenue)
}

/** Identifies tracks with high skip rates (engagement signal). */
export function identifyHighSkipTracks(
  tracks: readonly TrackPerformance[],
  threshold: number = 0.4,
): readonly TrackPerformance[] {
  return tracks.filter((t) => t.skipRate > threshold)
}

/** Validates a dashboard period. */
export function validateDashboardPeriod(
  period: DashboardPeriod,
): { valid: boolean; error?: string } {
  const start = new Date(period.start)
  const end = new Date(period.end)
  if (isNaN(start.getTime())) return { valid: false, error: 'Invalid start date' }
  if (isNaN(end.getTime())) return { valid: false, error: 'Invalid end date' }
  if (start >= end) return { valid: false, error: 'Start must be before end' }

  const maxRangeMs = 365 * 24 * 60 * 60 * 1000 // 1 year
  if (end.getTime() - start.getTime() > maxRangeMs) {
    return { valid: false, error: 'Period cannot exceed 1 year' }
  }

  return { valid: true }
}

// ── Dashboard Service ───────────────────────────────────────────────────────

export function createCreatorDashboardService(deps: {
  analytics: CreatorAnalyticsRepository
}) {
  const { analytics } = deps

  return {
    /**
     * Full dashboard snapshot — overview + top tracks + geo + revenue breakdown.
     */
    async getDashboard(params: {
      orgId: string
      creatorId: string
      period: DashboardPeriod
    }): Promise<{
      overview: CreatorOverview
      revenueBreakdown: RevenueBreakdown
      topTracks: readonly TrackPerformance[]
      audienceGeo: readonly AudienceGeo[]
      perStreamRevenue: number
    }> {
      const check = validateDashboardPeriod(params.period)
      if (!check.valid) throw new Error(check.error)

      const [overview, topTracks, audienceGeo] = await Promise.all([
        analytics.getOverview(params.orgId, params.creatorId, params.period),
        analytics.getTrackPerformance(params.orgId, params.creatorId, params.period, 20),
        analytics.getAudienceGeo(params.orgId, params.creatorId, params.period, 30),
      ])

      if (!overview) {
        throw new Error(`No analytics data for creator: ${params.creatorId}`)
      }

      return {
        overview,
        revenueBreakdown: computeRevenueBreakdown(overview),
        topTracks: rankTracksByRevenue(topTracks),
        audienceGeo,
        perStreamRevenue: computePerStreamRevenue(
          overview.totalRevenue,
          overview.totalStreams,
        ),
      }
    },

    /**
     * Earnings time series for charting.
     */
    async getEarningsChart(params: {
      orgId: string
      creatorId: string
      period: DashboardPeriod
      granularity?: 'day' | 'week' | 'month'
    }): Promise<readonly EarningsTimeSeries[]> {
      const check = validateDashboardPeriod(params.period)
      if (!check.valid) throw new Error(check.error)

      return analytics.getEarningsTimeSeries(
        params.orgId,
        params.creatorId,
        params.period,
        params.granularity ?? 'day',
      )
    },

    /**
     * Track-level detail for a specific content asset.
     */
    async getTrackDetail(params: {
      orgId: string
      creatorId: string
      period: DashboardPeriod
    }): Promise<{
      tracks: readonly TrackPerformance[]
      highSkipTracks: readonly TrackPerformance[]
    }> {
      const check = validateDashboardPeriod(params.period)
      if (!check.valid) throw new Error(check.error)

      const tracks = await analytics.getTrackPerformance(
        params.orgId,
        params.creatorId,
        params.period,
        100,
      )

      return {
        tracks: rankTracksByRevenue(tracks),
        highSkipTracks: identifyHighSkipTracks(tracks),
      }
    },

    /**
     * Follower growth over time.
     */
    async getFollowerGrowth(params: {
      orgId: string
      creatorId: string
      period: DashboardPeriod
      granularity?: 'day' | 'week' | 'month'
    }): Promise<readonly { date: string; count: number }[]> {
      const check = validateDashboardPeriod(params.period)
      if (!check.valid) throw new Error(check.error)

      return analytics.getFollowerGrowthTimeSeries(
        params.orgId,
        params.creatorId,
        params.period,
        params.granularity ?? 'day',
      )
    },
  }
}
