import { describe, expect, it } from 'vitest'

import {
  createPlayEvent,
  createSkipEvent,
  createSearchEvent,
  createShareEvent,
  createSessionEvent,
  classifyEngagement,
} from './events/index'
import {
  computeDAU,
  computeMAU,
  computeRetention,
  computeSessionMetrics,
  computeSkipRate,
  computeCompletionRate,
  computeListenerSegments,
} from './metrics/index'
import {
  aggregateCreatorDashboard,
  aggregateAdminDashboard,
  computeTopTracks,
  computeTopCountries,
} from './dashboards/index'

// ── Events ──────────────────────────────────────────────────────────────────

describe('events', () => {
  const orgId = 'org-1'
  const userId = 'user-1'

  it('createPlayEvent produces a play event with correct shape', () => {
    const event = createPlayEvent(orgId, userId, {
      assetId: 'asset-1',
      creatorId: 'creator-1',
      durationMs: 240_000,
      positionMs: 120_000,
      completionPercent: 50,
      quality: 'high',
      isComplete: false,
      source: 'search',
    })

    expect(event.type).toBe('play')
    expect(event.orgId).toBe(orgId)
    expect(event.userId).toBe(userId)
    expect(event.id).toMatch(/^evt_/)
    expect(event.timestamp).toBeGreaterThan(0)
    expect(event.properties.assetId).toBe('asset-1')
    expect(event.properties.source).toBe('search')
  })

  it('createSkipEvent computes skipPercent', () => {
    const event = createSkipEvent(orgId, userId, {
      assetId: 'asset-2',
      creatorId: 'creator-2',
      positionMs: 60_000,
      durationMs: 240_000,
    })

    expect(event.type).toBe('skip')
    expect(event.properties.skipPercent).toBe(25) // 60000/240000 = 0.25 → 25%
  })

  it('createSkipEvent handles zero duration without NaN', () => {
    const event = createSkipEvent(orgId, userId, {
      assetId: 'asset-3',
      creatorId: 'creator-3',
      positionMs: 0,
      durationMs: 0,
    })

    expect(event.properties.skipPercent).toBe(0)
  })

  it('createSearchEvent records search properties', () => {
    const event = createSearchEvent(orgId, userId, {
      query: 'afrobeats',
      resultCount: 42,
      selectedIndex: 3,
      selectedAssetId: 'asset-4',
      latencyMs: 85,
    })

    expect(event.type).toBe('search')
    expect(event.properties.query).toBe('afrobeats')
    expect(event.properties.resultCount).toBe(42)
  })

  it('createShareEvent records share properties', () => {
    const event = createShareEvent(orgId, null, {
      entityType: 'track',
      entityId: 'track-1',
      platform: 'whatsapp',
      deepLink: 'https://zonga.app/t/track-1',
    })

    expect(event.type).toBe('share')
    expect(event.userId).toBeNull()
    expect(event.properties.platform).toBe('whatsapp')
  })

  it('createSessionEvent supports both start and end types', () => {
    const start = createSessionEvent(orgId, userId, 'session_start', {
      sessionId: 'sess-1',
      deviceType: 'mobile',
    })
    const end = createSessionEvent(orgId, userId, 'session_end', {
      sessionId: 'sess-1',
      durationMs: 900_000,
      tracksPlayed: 12,
    })

    expect(start.type).toBe('session_start')
    expect(end.type).toBe('session_end')
    expect(end.properties.durationMs).toBe(900_000)
  })

  it('each event gets a unique id', () => {
    const a = createPlayEvent(orgId, userId, {
      assetId: 'a', creatorId: 'c', durationMs: 1, positionMs: 0,
      completionPercent: 0, quality: 'low', isComplete: false, source: 'direct',
    })
    const b = createPlayEvent(orgId, userId, {
      assetId: 'b', creatorId: 'c', durationMs: 1, positionMs: 0,
      completionPercent: 0, quality: 'low', isComplete: false, source: 'direct',
    })

    expect(a.id).not.toBe(b.id)
  })
})

// ── Engagement Classification ───────────────────────────────────────────────

describe('classifyEngagement', () => {
  it('classifies passive listeners', () => {
    expect(classifyEngagement({ playsPerDay: 1, sharesPerWeek: 0, followedArtists: 0, sessionMinutesPerDay: 5 })).toBe('passive')
  })

  it('classifies active listeners', () => {
    expect(classifyEngagement({ playsPerDay: 5, sharesPerWeek: 1, followedArtists: 3, sessionMinutesPerDay: 20 })).toBe('active')
  })

  it('classifies power listeners', () => {
    expect(classifyEngagement({ playsPerDay: 15, sharesPerWeek: 2, followedArtists: 5, sessionMinutesPerDay: 70 })).toBe('power')
  })

  it('classifies superfans', () => {
    expect(classifyEngagement({ playsPerDay: 35, sharesPerWeek: 0, followedArtists: 0, sessionMinutesPerDay: 30 })).toBe('superfan')
  })

  it('superfan via high shares', () => {
    expect(classifyEngagement({ playsPerDay: 2, sharesPerWeek: 6, followedArtists: 0, sessionMinutesPerDay: 10 })).toBe('superfan')
  })

  it('superfan via long sessions', () => {
    expect(classifyEngagement({ playsPerDay: 2, sharesPerWeek: 0, followedArtists: 0, sessionMinutesPerDay: 130 })).toBe('superfan')
  })
})

// ── Metrics ─────────────────────────────────────────────────────────────────

describe('computeDAU', () => {
  it('counts unique users per day', () => {
    const base = new Date('2025-01-15T10:00:00Z').getTime()
    const sessions = [
      { userId: 'u1', startedAt: base, durationMs: 60_000 },
      { userId: 'u2', startedAt: base + 1000, durationMs: 60_000 },
      { userId: 'u1', startedAt: base + 5000, durationMs: 60_000 }, // duplicate
    ]

    const result = computeDAU(sessions)
    expect(result).toHaveLength(1)
    expect(result[0]!.uniqueUsers).toBe(2)
  })

  it('returns empty for no sessions', () => {
    expect(computeDAU([])).toEqual([])
  })
})

describe('computeMAU', () => {
  it('computes monthly unique users with growth', () => {
    const jan = new Date('2025-01-15T10:00:00Z').getTime()
    const feb = new Date('2025-02-15T10:00:00Z').getTime()

    const sessions = [
      { userId: 'u1', startedAt: jan, durationMs: 1000 },
      { userId: 'u2', startedAt: jan, durationMs: 1000 },
      { userId: 'u1', startedAt: feb, durationMs: 1000 },
      { userId: 'u2', startedAt: feb, durationMs: 1000 },
      { userId: 'u3', startedAt: feb, durationMs: 1000 },
    ]
    const dailyData = computeDAU(sessions)
    const result = computeMAU(dailyData, sessions)

    expect(result.length).toBeGreaterThanOrEqual(1)
    // Feb should have 3 unique users
    const feb25 = result.find((r) => r.month === '2025-02')
    expect(feb25?.uniqueUsers).toBe(3)
  })
})

describe('computeRetention', () => {
  it('computes retention cohorts', () => {
    const MS_DAY = 86_400_000
    const signupDate = new Date('2025-01-01T00:00:00Z').getTime()

    const signups = [
      { userId: 'u1', signedUpAt: signupDate },
      { userId: 'u2', signedUpAt: signupDate },
    ]

    const sessions = [
      // Day 1 retention: both return
      { userId: 'u1', startedAt: signupDate + MS_DAY },
      { userId: 'u2', startedAt: signupDate + MS_DAY },
      // Day 7 retention: only u1
      { userId: 'u1', startedAt: signupDate + 7 * MS_DAY },
    ]

    const result = computeRetention(signups, sessions)
    expect(result).toHaveLength(1)
    expect(result[0]!.cohortSize).toBe(2)
    // Day 1: 2/2 = 100%
    expect(result[0]!.retentionRates[0]).toBe(100)
    // Day 7: 1/2 = 50%
    expect(result[0]!.retentionRates[1]).toBe(50)
  })
})

describe('computeSessionMetrics', () => {
  it('computes aggregate session stats', () => {
    const sessions = [
      { durationMs: 300_000, tracksPlayed: 5, completedPlays: 4 },
      { durationMs: 600_000, tracksPlayed: 10, completedPlays: 8 },
      { durationMs: 60_000, tracksPlayed: 1, completedPlays: 0 },
    ]

    const result = computeSessionMetrics(sessions)
    expect(result.totalSessions).toBe(3)
    expect(result.avgDurationMs).toBe(320_000) // (300+600+60)/3
    expect(result.avgTracksPerSession).toBeCloseTo(5.33, 1)
    // 1 session with 0 completed plays → bounce rate 33.33%
    expect(result.bounceRate).toBeCloseTo(33.33, 1)
  })

  it('returns zeros for empty sessions', () => {
    const result = computeSessionMetrics([])
    expect(result.totalSessions).toBe(0)
    expect(result.avgDurationMs).toBe(0)
    expect(result.bounceRate).toBe(0)
  })
})

describe('computeSkipRate', () => {
  it('computes skip percentage', () => {
    const plays = [
      { isComplete: true },
      { isComplete: false },
      { isComplete: true },
      { isComplete: false },
    ]
    expect(computeSkipRate(plays)).toBe(50)
  })

  it('returns 0 for empty plays', () => {
    expect(computeSkipRate([])).toBe(0)
  })
})

describe('computeCompletionRate', () => {
  it('computes completion percentage with default 80% threshold', () => {
    const plays = [
      { completionPercent: 95 },
      { completionPercent: 50 },
      { completionPercent: 85 },
    ]
    // 2/3 above 80% = 66.67%
    expect(computeCompletionRate(plays)).toBeCloseTo(66.67, 1)
  })

  it('supports custom threshold', () => {
    const plays = [
      { completionPercent: 40 },
      { completionPercent: 50 },
      { completionPercent: 60 },
    ]
    expect(computeCompletionRate(plays, 50)).toBeCloseTo(66.67, 1) // 2/3
  })
})

describe('computeListenerSegments', () => {
  it('segments listeners into new/returning/dormant/churned', () => {
    const now = Date.now()
    const MS_DAY = 86_400_000

    const listeners = [
      { userId: 'new', signedUpAt: now - 2 * MS_DAY, lastActiveAt: now - MS_DAY },       // new (signed up < 7d)
      { userId: 'return', signedUpAt: now - 30 * MS_DAY, lastActiveAt: now - MS_DAY },    // returning (active < 7d, signup > 7d)
      { userId: 'dormant', signedUpAt: now - 60 * MS_DAY, lastActiveAt: now - 15 * MS_DAY }, // dormant (10d since active)
      { userId: 'churned', signedUpAt: now - 90 * MS_DAY, lastActiveAt: now - 45 * MS_DAY }, // churned (>30d)
    ]

    const segments = computeListenerSegments(listeners, now)
    const bySegment = Object.fromEntries(segments.map((s) => [s.segment, s.count]))

    expect(bySegment['new']).toBe(1)
    expect(bySegment['returning']).toBe(1)
    expect(bySegment['dormant']).toBe(1)
    expect(bySegment['churned']).toBe(1)
  })
})

// ── Dashboards ──────────────────────────────────────────────────────────────

describe('computeTopTracks', () => {
  it('ranks tracks by stream count', () => {
    const base = Date.now()
    const streams = [
      { trackId: 'a', trackTitle: 'Track A', artistName: 'Artist 1', listenerId: 'l1', countryCode: 'NG', countryName: 'Nigeria', playedAt: base, durationMs: 200_000, trackDurationMs: 240_000, revenueCents: 10, currency: 'USD', creatorId: 'c1' },
      { trackId: 'a', trackTitle: 'Track A', artistName: 'Artist 1', listenerId: 'l2', countryCode: 'KE', countryName: 'Kenya', playedAt: base + 1000, durationMs: 240_000, trackDurationMs: 240_000, revenueCents: 10, currency: 'USD', creatorId: 'c1' },
      { trackId: 'b', trackTitle: 'Track B', artistName: 'Artist 2', listenerId: 'l1', countryCode: 'NG', countryName: 'Nigeria', playedAt: base + 2000, durationMs: 180_000, trackDurationMs: 240_000, revenueCents: 5, currency: 'USD', creatorId: 'c2' },
    ]

    const result = computeTopTracks(streams, 10)
    expect(result[0]!.trackId).toBe('a')
    expect(result[0]!.streams).toBe(2)
    expect(result[0]!.uniqueListeners).toBe(2)
    // Track A: 1 completed (200k/240k=83%≥80%), 1 not (240k/240k=100%≥80%) → 2/2 = 100%
    expect(result[0]!.completionRate).toBe(100)
    expect(result[1]!.trackId).toBe('b')
  })
})

describe('computeTopCountries', () => {
  it('computes geographic distribution', () => {
    const base = Date.now()
    const makeStream = (listenerId: string, countryCode: string, countryName: string) => ({
      trackId: 't1', trackTitle: 'T', artistName: 'A', listenerId, countryCode, countryName,
      playedAt: base, durationMs: 1000, trackDurationMs: 2000, revenueCents: 1, currency: 'USD', creatorId: 'c1',
    })

    const streams = [
      makeStream('l1', 'NG', 'Nigeria'),
      makeStream('l2', 'NG', 'Nigeria'),
      makeStream('l3', 'KE', 'Kenya'),
    ]

    const result = computeTopCountries(streams)
    expect(result[0]!.countryCode).toBe('NG')
    expect(result[0]!.listeners).toBe(2)
    expect(result[1]!.countryCode).toBe('KE')
    expect(result[1]!.listeners).toBe(1)
  })
})

describe('aggregateCreatorDashboard', () => {
  it('aggregates creator metrics from stream rows', () => {
    const base = Date.now()
    const streams = [
      { trackId: 'a', trackTitle: 'Track A', artistName: 'Me', listenerId: 'l1', countryCode: 'NG', countryName: 'Nigeria', playedAt: base, durationMs: 200_000, trackDurationMs: 240_000, revenueCents: 50, currency: 'USD', creatorId: 'creator-1' },
      { trackId: 'a', trackTitle: 'Track A', artistName: 'Me', listenerId: 'l2', countryCode: 'KE', countryName: 'Kenya', playedAt: base + 5000, durationMs: 240_000, trackDurationMs: 240_000, revenueCents: 50, currency: 'USD', creatorId: 'creator-1' },
    ]

    const dashboard = aggregateCreatorDashboard('creator-1', streams, '30d')
    expect(dashboard.period).toBe('30d')
    expect(dashboard.totalStreams).toBe(2)
    expect(dashboard.totalRevenue).toBe(100) // 50+50 cents
    expect(dashboard.uniqueListeners).toBe(2)
    expect(dashboard.topTracks).toHaveLength(1) // one track
    expect(dashboard.topCountries).toHaveLength(2) // NG + KE
  })
})

describe('aggregateAdminDashboard', () => {
  it('aggregates platform-wide admin metrics', () => {
    const base = Date.now()
    const streams = [
      { trackId: 'a', trackTitle: 'Track A', artistName: 'Art1', listenerId: 'l1', countryCode: 'NG', countryName: 'Nigeria', playedAt: base, durationMs: 200_000, trackDurationMs: 240_000, revenueCents: 50, currency: 'USD', creatorId: 'c1' },
    ]

    const dashboard = aggregateAdminDashboard(streams, '7d', {
      dauCount: 150,
      mauCount: 900,
      activeCreatorCount: 25,
      newSignupCount: 10,
    })

    expect(dashboard.period).toBe('7d')
    expect(dashboard.dau).toBe(150)
    expect(dashboard.mau).toBe(900)
    expect(dashboard.dauMauRatio).toBeCloseTo(0.1667, 3)
    expect(dashboard.totalStreams).toBe(1)
    expect(dashboard.totalRevenue).toBe(50)
    expect(dashboard.activeCreators).toBe(25)
  })
})
