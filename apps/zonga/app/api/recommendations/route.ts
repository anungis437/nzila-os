/**
 * API — /api/recommendations
 *
 * GET → Personalized recommendations for the current listener.
 *       Uses zonga-intelligence (collaborative filtering + content similarity + trending)
 *       with a per-user LRU cache for performance.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  createRecommendationEngine,
  createRecommendationCache,
  scoreTrendingItems,
  type RecommendationPorts,
  type TrendingInput,
  type SignalType,
} from '@nzila/zonga-intelligence'

// ── Module-level singletons ─────────────────────────────────────────────────
const cache = createRecommendationCache({
  maxEntries: 5000,
  defaultTtlMs: 5 * 60 * 1000,
  strategyTtlMs: {},
})

export async function GET(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.recommendations.get', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 50)
      const strategy = url.searchParams.get('strategy') ?? 'hybrid'
      const region = url.searchParams.get('region') ?? undefined

      // Check cache first
      const cacheKey = `reco:${ctx.userId}:${strategy}:${region ?? 'global'}:${limit}`
      const cached = cache.get(cacheKey)
      if (cached) {
        return NextResponse.json({ ok: true, data: { recommendations: cached.recommendations, source: 'cache' } })
      }

      // Build recommendation ports from DB
      const ports: RecommendationPorts = {
        fetchUserSignals: async (userId: string, _maxAgeDays: number) => {
          const rows = await platformDb.execute(sql`
            SELECT entity_id as "itemId", activity_type as "signalType",
                   CASE activity_type
                     WHEN 'play' THEN 1.0
                     WHEN 'favorite' THEN 0.8
                     WHEN 'share' THEN 0.7
                     WHEN 'skip' THEN -0.3
                     ELSE 0.5
                   END as weight,
                   created_at as timestamp
            FROM zonga_listener_activity
            WHERE listener_id IN (
              SELECT id FROM zonga_listeners WHERE user_id = ${userId}
            )
            ORDER BY created_at DESC LIMIT 200
          `) as Array<{ itemId: string; signalType: string; weight: number; timestamp: string }>
          return rows.map((r) => ({
            userId,
            signalType: r.signalType as SignalType,
            targetId: r.itemId,
            targetType: 'track' as const,
            weight: Number(r.weight),
            timestamp: new Date(r.timestamp),
          }))
        },

        fetchTrendingItems: async (region: string, _itemType, count: number) => {
          const rows = await platformDb.execute(sql`
            SELECT entity_id as "itemId",
                   COUNT(*) as volume,
                   COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as "recentPlays",
                   MAX(created_at) as "lastActivity"
            FROM zonga_listener_activity
            WHERE activity_type = 'play'
              AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY entity_id
            ORDER BY "recentPlays" DESC
            LIMIT ${count}
          `) as Array<{ itemId: string; volume: number; recentPlays: number; lastActivity: string }>

          const inputs: TrendingInput[] = rows.map((r) => ({
            itemId: r.itemId,
            itemType: 'track' as const,
            region,
            currentCount: Number(r.recentPlays),
            previousCount: Math.max(1, Number(r.volume) - Number(r.recentPlays)),
            lastInteractionAt: new Date(r.lastActivity).getTime(),
            totalCount: Number(r.volume),
          }))

          const scored = scoreTrendingItems(inputs)
          return scored.slice(0, count)
        },

        fetchContentSimilar: async (itemIds: readonly string[], _itemType, count: number) => {
          if (itemIds.length === 0) return []
          const rows = await platformDb.execute(sql`
            SELECT id, title, creator_id as "artistId",
                   metadata_json->>'genre' as genre,
                   metadata_json->>'mood' as mood
            FROM zonga_content_assets
            WHERE id = ANY(${[...itemIds]}::uuid[]) AND status = 'published'
            LIMIT ${count}
          `) as Array<{ id: string; title: string; artistId: string; genre: string | null; mood: string | null }>
          return rows.map((r) => ({
            sourceItemId: itemIds[0]!,
            targetItemId: r.id,
            targetItemType: 'track' as const,
            similarityScore: 0.5,
            sharedAttributes: [r.genre, r.mood].filter(Boolean) as string[],
          }))
        },

        fetchUserRegion: async (_userId: string) => {
          return region ?? 'global'
        },
      }

      const engine = createRecommendationEngine(ports)

      try {
        const result = await engine.recommend({
          userId: ctx.userId,
          targetType: 'track',
          limit,
          strategy: (strategy === 'content' ? 'content_based' : strategy) as 'collaborative' | 'content_based' | 'trending' | 'hybrid',
        })

        const recommendations = result.recommendations ?? []

        // Cache the result
        cache.set(cacheKey, result)

        return NextResponse.json({
          ok: true,
          data: {
            recommendations,
            strategy: result.strategy ?? strategy,
            source: 'computed',
            count: recommendations.length,
          },
        })
      } catch (error) {
        logger.error('Recommendation engine failed', { error, userId: ctx.userId })
        return NextResponse.json({ ok: false, error: 'Failed to generate recommendations' }, { status: 500 })
      }
    }),
  )
}
