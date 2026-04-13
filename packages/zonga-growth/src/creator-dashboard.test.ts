import { describe, it, expect, vi } from 'vitest'
import {
  computeRevenueBreakdown,
  computePerStreamRevenue,
  rankTracksByRevenue,
  identifyHighSkipTracks,
  validateDashboardPeriod,
  createCreatorDashboardService,
} from './creator-dashboard'
import type { CreatorOverview, TrackPerformance, DashboardPeriod } from './creator-dashboard'

function makeOverview(overrides: Partial<CreatorOverview> = {}): CreatorOverview {
  return {
    creatorId: 'c1',
    totalStreams: 10_000,
    uniqueListeners: 5_000,
    totalRevenue: 500,
    eventRevenue: 100,
    followerCount: 2000,
    followerGrowth: 50,
    periodStart: '2025-01-01',
    periodEnd: '2025-01-31',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<TrackPerformance> = {}): TrackPerformance {
  return {
    assetId: 'a1',
    title: 'Track 1',
    streams: 1000,
    uniqueListeners: 500,
    revenue: 50,
    avgCompletionPercent: 80,
    skipRate: 0.2,
    ...overrides,
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('computeRevenueBreakdown', () => {
  it('splits streaming and event revenue', () => {
    const result = computeRevenueBreakdown(makeOverview({ totalRevenue: 500, eventRevenue: 100 }))
    expect(result.streaming).toBe(400)
    expect(result.events).toBe(100)
    expect(result.total).toBe(500)
    expect(result.merchandise).toBe(0)
    expect(result.tips).toBe(0)
  })

  it('clamps streaming to 0 when event revenue exceeds total', () => {
    const result = computeRevenueBreakdown(makeOverview({ totalRevenue: 50, eventRevenue: 100 }))
    expect(result.streaming).toBe(0)
  })
})

describe('computePerStreamRevenue', () => {
  it('divides revenue by streams', () => {
    expect(computePerStreamRevenue(100, 1000)).toBeCloseTo(0.1)
  })

  it('returns 0 for zero streams', () => {
    expect(computePerStreamRevenue(100, 0)).toBe(0)
  })

  it('returns 0 for negative streams', () => {
    expect(computePerStreamRevenue(100, -5)).toBe(0)
  })
})

describe('rankTracksByRevenue', () => {
  it('sorts tracks descending by revenue', () => {
    const tracks = [
      makeTrack({ assetId: 'a', revenue: 10 }),
      makeTrack({ assetId: 'b', revenue: 50 }),
      makeTrack({ assetId: 'c', revenue: 30 }),
    ]
    const ranked = rankTracksByRevenue(tracks)
    expect(ranked.map((t) => t.assetId)).toEqual(['b', 'c', 'a'])
  })

  it('returns empty for empty input', () => {
    expect(rankTracksByRevenue([])).toEqual([])
  })
})

describe('identifyHighSkipTracks', () => {
  it('filters tracks above skip threshold', () => {
    const tracks = [
      makeTrack({ assetId: 'a', skipRate: 0.5 }),
      makeTrack({ assetId: 'b', skipRate: 0.2 }),
      makeTrack({ assetId: 'c', skipRate: 0.9 }),
    ]
    const result = identifyHighSkipTracks(tracks)
    expect(result.map((t) => t.assetId)).toEqual(['a', 'c'])
  })

  it('uses custom threshold', () => {
    const tracks = [makeTrack({ skipRate: 0.3 })]
    expect(identifyHighSkipTracks(tracks, 0.25)).toHaveLength(1)
    expect(identifyHighSkipTracks(tracks, 0.35)).toHaveLength(0)
  })
})

describe('validateDashboardPeriod', () => {
  it('accepts valid period', () => {
    expect(validateDashboardPeriod({ start: '2025-01-01', end: '2025-01-31' }).valid).toBe(true)
  })

  it('rejects start after end', () => {
    expect(validateDashboardPeriod({ start: '2025-02-01', end: '2025-01-01' }).valid).toBe(false)
  })

  it('rejects invalid start date', () => {
    expect(validateDashboardPeriod({ start: 'nope', end: '2025-01-01' }).valid).toBe(false)
  })

  it('rejects period over 1 year', () => {
    expect(validateDashboardPeriod({ start: '2023-01-01', end: '2025-01-01' }).valid).toBe(false)
  })

  it('rejects equal start and end', () => {
    expect(validateDashboardPeriod({ start: '2025-01-01', end: '2025-01-01' }).valid).toBe(false)
  })
})

// ── Service ──────────────────────────────────────────────────────────────────

describe('createCreatorDashboardService', () => {
  const period: DashboardPeriod = { start: '2025-01-01', end: '2025-01-31' }

  function makeMockAnalytics() {
    return {
      getOverview: vi.fn().mockResolvedValue(makeOverview()),
      getTrackPerformance: vi.fn().mockResolvedValue([makeTrack()]),
      getAudienceGeo: vi.fn().mockResolvedValue([{ country: 'CD', listenerCount: 100, streamCount: 500, revenueShare: 0.3 }]),
      getEarningsTimeSeries: vi.fn().mockResolvedValue([]),
      getFollowerGrowthTimeSeries: vi.fn().mockResolvedValue([]),
    }
  }

  describe('getDashboard', () => {
    it('returns full dashboard snapshot', async () => {
      const analytics = makeMockAnalytics()
      const svc = createCreatorDashboardService({ analytics })
      const result = await svc.getDashboard({ orgId: 'o1', creatorId: 'c1', period })

      expect(result.overview).toBeDefined()
      expect(result.revenueBreakdown.total).toBe(500)
      expect(result.topTracks).toHaveLength(1)
      expect(result.audienceGeo).toHaveLength(1)
      expect(result.perStreamRevenue).toBeCloseTo(0.05)
    })

    it('throws on invalid period', async () => {
      const svc = createCreatorDashboardService({ analytics: makeMockAnalytics() })
      await expect(svc.getDashboard({ orgId: 'o1', creatorId: 'c1', period: { start: 'bad', end: '2025-01-01' } }))
        .rejects.toThrow()
    })

    it('throws when no analytics data exists', async () => {
      const analytics = makeMockAnalytics()
      analytics.getOverview.mockResolvedValue(null)
      const svc = createCreatorDashboardService({ analytics })
      await expect(svc.getDashboard({ orgId: 'o1', creatorId: 'c1', period }))
        .rejects.toThrow(/No analytics data/)
    })
  })

  describe('getEarningsChart', () => {
    it('returns time series data', async () => {
      const analytics = makeMockAnalytics()
      analytics.getEarningsTimeSeries.mockResolvedValue([{ date: '2025-01-01', amount: 10, source: 'streaming' }])
      const svc = createCreatorDashboardService({ analytics })
      const result = await svc.getEarningsChart({ orgId: 'o1', creatorId: 'c1', period })
      expect(result).toHaveLength(1)
    })
  })

  describe('getTrackDetail', () => {
    it('returns ranked tracks + high skip tracks', async () => {
      const analytics = makeMockAnalytics()
      analytics.getTrackPerformance.mockResolvedValue([
        makeTrack({ skipRate: 0.5 }),
        makeTrack({ assetId: 'a2', skipRate: 0.1 }),
      ])
      const svc = createCreatorDashboardService({ analytics })
      const result = await svc.getTrackDetail({ orgId: 'o1', creatorId: 'c1', period })
      expect(result.tracks).toHaveLength(2)
      expect(result.highSkipTracks).toHaveLength(1)
    })
  })

  describe('getFollowerGrowth', () => {
    it('returns follower growth series', async () => {
      const analytics = makeMockAnalytics()
      analytics.getFollowerGrowthTimeSeries.mockResolvedValue([{ date: '2025-01-01', count: 10 }])
      const svc = createCreatorDashboardService({ analytics })
      const result = await svc.getFollowerGrowth({ orgId: 'o1', creatorId: 'c1', period })
      expect(result).toHaveLength(1)
    })
  })
})
