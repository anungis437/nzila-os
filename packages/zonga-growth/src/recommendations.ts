/**
 * @nzila/zonga-growth — Recommendation Service
 *
 * Orchestrates recommendations by composing the RecommendationEngine port
 * from zonga-core with caching, trending computation, and surface-level
 * scoring. The actual ML inference is the engine; this service handles
 * cache management, request routing, and result composition.
 *
 * @module @nzila/zonga-growth/recommendations
 */

import type { RecommendationRequest, RecommendationResponse, RecommendationItem } from '@nzila/zonga-core/types'
import type { RecommendationEngine } from '@nzila/zonga-core/services'
import {
  filterRecommendations,
  mergeRecommendations,
  buildSimilarTracksRequest,
  buildRegionalDiscoveryRequest,
  buildSessionContinuationRequest,
} from '@nzila/zonga-core/services'

// ── Types ───────────────────────────────────────────────────────────────────

export type RecommendationSurface =
  | 'trending'
  | 'for_you'
  | 'city'
  | 'new_releases'
  | 'similar'
  | 'session'

export interface CachedRecommendation {
  readonly surface: RecommendationSurface
  readonly items: readonly RecommendationItem[]
  readonly generatedAt: string
  readonly expiresAt: string
}

export interface TrendingSignal {
  readonly assetId: string
  readonly streams24h: number
  readonly streams7d: number
  readonly uniqueListeners: number
  readonly shareCount: number
  readonly saveCount: number
}

export interface TrendingScore {
  readonly assetId: string
  readonly score: number
  readonly velocity: number // rate of change
}

// ── Cache Ports ─────────────────────────────────────────────────────────────

export interface RecommendationCacheStore {
  get(
    orgId: string,
    userId: string,
    surface: RecommendationSurface,
  ): Promise<CachedRecommendation | null>
  set(
    orgId: string,
    userId: string,
    surface: RecommendationSurface,
    items: readonly RecommendationItem[],
    ttlSeconds: number,
  ): Promise<void>
  invalidate(orgId: string, userId: string, surface?: RecommendationSurface): Promise<void>
}

export interface TrendingDataPort {
  getSignals(orgId: string, limit: number): Promise<readonly TrendingSignal[]>
}

// ── Cache TTL ───────────────────────────────────────────────────────────────

export const CACHE_TTL: Record<RecommendationSurface, number> = {
  trending: 300, // 5 min — high churn
  for_you: 1800, // 30 min
  city: 3600, // 1 hour
  new_releases: 1800, // 30 min
  similar: 3600, // 1 hour
  session: 60, // 1 min — ephemeral
} as const

// ── Trending Scoring ────────────────────────────────────────────────────────

const TRENDING_WEIGHTS = {
  streams24h: 3.0,
  streams7d: 1.0,
  uniqueListeners: 2.0,
  shareCount: 4.0,
  saveCount: 2.5,
} as const

/**
 * Computes trending scores from raw signals.
 * Velocity = 24h streams / 7d streams (momentum indicator).
 */
export function computeTrendingScores(
  signals: readonly TrendingSignal[],
): readonly TrendingScore[] {
  if (signals.length === 0) return []

  // Find max values for normalization
  const maxStreams24h = Math.max(...signals.map((s) => s.streams24h), 1)
  const maxStreams7d = Math.max(...signals.map((s) => s.streams7d), 1)
  const maxListeners = Math.max(...signals.map((s) => s.uniqueListeners), 1)
  const maxShares = Math.max(...signals.map((s) => s.shareCount), 1)
  const maxSaves = Math.max(...signals.map((s) => s.saveCount), 1)

  return signals
    .map((signal) => {
      const normalized = {
        streams24h: signal.streams24h / maxStreams24h,
        streams7d: signal.streams7d / maxStreams7d,
        uniqueListeners: signal.uniqueListeners / maxListeners,
        shareCount: signal.shareCount / maxShares,
        saveCount: signal.saveCount / maxSaves,
      }

      const score =
        normalized.streams24h * TRENDING_WEIGHTS.streams24h +
        normalized.streams7d * TRENDING_WEIGHTS.streams7d +
        normalized.uniqueListeners * TRENDING_WEIGHTS.uniqueListeners +
        normalized.shareCount * TRENDING_WEIGHTS.shareCount +
        normalized.saveCount * TRENDING_WEIGHTS.saveCount

      const velocity =
        signal.streams7d > 0
          ? (signal.streams24h * 7) / signal.streams7d
          : signal.streams24h > 0
            ? 10 // max velocity for new content
            : 0

      return { assetId: signal.assetId, score, velocity }
    })
    .sort((a, b) => b.score - a.score)
}

// ── Recommendation Orchestrator ─────────────────────────────────────────────

export function createRecommendationService(deps: {
  engine: RecommendationEngine
  cache: RecommendationCacheStore
  trending: TrendingDataPort
}) {
  const { engine, cache, trending } = deps

  async function getOrCompute(
    orgId: string,
    userId: string,
    surface: RecommendationSurface,
    compute: () => Promise<readonly RecommendationItem[]>,
  ): Promise<readonly RecommendationItem[]> {
    // Check cache first
    const cached = await cache.get(orgId, userId, surface)
    if (cached) return cached.items

    const items = await compute()

    // Store in cache
    const ttl = CACHE_TTL[surface]
    await cache.set(orgId, userId, surface, items, ttl)

    return items
  }

  return {
    /**
     * Get personalized "For You" recommendations.
     * Merges multiple recommendation types for diversity.
     */
    async getForYou(params: {
      orgId: string
      listenerId: string
      limit?: number
    }): Promise<readonly RecommendationItem[]> {
      const limit = params.limit ?? 30

      return getOrCompute(params.orgId, params.listenerId, 'for_you', async () => {
        // Fan out to multiple strategies in parallel
        const [moodBased, artistAffinity] = await Promise.all([
          engine.getRecommendations({
            listenerId: params.listenerId,
            type: 'mood_based',
            context: {},
            limit: Math.ceil(limit * 0.6),
            excludeAssetIds: [],
          }),
          engine.getRecommendations({
            listenerId: params.listenerId,
            type: 'artist_affinity',
            context: {},
            limit: Math.ceil(limit * 0.4),
            excludeAssetIds: [],
          }),
        ])

        return mergeRecommendations([moodBased, artistAffinity], limit)
      })
    },

    /**
     * Get trending content based on real-time signals.
     */
    async getTrending(params: {
      orgId: string
      userId: string
      limit?: number
    }): Promise<readonly TrendingScore[]> {
      const limit = params.limit ?? 50

      // Trending is not per-user, but scoped to org
      const cached = await cache.get(params.orgId, '__global__', 'trending')
      if (cached) {
        return cached.items.slice(0, limit).map((item) => ({
          assetId: item.assetId,
          score: item.score,
          velocity: (item.metadata.velocity as number) ?? 0,
        }))
      }

      const signals = await trending.getSignals(params.orgId, 200)
      const scores = computeTrendingScores(signals)

      // Cache as RecommendationItems for uniform caching
      const asItems: RecommendationItem[] = scores.map((s) => ({
        assetId: s.assetId,
        score: s.score,
        reason: s.velocity > 5 ? 'Rising fast' : 'Popular now',
        metadata: { velocity: s.velocity },
      }))
      await cache.set(params.orgId, '__global__', 'trending', asItems, CACHE_TTL.trending)

      return scores.slice(0, limit)
    },

    /**
     * Get similar tracks to a seed track.
     */
    async getSimilar(params: {
      orgId: string
      listenerId: string
      seedAssetId: string
      genre?: string
      limit?: number
    }): Promise<readonly RecommendationItem[]> {
      const limit = params.limit ?? 20
      const request = buildSimilarTracksRequest({
        listenerId: params.listenerId,
        seedAssetId: params.seedAssetId,
        genre: params.genre,
        limit,
      })

      const response = await engine.getRecommendations(request)
      return filterRecommendations(response.items, { minScore: 0.1, limit })
    },

    /**
     * Get regional/city discovery.
     */
    async getRegionalDiscovery(params: {
      orgId: string
      listenerId: string
      region: string
      limit?: number
    }): Promise<readonly RecommendationItem[]> {
      const limit = params.limit ?? 30

      return getOrCompute(params.orgId, params.listenerId, 'city', async () => {
        const request = buildRegionalDiscoveryRequest({
          listenerId: params.listenerId,
          region: params.region as any,
          limit,
        })
        const response = await engine.getRecommendations(request)
        return filterRecommendations(response.items, { limit })
      })
    },

    /**
     * Session continuation — what to play next.
     * Short TTL, highly contextual.
     */
    async getSessionContinuation(params: {
      orgId: string
      listenerId: string
      recentAssetIds: readonly string[]
      limit?: number
    }): Promise<readonly RecommendationItem[]> {
      const limit = params.limit ?? 10
      const request = buildSessionContinuationRequest({
        listenerId: params.listenerId,
        recentAssetIds: params.recentAssetIds,
        limit,
      })

      // No caching for session continuation — too ephemeral
      const response = await engine.getRecommendations(request)
      return filterRecommendations(response.items, { limit })
    },

    /**
     * Invalidate cached recommendations for a user.
     * Called when user behavior shifts significantly (e.g., new follow, genre change).
     */
    async invalidateCache(
      orgId: string,
      userId: string,
      surface?: RecommendationSurface,
    ): Promise<void> {
      await cache.invalidate(orgId, userId, surface)
    },
  }
}
