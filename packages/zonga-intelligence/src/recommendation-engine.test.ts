import { describe, it, expect, vi } from 'vitest'
import {
  createRecommendationEngine,
  DEFAULT_RECOMMENDATION_CONFIG,
} from './recommendation-engine'
import type { RecommendationPorts, TrendingItem, ContentSimilarity } from './recommendation-engine'
import type { UserSignal } from './types'
import { SignalType } from './types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSignal(overrides: Partial<UserSignal> = {}): UserSignal {
  return {
    userId: 'user-1',
    signalType: SignalType.PLAY,
    targetId: 'track-1',
    targetType: 'track',
    timestamp: new Date(),
    weight: 1,
    ...overrides,
  }
}

function makeTrending(overrides: Partial<TrendingItem> = {}): TrendingItem {
  return {
    itemId: 'track-trending-1',
    itemType: 'track',
    velocity: 100,
    volume: 5000,
    region: 'ZA',
    ...overrides,
  }
}

function makeSimilarity(overrides: Partial<ContentSimilarity> = {}): ContentSimilarity {
  return {
    sourceItemId: 'track-1',
    targetItemId: 'track-similar-1',
    targetItemType: 'track',
    similarityScore: 0.8,
    sharedAttributes: ['afrobeats', 'high-energy'],
    ...overrides,
  }
}

function createMockPorts(overrides: Partial<RecommendationPorts> = {}): RecommendationPorts {
  return {
    fetchUserSignals: vi.fn().mockResolvedValue([]),
    fetchTrendingItems: vi.fn().mockResolvedValue([]),
    fetchContentSimilar: vi.fn().mockResolvedValue([]),
    fetchUserRegion: vi.fn().mockResolvedValue('ZA'),
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('@nzila/zonga-intelligence — recommendation-engine', () => {
  it('returns empty recommendations when no signals or trending data', async () => {
    const ports = createMockPorts()
    const engine = createRecommendationEngine(ports)

    const result = await engine.recommend({
      userId: 'user-1',
      targetType: 'track',
    })

    expect(result.recommendations).toHaveLength(0)
    expect(result.userId).toBe('user-1')
    expect(result.modelId).toBe('zonga-reco-v1')
    expect(result.diversity).toBe(1.0) // single item = max diversity
  })

  it('produces recommendations from user signals', async () => {
    const signals: UserSignal[] = [
      makeSignal({ targetId: 'track-A', signalType: SignalType.PLAY }),
      makeSignal({ targetId: 'track-A', signalType: SignalType.SAVE }),
      makeSignal({ targetId: 'track-A', signalType: SignalType.SHARE }),
      makeSignal({ targetId: 'track-B', signalType: SignalType.PLAY }),
    ]

    const ports = createMockPorts({
      fetchUserSignals: vi.fn().mockResolvedValue(signals),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({ userId: 'user-1', targetType: 'track' })

    expect(result.recommendations.length).toBeGreaterThan(0)
    // track-A should score higher (more diverse signals)
    expect(result.recommendations[0]!.itemId).toBe('track-A')
    expect(result.recommendations[0]!.score).toBeLessThanOrEqual(1)
    expect(result.recommendations[0]!.score).toBeGreaterThan(0)
  })

  it('merges trending items into recommendations', async () => {
    const trending: TrendingItem[] = [
      makeTrending({ itemId: 'track-hot-1', velocity: 200 }),
      makeTrending({ itemId: 'track-hot-2', velocity: 100 }),
    ]

    const ports = createMockPorts({
      fetchTrendingItems: vi.fn().mockResolvedValue(trending),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({ userId: 'user-1', targetType: 'track' })

    expect(result.recommendations.length).toBeGreaterThan(0)
    const ids = result.recommendations.map((r) => r.itemId)
    expect(ids).toContain('track-hot-1')
  })

  it('includes content-based similar items', async () => {
    const signals = [makeSignal({ targetId: 'track-1', signalType: SignalType.SAVE })]
    const similar: ContentSimilarity[] = [
      makeSimilarity({ targetItemId: 'track-match-1', similarityScore: 0.9 }),
    ]

    const ports = createMockPorts({
      fetchUserSignals: vi.fn().mockResolvedValue(signals),
      fetchContentSimilar: vi.fn().mockResolvedValue(similar),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({ userId: 'user-1', targetType: 'track' })

    const ids = result.recommendations.map((r) => r.itemId)
    expect(ids).toContain('track-match-1')
  })

  it('excludes specified IDs', async () => {
    const signals = [
      makeSignal({ targetId: 'track-A', signalType: SignalType.SAVE }),
      makeSignal({ targetId: 'track-B', signalType: SignalType.PLAY }),
    ]

    const ports = createMockPorts({
      fetchUserSignals: vi.fn().mockResolvedValue(signals),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({
      userId: 'user-1',
      targetType: 'track',
      excludeIds: ['track-A'],
    })

    const ids = result.recommendations.map((r) => r.itemId)
    expect(ids).not.toContain('track-A')
  })

  it('respects limit parameter', async () => {
    const signals = Array.from({ length: 50 }, (_, i) =>
      makeSignal({ targetId: `track-${i}`, signalType: SignalType.PLAY }),
    )

    const ports = createMockPorts({
      fetchUserSignals: vi.fn().mockResolvedValue(signals),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({
      userId: 'user-1',
      targetType: 'track',
      limit: 5,
    })

    expect(result.recommendations.length).toBeLessThanOrEqual(5)
  })

  it('produces explainability metadata', async () => {
    const signals = [makeSignal({ targetId: 'track-1', signalType: SignalType.PLAY })]

    const ports = createMockPorts({
      fetchUserSignals: vi.fn().mockResolvedValue(signals),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({ userId: 'user-1', targetType: 'track' })

    expect(result.explanation).toBeDefined()
    expect(result.explanation.method).toBe('heuristic')
    expect(result.explanation.humanReadable).toContain('track')
    expect(result.explanation.confidence).toBeGreaterThanOrEqual(0)
    expect(result.explanation.confidence).toBeLessThanOrEqual(1)
  })

  it('supports collaborative-only strategy', async () => {
    const signals = [
      makeSignal({ targetId: 'track-A', signalType: SignalType.SAVE }),
    ]
    const trending = [makeTrending({ itemId: 'track-hot', velocity: 999 })]

    const ports = createMockPorts({
      fetchUserSignals: vi.fn().mockResolvedValue(signals),
      fetchTrendingItems: vi.fn().mockResolvedValue(trending),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({
      userId: 'user-1',
      targetType: 'track',
      strategy: 'collaborative',
    })

    expect(result.strategy).toBe('collaborative')
    // collaborative-only: trending items might still appear but with 0 trending weight
  })

  it('records latency in result', async () => {
    const ports = createMockPorts()
    const engine = createRecommendationEngine(ports)

    const result = await engine.recommend({ userId: 'user-1', targetType: 'track' })

    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(typeof result.latencyMs).toBe('number')
  })

  it('negative signals reduce scores', async () => {
    const signals = [
      makeSignal({ targetId: 'track-liked', signalType: SignalType.SAVE }),
      makeSignal({ targetId: 'track-liked', signalType: SignalType.SHARE }),
      makeSignal({ targetId: 'track-skipped', signalType: SignalType.SKIP }),
      makeSignal({ targetId: 'track-skipped', signalType: SignalType.SKIP }),
      makeSignal({ targetId: 'track-skipped', signalType: SignalType.SKIP }),
    ]

    const ports = createMockPorts({
      fetchUserSignals: vi.fn().mockResolvedValue(signals),
    })

    const engine = createRecommendationEngine(ports)
    const result = await engine.recommend({ userId: 'user-1', targetType: 'track' })

    // track-liked should appear, track-skipped should not (negative score)
    const ids = result.recommendations.map((r) => r.itemId)
    if (ids.length > 0) {
      expect(ids[0]).toBe('track-liked')
    }
    expect(ids).not.toContain('track-skipped')
  })
})
