/**
 * @nzila/zonga-core — Recommendation Service
 *
 * Pure helpers for building recommendation requests, scoring items,
 * and filtering results. The actual ML/AI inference is a port
 * injected at the app layer.
 *
 * Zero I/O — callers supply data.
 *
 * @module @nzila/zonga-core/services/recommendations
 */

import type { RecommendationType, MoodTag, RegionTag } from '../enums'
import type { RecommendationRequest, RecommendationResponse, RecommendationItem } from '../types/index'

// ── Recommendation Port ─────────────────────────────────────────────────────

/** Port for recommendation inference — implemented by the app layer. */
export interface RecommendationEngine {
  /** Get personalized recommendations for a listener. */
  getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse>
}

// ── Filtering ───────────────────────────────────────────────────────────────

/**
 * Filters recommendation items, removing excluded asset IDs and
 * items below a minimum score threshold.
 */
export function filterRecommendations(
  items: readonly RecommendationItem[],
  params: {
    excludeAssetIds?: readonly string[]
    minScore?: number
    limit?: number
  },
): readonly RecommendationItem[] {
  const excludeSet = new Set(params.excludeAssetIds ?? [])
  const minScore = params.minScore ?? 0

  let filtered = items.filter(
    (item) => !excludeSet.has(item.assetId) && item.score >= minScore,
  )

  if (params.limit !== undefined && params.limit > 0) {
    filtered = filtered.slice(0, params.limit)
  }

  return filtered
}

/**
 * Merges multiple recommendation responses, de-duplicating by assetId
 * and keeping the highest-scored version of each item.
 */
export function mergeRecommendations(
  responses: readonly RecommendationResponse[],
  limit: number = 50,
): readonly RecommendationItem[] {
  const bestByAsset = new Map<string, RecommendationItem>()

  for (const response of responses) {
    for (const item of response.items) {
      const existing = bestByAsset.get(item.assetId)
      if (!existing || item.score > existing.score) {
        bestByAsset.set(item.assetId, item)
      }
    }
  }

  return Array.from(bestByAsset.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ── Context Builders ────────────────────────────────────────────────────────

/**
 * Builds a recommendation request for "similar tracks" based on
 * a seed track's metadata.
 */
export function buildSimilarTracksRequest(params: {
  listenerId: string
  seedAssetId: string
  genre?: string
  mood?: MoodTag
  region?: RegionTag
  limit?: number
}): RecommendationRequest {
  return {
    listenerId: params.listenerId,
    type: 'similar_tracks',
    context: {
      seedAssetId: params.seedAssetId,
      genre: params.genre,
      mood: params.mood,
      region: params.region,
    },
    limit: params.limit ?? 20,
    excludeAssetIds: [params.seedAssetId],
  }
}

/**
 * Builds a recommendation request for regional discovery.
 */
export function buildRegionalDiscoveryRequest(params: {
  listenerId: string
  region: RegionTag
  mood?: MoodTag
  limit?: number
}): RecommendationRequest {
  return {
    listenerId: params.listenerId,
    type: 'regional_discovery',
    context: {
      region: params.region,
      mood: params.mood,
    },
    limit: params.limit ?? 30,
    excludeAssetIds: [],
  }
}

/**
 * Builds a session-continuation request based on current queue state.
 */
export function buildSessionContinuationRequest(params: {
  listenerId: string
  recentAssetIds: readonly string[]
  limit?: number
}): RecommendationRequest {
  return {
    listenerId: params.listenerId,
    type: 'session_continuation',
    context: {
      recentAssetIds: params.recentAssetIds,
    },
    limit: params.limit ?? 10,
    excludeAssetIds: [...params.recentAssetIds],
  }
}
