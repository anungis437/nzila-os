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
} from '@nzila/zonga-intelligence'

// ── Module-level singletons ─────────────────────────────────────────────────
const cache = createRecommendationCache({ maxEntries: 5000 })

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
        return NextResponse.json({ ok: true, data: { recommendations: cached.data, source: 'cache' } })
      }

      // Build recommendation ports from DB
      const ports: RecommendationPorts = {
        getUserSignals: async (userId: string) => {
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
            itemId: r.itemId,
            signalType: r.signalType as 'play' | 'skip' | 'like' | 'save' | 'share' | 'search',
            weight: Number(r.weight),
            timestamp: new Date(r.timestamp),
          }))
        },

        getSimilarUsers: async (userId: string, topK: number) => {
          // Find users who liked similar content (collaborative filtering)
          const rows = await platformDb.execute(sql`
            SELECT other.user_id as "userId", COUNT(*) as overlap
            FROM zonga_listener_activity my
            JOIN zonga_listener_activity other
              ON my.entity_id = other.entity_id
              AND my.activity_type = other.activity_type
            JOIN zonga_listeners other_l ON other_l.id = other.listener_id
            JOIN zonga_listeners my_l ON my_l.id = my.listener_id
            WHERE my_l.user_id = ${userId}
              AND other_l.user_id != ${userId}
              AND my.activity_type IN ('play', 'favorite')
            GROUP BY other.user_id
            ORDER BY overlap DESC
            LIMIT ${topK}
          `) as Array<{ userId: string; overlap: number }>
          return rows.map((r) => r.userId)
        },

        getItemMetadata: async (itemIds: string[]) => {
          if (itemIds.length === 0) return []
          const rows = await platformDb.execute(sql`
            SELECT id, title, creator_id as "artistId",
                   metadata_json->>'genre' as genre,
                   metadata_json->>'mood' as mood,
                   metadata_json->>'bpm' as bpm,
                   created_at as "releaseDate"
            FROM zonga_content_assets
            WHERE id = ANY(${itemIds}::uuid[]) AND status = 'published'
          `) as Array<{
            id: string
            title: string
            artistId: string
            genre: string | null
            mood: string | null
            bpm: string | null
            releaseDate: string
          }>
          return rows.map((r) => ({
            itemId: r.id,
            title: r.title,
            artistId: r.artistId,
            genres: r.genre ? [r.genre] : [],
            moods: r.mood ? [r.mood] : [],
            bpm: r.bpm ? Number(r.bpm) : undefined,
            releaseDate: new Date(r.releaseDate),
          }))
        },

        getTrendingItems: async (count: number) => {
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
            currentPeriodPlays: Number(r.recentPlays),
            previousPeriodPlays: Math.max(1, Number(r.volume) - Number(r.recentPlays)),
            totalPlays: Number(r.volume),
            lastActivityAt: new Date(r.lastActivity),
          }))

          const scored = scoreTrendingItems(inputs)
          return scored.slice(0, count).map((s) => ({
            itemId: s.itemId,
            score: s.score,
          }))
        },
      }

      const engine = createRecommendationEngine(ports)

      try {
        const result = await engine.recommend({
          userId: ctx.userId,
          count: limit,
          strategy: strategy as 'collaborative' | 'content' | 'trending' | 'hybrid',
        })

        const recommendations = result.items ?? []

        // Cache the result
        cache.set(cacheKey, recommendations, strategy as 'collaborative' | 'content' | 'trending' | 'hybrid')

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
