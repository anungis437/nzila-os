/**
 * @nzila/zonga-growth — Discovery Endpoints
 *
 * API-layer service that composes recommendation surfaces into
 * discovery responses for the client. Handles pagination, context
 * enrichment, and A/B experiment routing.
 *
 * @module @nzila/zonga-growth/discovery
 */

import type { RecommendationItem } from '@nzila/zonga-core/types'
import type { TrendingScore, RecommendationSurface } from './recommendations'

// ── Types ───────────────────────────────────────────────────────────────────

export interface DiscoverySection {
  readonly id: string
  readonly title: string
  readonly surface: RecommendationSurface
  readonly items: readonly DiscoveryItem[]
  readonly hasMore: boolean
}

export interface DiscoveryItem {
  readonly assetId: string
  readonly score: number
  readonly reason: string
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface DiscoveryFeed {
  readonly sections: readonly DiscoverySection[]
  readonly generatedAt: string
}

export interface DiscoveryQuery {
  readonly orgId: string
  readonly userId: string
  readonly surface?: RecommendationSurface
  readonly region?: string
  readonly seedAssetId?: string
  readonly recentAssetIds?: readonly string[]
  readonly limit?: number
  readonly offset?: number
}

// ── Discovery Port ──────────────────────────────────────────────────────────

/** Port encapsulating the recommendation service's public methods. */
export interface RecommendationPort {
  getForYou(params: {
    orgId: string
    listenerId: string
    limit?: number
  }): Promise<readonly RecommendationItem[]>

  getTrending(params: {
    orgId: string
    userId: string
    limit?: number
  }): Promise<readonly TrendingScore[]>

  getSimilar(params: {
    orgId: string
    listenerId: string
    seedAssetId: string
    genre?: string
    limit?: number
  }): Promise<readonly RecommendationItem[]>

  getRegionalDiscovery(params: {
    orgId: string
    listenerId: string
    region: string
    limit?: number
  }): Promise<readonly RecommendationItem[]>

  getSessionContinuation(params: {
    orgId: string
    listenerId: string
    recentAssetIds: readonly string[]
    limit?: number
  }): Promise<readonly RecommendationItem[]>
}

// ── Pure Helpers ────────────────────────────────────────────────────────────

/** Converts RecommendationItems to DiscoveryItems. */
export function toDiscoveryItems(
  items: readonly RecommendationItem[],
): readonly DiscoveryItem[] {
  return items.map((item) => ({
    assetId: item.assetId,
    score: item.score,
    reason: item.reason,
    metadata: item.metadata,
  }))
}

/** Converts TrendingScores to DiscoveryItems. */
export function trendingToDiscoveryItems(
  scores: readonly TrendingScore[],
): readonly DiscoveryItem[] {
  return scores.map((s) => ({
    assetId: s.assetId,
    score: s.score,
    reason: s.velocity > 5 ? 'Rising fast' : 'Popular now',
    metadata: { velocity: s.velocity },
  }))
}

// ── Discovery Service ───────────────────────────────────────────────────────

export function createDiscoveryService(deps: { reco: RecommendationPort }) {
  const { reco } = deps

  return {
    /**
     * Full discovery feed — multiple sections for the home screen.
     * Used by /discover endpoint.
     */
    async getDiscoveryFeed(params: {
      orgId: string
      userId: string
      region?: string
    }): Promise<DiscoveryFeed> {
      const sectionLimit = 15

      // Fan out to multiple surfaces in parallel
      const [forYou, trending, regional] = await Promise.all([
        reco.getForYou({
          orgId: params.orgId,
          listenerId: params.userId,
          limit: sectionLimit,
        }),
        reco.getTrending({
          orgId: params.orgId,
          userId: params.userId,
          limit: sectionLimit,
        }),
        params.region
          ? reco.getRegionalDiscovery({
              orgId: params.orgId,
              listenerId: params.userId,
              region: params.region,
              limit: sectionLimit,
            })
          : Promise.resolve([] as readonly RecommendationItem[]),
      ])

      const sections: DiscoverySection[] = [
        {
          id: 'for_you',
          title: 'For You',
          surface: 'for_you',
          items: toDiscoveryItems(forYou),
          hasMore: forYou.length >= sectionLimit,
        },
        {
          id: 'trending',
          title: 'Trending Now',
          surface: 'trending',
          items: trendingToDiscoveryItems(trending),
          hasMore: trending.length >= sectionLimit,
        },
      ]

      if (regional.length > 0) {
        sections.push({
          id: 'city',
          title: 'Sounds of Your City',
          surface: 'city',
          items: toDiscoveryItems(regional),
          hasMore: regional.length >= sectionLimit,
        })
      }

      return {
        sections,
        generatedAt: new Date().toISOString(),
      }
    },

    /**
     * Single surface query — paginated.
     * Used by /discover/:surface endpoint.
     */
    async querySurface(query: DiscoveryQuery): Promise<DiscoverySection> {
      const surface = query.surface ?? 'for_you'
      const limit = Math.min(query.limit ?? 30, 100)

      let items: readonly DiscoveryItem[]

      switch (surface) {
        case 'for_you': {
          const raw = await reco.getForYou({
            orgId: query.orgId,
            listenerId: query.userId,
            limit,
          })
          items = toDiscoveryItems(raw)
          break
        }
        case 'trending': {
          const raw = await reco.getTrending({
            orgId: query.orgId,
            userId: query.userId,
            limit,
          })
          items = trendingToDiscoveryItems(raw)
          break
        }
        case 'city': {
          const raw = await reco.getRegionalDiscovery({
            orgId: query.orgId,
            listenerId: query.userId,
            region: query.region ?? '',
            limit,
          })
          items = toDiscoveryItems(raw)
          break
        }
        case 'similar': {
          if (!query.seedAssetId) throw new Error('seedAssetId required for similar surface')
          const raw = await reco.getSimilar({
            orgId: query.orgId,
            listenerId: query.userId,
            seedAssetId: query.seedAssetId,
            limit,
          })
          items = toDiscoveryItems(raw)
          break
        }
        case 'session': {
          const raw = await reco.getSessionContinuation({
            orgId: query.orgId,
            listenerId: query.userId,
            recentAssetIds: query.recentAssetIds ?? [],
            limit,
          })
          items = toDiscoveryItems(raw)
          break
        }
        default: {
          const raw = await reco.getForYou({
            orgId: query.orgId,
            listenerId: query.userId,
            limit,
          })
          items = toDiscoveryItems(raw)
        }
      }

      return {
        id: surface,
        title: surfaceTitle(surface),
        surface,
        items,
        hasMore: items.length >= limit,
      }
    },
  }
}

function surfaceTitle(surface: RecommendationSurface): string {
  const titles: Record<RecommendationSurface, string> = {
    trending: 'Trending Now',
    for_you: 'For You',
    city: 'Sounds of Your City',
    new_releases: 'New Releases',
    similar: 'Similar Tracks',
    session: 'Up Next',
  }
  return titles[surface]
}
