import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock @nzila/zonga-core ──────────────────────────────────────────────────

vi.mock('@nzila/zonga-core/services', () => ({
  filterRecommendations: vi.fn((items: unknown[], _opts: { limit?: number }) => items.slice(0, _opts?.limit ?? 10)),
  mergeRecommendations: vi.fn((_arrays: unknown[], _limit: number) => [
    { assetId: 'merged-1', score: 0.9, reason: 'mood', metadata: { velocity: 4 } },
    { assetId: 'merged-2', score: 0.7, reason: 'artist', metadata: { velocity: 2 } },
  ]),
  buildSimilarTracksRequest: vi.fn((opts: { listenerId: string; seedAssetId: string; limit: number }) => ({
    listenerId: opts.listenerId,
    type: 'similar',
    context: { seedAssetId: opts.seedAssetId },
    limit: opts.limit,
    excludeAssetIds: [],
  })),
  buildRegionalDiscoveryRequest: vi.fn((opts: { listenerId: string; region: string; limit: number }) => ({
    listenerId: opts.listenerId,
    type: 'regional',
    context: { region: opts.region },
    limit: opts.limit,
    excludeAssetIds: [],
  })),
  buildSessionContinuationRequest: vi.fn((opts: { listenerId: string; recentAssetIds: string[]; limit: number }) => ({
    listenerId: opts.listenerId,
    type: 'session',
    context: { recentAssetIds: opts.recentAssetIds },
    limit: opts.limit,
    excludeAssetIds: [],
  })),
}))

import { createRecommendationService, CACHE_TTL } from './recommendations'
import type { RecommendationCacheStore, TrendingDataPort } from './recommendations'
import type { RecommendationEngine } from '@nzila/zonga-core/services'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(assetId: string, score = 0.8) {
  return { assetId, score, reason: 'test', metadata: { velocity: 6 } }
}

function makeEngine() {
  return {
    getRecommendations: vi.fn(async () => ({
      items: [makeItem('track-1'), makeItem('track-2')],
    })),
  }
}

function makeCache(): RecommendationCacheStore {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {}),
  }
}

function makeTrending(): TrendingDataPort {
  return {
    getSignals: vi.fn(async () => [
      { assetId: 'a1', streams24h: 100, streams7d: 500, uniqueListeners: 50, shareCount: 10, saveCount: 5 },
      { assetId: 'a2', streams24h: 200, streams7d: 300, uniqueListeners: 80, shareCount: 20, saveCount: 15 },
    ]),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createRecommendationService', () => {
  let engine: ReturnType<typeof makeEngine>
  let cache: RecommendationCacheStore
  let trending: TrendingDataPort
  let service: ReturnType<typeof createRecommendationService>

  beforeEach(() => {
    vi.restoreAllMocks()
    engine = makeEngine()
    cache = makeCache()
    trending = makeTrending()
    service = createRecommendationService({ engine: engine as unknown as RecommendationEngine, cache, trending })
  })

  describe('getForYou', () => {
    it('returns recommendations, caches result', async () => {
      const items = await service.getForYou({ orgId: 'org-1', listenerId: 'u1' })

      expect(items.length).toBeGreaterThan(0)
      expect(cache.set).toHaveBeenCalledWith('org-1', 'u1', 'for_you', expect.any(Array), CACHE_TTL.for_you)
    })

    it('returns cached result when available', async () => {
      const cachedItems = [makeItem('cached-1')]
      vi.mocked(cache.get).mockResolvedValueOnce({
        surface: 'for_you',
        items: cachedItems,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })

      const items = await service.getForYou({ orgId: 'org-1', listenerId: 'u1' })
      expect(items).toEqual(cachedItems)
      expect(engine.getRecommendations).not.toHaveBeenCalled()
    })
  })

  describe('getTrending', () => {
    it('computes trending scores from signals', async () => {
      const scores = await service.getTrending({ orgId: 'org-1', userId: 'u1' })

      expect(scores.length).toBeGreaterThan(0)
      expect(scores[0]).toHaveProperty('assetId')
      expect(scores[0]).toHaveProperty('score')
      expect(scores[0]).toHaveProperty('velocity')
      expect(cache.set).toHaveBeenCalled()
    })

    it('returns cached trending when available', async () => {
      const cachedItems = [makeItem('trend-cached')]
      vi.mocked(cache.get).mockResolvedValueOnce({
        surface: 'trending',
        items: cachedItems,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })

      const scores = await service.getTrending({ orgId: 'org-1', userId: 'u1', limit: 10 })
      expect(scores.length).toBeGreaterThan(0)
      expect(trending.getSignals).not.toHaveBeenCalled()
    })
  })

  describe('getSimilar', () => {
    it('returns similar tracks for a seed', async () => {
      const items = await service.getSimilar({
        orgId: 'org-1',
        listenerId: 'u1',
        seedAssetId: 'seed-1',
        limit: 5,
      })

      expect(engine.getRecommendations).toHaveBeenCalled()
      expect(items.length).toBeGreaterThan(0)
    })
  })

  describe('getRegionalDiscovery', () => {
    it('returns regional recommendations with caching', async () => {
      const items = await service.getRegionalDiscovery({
        orgId: 'org-1',
        listenerId: 'u1',
        region: 'africa-east',
      })

      expect(items.length).toBeGreaterThan(0)
      expect(cache.set).toHaveBeenCalled()
    })
  })

  describe('getSessionContinuation', () => {
    it('returns session items without caching', async () => {
      const items = await service.getSessionContinuation({
        orgId: 'org-1',
        listenerId: 'u1',
        recentAssetIds: ['a1', 'a2'],
      })

      expect(items.length).toBeGreaterThan(0)
      expect(cache.set).not.toHaveBeenCalled() // session is not cached
    })
  })

  describe('invalidateCache', () => {
    it('delegates to cache.invalidate', async () => {
      await service.invalidateCache('org-1', 'u1', 'for_you')
      expect(cache.invalidate).toHaveBeenCalledWith('org-1', 'u1', 'for_you')
    })

    it('works without surface (invalidate all)', async () => {
      await service.invalidateCache('org-1', 'u1')
      expect(cache.invalidate).toHaveBeenCalledWith('org-1', 'u1', undefined)
    })
  })
})
