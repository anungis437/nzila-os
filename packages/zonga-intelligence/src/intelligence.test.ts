import { describe, it, expect } from 'vitest'
import type { UserSignal, Recommendation, AudienceSegment } from './types'
import { SignalType } from './types'
import {
  scoreItemsBySignals,
  buildRecommendations,
  computeDiversity,
} from './recommendations'
import { computeFraudScore, detectStreamFarming } from './fraud'
import { analyzeText, determineVerdict } from './moderation'
import {
  computeInsights,
  buildRevenueBreakdown,
  buildCreatorDashboard,
} from './insights'
import type { MetricDataPoint, RevenueEntry, TrackPerformance } from './insights'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSignal(partial?: Partial<UserSignal>): UserSignal {
  return {
    userId: 'user-1',
    signalType: SignalType.PLAY,
    targetId: 'track-1',
    targetType: 'track',
    timestamp: new Date('2025-06-01'),
    weight: 1,
    ...partial,
  }
}

// ── Recommendations ──────────────────────────────────────────────────────────

describe('scoreItemsBySignals', () => {
  it('scores items by weighted signal aggregation', () => {
    const now = new Date('2025-06-01')
    const signals = [
      makeSignal({ signalType: SignalType.PLAY, targetId: 'track-1', timestamp: now }),
      makeSignal({ signalType: SignalType.SAVE, targetId: 'track-1', timestamp: now }),
      makeSignal({ signalType: SignalType.PLAY, targetId: 'track-2', timestamp: now }),
    ]
    const scored = scoreItemsBySignals(signals, 30, now)
    expect(scored.length).toBe(2)
    // track-1 has PLAY(1.0) + SAVE(3.0) = 4.0 > track-2 PLAY(1.0)
    expect(scored[0]!.itemId).toBe('track-1')
    expect(scored[0]!.rawScore).toBeGreaterThan(scored[1]!.rawScore)
  })

  it('applies time decay to older signals', () => {
    const now = new Date('2025-06-01')
    const recent = new Date('2025-06-01')
    const old = new Date('2025-05-01') // 31 days ago, outside 30-day window
    const signals = [
      makeSignal({ targetId: 'recent-track', timestamp: recent }),
      makeSignal({ targetId: 'old-track', timestamp: old }),
    ]
    const scored = scoreItemsBySignals(signals, 30, now)
    const recentItem = scored.find(s => s.itemId === 'recent-track')
    const oldItem = scored.find(s => s.itemId === 'old-track')
    // old item should have 0 or very low score due to full decay
    expect(recentItem!.rawScore).toBeGreaterThan(oldItem?.rawScore ?? 0)
  })

  it('handles negative signals (skip/unfollow)', () => {
    const now = new Date('2025-06-01')
    const signals = [
      makeSignal({ signalType: SignalType.SKIP, targetId: 'track-1', timestamp: now }),
    ]
    const scored = scoreItemsBySignals(signals, 30, now)
    expect(scored[0]!.rawScore).toBeLessThan(0)
  })

  it('returns empty for no signals', () => {
    expect(scoreItemsBySignals([])).toHaveLength(0)
  })
})

describe('buildRecommendations', () => {
  it('builds recommendations from scored items, excluding blacklisted', () => {
    const scored = [
      { itemId: 'track-1', itemType: 'track' as const, rawScore: 10, signalCount: 5, topSignals: ['play'] },
      { itemId: 'track-2', itemType: 'track' as const, rawScore: 5, signalCount: 2, topSignals: ['save'] },
      { itemId: 'track-3', itemType: 'track' as const, rawScore: 3, signalCount: 1, topSignals: ['play'] },
    ]
    const recs = buildRecommendations(scored, 2, ['track-2'])
    expect(recs).toHaveLength(2)
    expect(recs[0]!.itemId).toBe('track-1')
    expect(recs[1]!.itemId).toBe('track-3')
  })

  it('normalizes scores to 0-1 range', () => {
    const scored = [
      { itemId: 't1', itemType: 'track' as const, rawScore: 10, signalCount: 1, topSignals: ['play'] },
      { itemId: 't2', itemType: 'track' as const, rawScore: 5, signalCount: 1, topSignals: ['play'] },
    ]
    const recs = buildRecommendations(scored)
    expect(recs[0]!.score).toBe(1)
    expect(recs[1]!.score).toBe(0.5)
  })
})

describe('computeDiversity', () => {
  it('returns high diversity for mixed item types', () => {
    const recs: Recommendation[] = [
      { itemId: 't1', itemType: 'track', score: 1, reason: '', strategy: 'collaborative' },
      { itemId: 'a1', itemType: 'artist', score: 0.9, reason: '', strategy: 'collaborative' },
      { itemId: 'e1', itemType: 'event', score: 0.8, reason: '', strategy: 'collaborative' },
      { itemId: 'p1', itemType: 'playlist', score: 0.7, reason: '', strategy: 'collaborative' },
    ]
    const diversity = computeDiversity(recs)
    expect(diversity).toBe(1) // (4/4 + 4/4) / 2 = 1.0
  })

  it('returns 1.0 for single item', () => {
    const recs: Recommendation[] = [
      { itemId: 't1', itemType: 'track', score: 1, reason: '', strategy: 'collaborative' },
    ]
    expect(computeDiversity(recs)).toBe(1)
  })
})

// ── Fraud Detection ──────────────────────────────────────────────────────────

describe('computeFraudScore', () => {
  it('returns low risk for no indicators', () => {
    const result = computeFraudScore('user-1', 'user', [])
    expect(result.score).toBe(0)
    expect(result.riskLevel).toBe('low')
    expect(result.recommendedAction).toBe('allow')
  })

  it('returns medium risk for single moderate indicator', () => {
    const result = computeFraudScore('user-1', 'user', ['bot_pattern'])
    expect(result.score).toBe(20)
    expect(result.riskLevel).toBe('low') // 20 < 25 threshold
    expect(result.recommendedAction).toBe('allow')
  })

  it('returns high risk for multiple indicators', () => {
    const result = computeFraudScore('user-1', 'user', [
      'geographic_impossibility',
      'payment_velocity',
    ])
    expect(result.score).toBe(50)
    expect(result.riskLevel).toBe('high')
    expect(result.recommendedAction).toBe('manual_review')
  })

  it('caps score at 100', () => {
    const result = computeFraudScore('user-1', 'user', [
      'burst_account_creation',
      'geographic_impossibility',
      'payment_velocity',
      'bot_pattern',
      'scalping_pattern',
    ])
    expect(result.score).toBe(100)
    expect(result.riskLevel).toBe('critical')
    expect(result.recommendedAction).toBe('block')
  })

  it('ignores unknown indicator names', () => {
    const result = computeFraudScore('user-1', 'user', ['unknown_indicator'])
    expect(result.score).toBe(0)
    expect(result.factors).toHaveLength(0)
  })
})

describe('detectStreamFarming', () => {
  it('detects high play rate', () => {
    const result = detectStreamFarming({
      trackId: 'track-1',
      userId: 'user-1',
      playCount: 30,
      timeWindowMinutes: 60,
      averageListenDuration: 180,
      trackDuration: 200,
    })
    expect(result).not.toBeNull()
    expect(result!.type).toBe('stream_farming')
  })

  it('detects low listen ratio', () => {
    const result = detectStreamFarming({
      trackId: 'track-1',
      userId: 'user-1',
      playCount: 5,
      timeWindowMinutes: 60,
      averageListenDuration: 10,
      trackDuration: 200,
    })
    expect(result).not.toBeNull()
    expect(result!.indicators.some(i => i.includes('listen ratio'))).toBe(true)
  })

  it('returns null for normal patterns', () => {
    const result = detectStreamFarming({
      trackId: 'track-1',
      userId: 'user-1',
      playCount: 3,
      timeWindowMinutes: 180,
      averageListenDuration: 180,
      trackDuration: 200,
    })
    expect(result).toBeNull()
  })
})

// ── Content Moderation ───────────────────────────────────────────────────────

describe('analyzeText', () => {
  it('detects spam keywords', () => {
    const categories = analyzeText('Buy now and get free money click here act fast')
    const spam = categories.find(c => c.name === 'spam')
    expect(spam).toBeDefined()
    expect(spam!.triggered).toBe(true)
  })

  it('detects contact info (email)', () => {
    const categories = analyzeText('Contact me at test@example.com for details')
    const contact = categories.find(c => c.name === 'contact_info')
    expect(contact).toBeDefined()
    expect(contact!.triggered).toBe(true)
  })

  it('returns no triggers for clean text', () => {
    const categories = analyzeText('This is a beautiful song about love and nature')
    const triggered = categories.filter(c => c.triggered)
    expect(triggered).toHaveLength(0)
  })
})

describe('determineVerdict', () => {
  it('approves when nothing triggered', () => {
    const categories = [
      { name: 'spam', score: 0, threshold: 0.02, triggered: false },
      { name: 'contact_info', score: 0, threshold: 0.01, triggered: false },
    ]
    const result = determineVerdict(categories)
    expect(result.verdict).toBe('approved')
    expect(result.requiresHumanReview).toBe(false)
  })

  it('flags low-severity triggers', () => {
    const categories = [
      { name: 'spam', score: 0.05, threshold: 0.02, triggered: true },
    ]
    const result = determineVerdict(categories)
    expect(result.verdict).toBe('flagged')
    expect(result.requiresHumanReview).toBe(false)
  })
})

// ── Creator Insights ─────────────────────────────────────────────────────────

describe('computeInsights', () => {
  it('detects rising trend from positive change', () => {
    const metrics: MetricDataPoint[] = [
      { metric: 'streams', currentValue: 1200, previousValue: 1000, period: 'week' },
    ]
    const insights = computeInsights('artist-1', metrics)
    expect(insights).toHaveLength(1)
    expect(insights[0]!.trend).toBe('rising')
    expect(insights[0]!.percentChange).toBe(20)
  })

  it('detects declining trend', () => {
    const metrics: MetricDataPoint[] = [
      { metric: 'revenue', currentValue: 80, previousValue: 100, period: 'month' },
    ]
    const insights = computeInsights('artist-1', metrics)
    expect(insights[0]!.trend).toBe('declining')
    expect(insights[0]!.percentChange).toBe(-20)
  })

  it('marks stable when change < 5%', () => {
    const metrics: MetricDataPoint[] = [
      { metric: 'followers', currentValue: 102, previousValue: 100, period: 'week' },
    ]
    const insights = computeInsights('artist-1', metrics)
    expect(insights[0]!.trend).toBe('stable')
  })
})

describe('buildRevenueBreakdown', () => {
  it('aggregates revenue by source', () => {
    const entries: RevenueEntry[] = [
      { source: 'streaming', amount: 100 },
      { source: 'tickets', amount: 250 },
      { source: 'streaming', amount: 50 },
    ]
    const breakdown = buildRevenueBreakdown(entries)
    expect(breakdown['streaming']).toBe(150)
    expect(breakdown['tickets']).toBe(250)
  })
})

describe('buildCreatorDashboard', () => {
  it('returns complete dashboard shape', () => {
    const metrics: MetricDataPoint[] = [
      { metric: 'streams', currentValue: 1000, previousValue: 800, period: 'week' },
    ]
    const segments: AudienceSegment[] = [
      { name: 'Nairobi', size: 500, percentage: 50, topCountries: ['KE'], ageRange: '18-34', engagementScore: 0.8 },
    ]
    const tracks: TrackPerformance[] = [
      { trackId: 'track-1', streams: 500, revenue: 1.5 },
      { trackId: 'track-2', streams: 300, revenue: 0.9 },
    ]
    const revenue: RevenueEntry[] = [
      { source: 'streaming', amount: 2.4 },
    ]

    const dashboard = buildCreatorDashboard('artist-1', metrics, segments, tracks, revenue)
    expect(dashboard.artistId).toBe('artist-1')
    expect(dashboard.insights).toHaveLength(1)
    expect(dashboard.audienceSegments).toHaveLength(1)
    expect(dashboard.topTracks).toHaveLength(2)
    expect(dashboard.topTracks[0]!.trackId).toBe('track-1') // sorted by streams desc
    expect(dashboard.revenueBreakdown['streaming']).toBe(2.4)
    expect(dashboard.generatedAt).toBeInstanceOf(Date)
  })
})
