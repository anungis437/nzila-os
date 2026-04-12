import { describe, expect, it } from 'vitest'

import {
  computeTrackSimilarity,
  findSimilarTracks,
  batchFindSimilar,
  DEFAULT_SIMILARITY_WEIGHTS,
  type TrackAttributes,
} from './content-similarity'

import {
  scoreTrendingItems,
  getTrendingByRegion,
  detectBreakouts,
  DEFAULT_TRENDING_CONFIG,
  type TrendingInput,
} from './trending'

import {
  createRecommendationCache,
  DEFAULT_CACHE_CONFIG,
  type RecommendationCacheConfig,
} from './recommendation-cache'

import type { RecommendationResult } from './types'

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeTrack(overrides: Partial<TrackAttributes> & { trackId: string }): TrackAttributes {
  return {
    genres: ['afrobeats'],
    moods: ['upbeat'],
    bpm: 120,
    key: 'Cmaj',
    energy: 0.7,
    danceability: 0.8,
    acousticness: 0.2,
    instrumentalness: 0.1,
    valence: 0.6,
    durationMs: 210_000,
    ...overrides,
  }
}

function makeRecoResult(userId: string, strategy: string = 'hybrid'): RecommendationResult {
  return {
    userId,
    recommendations: [
      { itemId: 'track-1', itemType: 'track', score: 0.9, reason: 'Similar genre', strategy: 'content_based' },
    ],
    strategy,
    diversity: 0.5,
    modelId: 'test-model',
    modelVersion: '1.0',
    inferenceId: 'inf-1',
    timestamp: new Date(),
    latencyMs: 50,
    featureFlags: [],
    explanation: {
      method: 'heuristic',
      topFactors: [],
      confidence: 0.8,
      humanReadable: 'Based on listening history',
    },
  }
}

// ── Content Similarity ──────────────────────────────────────────────────────

describe('computeTrackSimilarity', () => {
  it('identical tracks score 1.0', () => {
    const track = makeTrack({ trackId: 'a' })
    const score = computeTrackSimilarity(track, track)
    expect(score).toBe(1)
  })

  it('completely different tracks score near 0', () => {
    const a = makeTrack({ trackId: 'a', genres: ['metal'], moods: ['aggressive'], bpm: 200, key: 'F#maj', energy: 1, danceability: 0.2, acousticness: 0, instrumentalness: 0.9, valence: 0.1, durationMs: 400_000, language: 'en', releaseYear: 1985 })
    const b = makeTrack({ trackId: 'b', genres: ['jazz'], moods: ['mellow'], bpm: 80, key: 'Amin', energy: 0.2, danceability: 0.3, acousticness: 0.9, instrumentalness: 0.2, valence: 0.9, durationMs: 180_000, language: 'fr', releaseYear: 2024 })
    const score = computeTrackSimilarity(a, b)
    expect(score).toBeLessThan(0.3)
  })

  it('tracks sharing genres score higher than those that do not', () => {
    const source = makeTrack({ trackId: 's', genres: ['afrobeats', 'dancehall'] })
    const similar = makeTrack({ trackId: 'a', genres: ['afrobeats', 'pop'] })
    const different = makeTrack({ trackId: 'b', genres: ['classical', 'ambient'] })

    const scoreSimilar = computeTrackSimilarity(source, similar)
    const scoreDifferent = computeTrackSimilarity(source, different)
    expect(scoreSimilar).toBeGreaterThan(scoreDifferent)
  })

  it('uses custom weights when provided', () => {
    const a = makeTrack({ trackId: 'a', genres: ['pop'], bpm: 120 })
    const b = makeTrack({ trackId: 'b', genres: ['rock'], bpm: 120 })

    // Zero genre weight, full bpm weight → similarity should be high
    const weights = { ...DEFAULT_SIMILARITY_WEIGHTS, genre: 0, bpm: 1 }
    const score = computeTrackSimilarity(a, b, weights)
    expect(score).toBeGreaterThan(0.7)
  })
})

describe('findSimilarTracks', () => {
  it('returns top N similar tracks excluding the source', () => {
    const source = makeTrack({ trackId: 'source', genres: ['afrobeats'] })
    const catalog = [
      source,
      makeTrack({ trackId: 'close', genres: ['afrobeats', 'pop'] }),
      makeTrack({ trackId: 'far', genres: ['classical'] }),
    ]

    const result = findSimilarTracks(source, catalog, 5)
    expect(result.every((r) => r.sourceItemId === 'source')).toBe(true)
    expect(result.every((r) => r.targetItemId !== 'source')).toBe(true)
    // The afrobeats/pop track should rank first
    expect(result[0]!.targetItemId).toBe('close')
    expect(result[0]!.similarityScore).toBeGreaterThan(0)
  })

  it('respects limit', () => {
    const source = makeTrack({ trackId: 'source' })
    const catalog = Array.from({ length: 20 }, (_, i) =>
      makeTrack({ trackId: `t-${i}`, bpm: 100 + i })
    )
    const result = findSimilarTracks(source, catalog, 3)
    expect(result.length).toBeLessThanOrEqual(3)
  })
})

describe('batchFindSimilar', () => {
  it('deduplicates by target, keeping highest score', () => {
    const sources = [
      makeTrack({ trackId: 's1', genres: ['afrobeats'] }),
      makeTrack({ trackId: 's2', genres: ['afrobeats', 'pop'] }),
    ]
    const catalog = [
      ...sources,
      makeTrack({ trackId: 'target', genres: ['afrobeats'] }),
    ]

    const result = batchFindSimilar(sources, catalog, 5, 50)
    const targetMatches = result.filter((r) => r.targetItemId === 'target')
    // Should only appear once (deduplicated)
    expect(targetMatches).toHaveLength(1)
  })
})

// ── Trending ────────────────────────────────────────────────────────────────

describe('scoreTrendingItems', () => {
  it('scores items and sorts by composite score', () => {
    const now = Date.now()
    const inputs: TrendingInput[] = [
      { itemId: 'hot', itemType: 'track', region: 'NG', currentCount: 500, previousCount: 50, lastInteractionAt: now - 60_000, totalCount: 1000 },
      { itemId: 'steady', itemType: 'track', region: 'NG', currentCount: 100, previousCount: 90, lastInteractionAt: now - 3_600_000, totalCount: 5000 },
    ]

    const result = scoreTrendingItems(inputs, DEFAULT_TRENDING_CONFIG, now)
    expect(result).toHaveLength(2)
    // 'hot' has 10× velocity increase, should be first
    expect(result[0]!.itemId).toBe('hot')
    expect(result[0]!.velocity).toBeGreaterThan(0)
    expect(result[0]!.volume).toBe(500)
  })

  it('returns empty for no inputs', () => {
    expect(scoreTrendingItems([])).toEqual([])
  })

  it('handles new items with zero previous count', () => {
    const now = Date.now()
    const inputs: TrendingInput[] = [
      { itemId: 'brand-new', itemType: 'track', region: 'KE', currentCount: 200, previousCount: 0, lastInteractionAt: now, totalCount: 200 },
    ]

    const result = scoreTrendingItems(inputs, DEFAULT_TRENDING_CONFIG, now)
    expect(result).toHaveLength(1)
    expect(result[0]!.velocity).toBeGreaterThan(0) // log2(201)
  })
})

describe('getTrendingByRegion', () => {
  it('filters by region and item type', () => {
    const now = Date.now()
    const inputs: TrendingInput[] = [
      { itemId: 'ng-track', itemType: 'track', region: 'NG', currentCount: 100, previousCount: 10, lastInteractionAt: now, totalCount: 200 },
      { itemId: 'ke-track', itemType: 'track', region: 'KE', currentCount: 100, previousCount: 10, lastInteractionAt: now, totalCount: 200 },
      { itemId: 'ng-artist', itemType: 'artist', region: 'NG', currentCount: 50, previousCount: 5, lastInteractionAt: now, totalCount: 100 },
    ]

    const result = getTrendingByRegion(inputs, 'NG', 'track', 50, DEFAULT_TRENDING_CONFIG, now)
    expect(result).toHaveLength(1)
    expect(result[0]!.itemId).toBe('ng-track')
    expect(result[0]!.region).toBe('NG')
  })
})

describe('detectBreakouts', () => {
  it('detects items with >= 3× velocity growth', () => {
    const inputs: TrendingInput[] = [
      { itemId: 'breakout', itemType: 'track', region: 'NG', currentCount: 400, previousCount: 100, lastInteractionAt: Date.now(), totalCount: 800 }, // 4×
      { itemId: 'normal', itemType: 'track', region: 'NG', currentCount: 150, previousCount: 100, lastInteractionAt: Date.now(), totalCount: 500 },   // 1.5×
    ]

    const result = detectBreakouts(inputs, 3.0)
    expect(result).toHaveLength(1)
    expect(result[0]!.itemId).toBe('breakout')
  })

  it('detects new items with significant count', () => {
    const inputs: TrendingInput[] = [
      { itemId: 'viral-new', itemType: 'track', region: 'KE', currentCount: 200, previousCount: 0, lastInteractionAt: Date.now(), totalCount: 200 },
      { itemId: 'trickle-new', itemType: 'track', region: 'KE', currentCount: 10, previousCount: 0, lastInteractionAt: Date.now(), totalCount: 10 },
    ]

    const result = detectBreakouts(inputs)
    expect(result).toHaveLength(1)
    expect(result[0]!.itemId).toBe('viral-new')
  })
})

// ── Recommendation Cache ────────────────────────────────────────────────────

describe('createRecommendationCache', () => {
  const smallCacheConfig: RecommendationCacheConfig = {
    maxEntries: 5,
    defaultTtlMs: 60_000,
    strategyTtlMs: { trending: 10_000 },
  }

  it('returns null on cache miss', () => {
    const cache = createRecommendationCache(smallCacheConfig)
    expect(cache.get('nonexistent')).toBeNull()
  })

  it('stores and retrieves results', () => {
    const cache = createRecommendationCache(smallCacheConfig)
    const result = makeRecoResult('user-1')

    cache.set('key-1', result)
    const retrieved = cache.get('key-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.userId).toBe('user-1')
  })

  it('invalidates by key', () => {
    const cache = createRecommendationCache(smallCacheConfig)
    cache.set('key-1', makeRecoResult('user-1'))

    expect(cache.invalidate('key-1')).toBe(true)
    expect(cache.get('key-1')).toBeNull()
    expect(cache.invalidate('key-1')).toBe(false) // already gone
  })

  it('invalidateForUser removes all entries for that user', () => {
    const cache = createRecommendationCache(smallCacheConfig)
    cache.set('k1', makeRecoResult('user-1', 'collaborative'))
    cache.set('k2', makeRecoResult('user-1', 'trending'))
    cache.set('k3', makeRecoResult('user-2', 'hybrid'))

    const count = cache.invalidateForUser('user-1')
    expect(count).toBe(2)
    expect(cache.get('k1')).toBeNull()
    expect(cache.get('k2')).toBeNull()
    expect(cache.get('k3')).not.toBeNull()
  })

  it('tracks hit/miss stats', () => {
    const cache = createRecommendationCache(smallCacheConfig)
    cache.set('k1', makeRecoResult('user-1'))

    cache.get('k1')     // hit
    cache.get('k1')     // hit
    cache.get('missing') // miss

    const stats = cache.stats()
    expect(stats.hits).toBe(2)
    expect(stats.misses).toBe(1)
    expect(stats.hitRate).toBeCloseTo(66.67, 1)
    expect(stats.size).toBe(1)
  })

  it('buildKey produces deterministic keys', () => {
    const cache = createRecommendationCache(smallCacheConfig)
    const key = cache.buildKey('user-1', 'track', 'hybrid')
    expect(key).toBe('reco:user-1:track:hybrid')
    expect(cache.buildKey('user-1', 'track', 'hybrid')).toBe(key)
  })

  it('clear resets everything', () => {
    const cache = createRecommendationCache(smallCacheConfig)
    cache.set('k1', makeRecoResult('u1'))
    cache.set('k2', makeRecoResult('u2'))
    cache.get('k1')

    cache.clear()
    const stats = cache.stats()
    expect(stats.size).toBe(0)
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
  })
})
