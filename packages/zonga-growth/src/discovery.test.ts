import { describe, it, expect, vi } from 'vitest'
import {
  toDiscoveryItems,
  trendingToDiscoveryItems,
  createDiscoveryService,
} from './discovery'
import type { RecommendationPort } from './discovery'

function makeRecoItem(id = 'a1', score = 0.9) {
  return { assetId: id, score, reason: 'collaborative', metadata: { genre: 'afrobeat' } }
}

function makeTrendingScore(id = 'a1', score = 100, velocity = 10) {
  return { assetId: id, score, velocity }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('toDiscoveryItems', () => {
  it('maps RecommendationItems to DiscoveryItems', () => {
    const items = [makeRecoItem('a1', 0.8), makeRecoItem('a2', 0.5)]
    const result = toDiscoveryItems(items)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      assetId: 'a1',
      score: 0.8,
      reason: 'collaborative',
      metadata: { genre: 'afrobeat' },
    })
  })

  it('returns empty for empty input', () => {
    expect(toDiscoveryItems([])).toEqual([])
  })
})

describe('trendingToDiscoveryItems', () => {
  it('assigns "Rising fast" for velocity > 5', () => {
    const result = trendingToDiscoveryItems([makeTrendingScore('a1', 100, 10)])
    expect(result[0]!.reason).toBe('Rising fast')
    expect(result[0]!.metadata).toEqual({ velocity: 10 })
  })

  it('assigns "Popular now" for velocity <= 5', () => {
    const result = trendingToDiscoveryItems([makeTrendingScore('a1', 100, 3)])
    expect(result[0]!.reason).toBe('Popular now')
  })

  it('returns empty for empty input', () => {
    expect(trendingToDiscoveryItems([])).toEqual([])
  })
})

// ── Discovery Service ────────────────────────────────────────────────────────

describe('createDiscoveryService', () => {
  function makeMockReco(): RecommendationPort {
    return {
      getForYou: vi.fn().mockResolvedValue([makeRecoItem()]),
      getTrending: vi.fn().mockResolvedValue([makeTrendingScore()]),
      getSimilar: vi.fn().mockResolvedValue([makeRecoItem('sim1')]),
      getRegionalDiscovery: vi.fn().mockResolvedValue([makeRecoItem('city1')]),
      getSessionContinuation: vi.fn().mockResolvedValue([makeRecoItem('sess1')]),
    }
  }

  describe('getDiscoveryFeed', () => {
    it('returns for_you and trending sections', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      const feed = await svc.getDiscoveryFeed({ orgId: 'o1', userId: 'u1' })

      expect(feed.sections.length).toBeGreaterThanOrEqual(2)
      expect(feed.sections.find((s) => s.id === 'for_you')).toBeDefined()
      expect(feed.sections.find((s) => s.id === 'trending')).toBeDefined()
      expect(feed.generatedAt).toBeDefined()
    })

    it('includes city section when region is provided', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      const feed = await svc.getDiscoveryFeed({ orgId: 'o1', userId: 'u1', region: 'kinshasa' })

      expect(feed.sections.find((s) => s.id === 'city')).toBeDefined()
      expect(reco.getRegionalDiscovery).toHaveBeenCalled()
    })

    it('omits city section when region is not provided', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      const feed = await svc.getDiscoveryFeed({ orgId: 'o1', userId: 'u1' })

      expect(feed.sections.find((s) => s.id === 'city')).toBeUndefined()
    })
  })

  describe('querySurface', () => {
    it('queries for_you surface by default', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      const result = await svc.querySurface({ orgId: 'o1', userId: 'u1' })
      expect(result.surface).toBe('for_you')
      expect(reco.getForYou).toHaveBeenCalled()
    })

    it('queries trending surface', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      const result = await svc.querySurface({ orgId: 'o1', userId: 'u1', surface: 'trending' })
      expect(result.surface).toBe('trending')
    })

    it('queries city surface', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      await svc.querySurface({ orgId: 'o1', userId: 'u1', surface: 'city', region: 'lagos' })
      expect(reco.getRegionalDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'lagos' }),
      )
    })

    it('queries similar surface with seed', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      await svc.querySurface({ orgId: 'o1', userId: 'u1', surface: 'similar', seedAssetId: 'a1' })
      expect(reco.getSimilar).toHaveBeenCalled()
    })

    it('throws when similar surface has no seedAssetId', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      await expect(svc.querySurface({ orgId: 'o1', userId: 'u1', surface: 'similar' }))
        .rejects.toThrow(/seedAssetId required/)
    })

    it('queries session surface', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      await svc.querySurface({ orgId: 'o1', userId: 'u1', surface: 'session', recentAssetIds: ['a1'] })
      expect(reco.getSessionContinuation).toHaveBeenCalled()
    })

    it('caps limit at 100', async () => {
      const reco = makeMockReco()
      const svc = createDiscoveryService({ reco })
      await svc.querySurface({ orgId: 'o1', userId: 'u1', limit: 500 })
      expect(reco.getForYou).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
    })
  })
})
