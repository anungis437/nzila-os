/**
 * API — /api/social/feed
 *
 * GET → Enriched social activity feed for the current listener.
 *       Uses zonga-growth feed-composer: deduplication, actor/content enrichment,
 *       grouping ("John and 3 others liked…"), trending interleaving, time bucketing.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  composeFeed,
  type RawFeedActivity,
  type FeedEnrichmentPort,
} from '@nzila/zonga-growth'

export async function GET(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.social.feed', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100)
      const before = url.searchParams.get('before') ?? undefined

      // 1. Fetch raw activities from followed creators + own activity
      const beforeClause = before ? sql`AND a.created_at < ${before}::timestamptz` : sql``

      const rawRows = (await platformDb.execute(sql`
        SELECT
          a.id,
          a.activity_type as "activityType",
          a.entity_type as "entityType",
          a.entity_id as "entityId",
          a.metadata_json as "metadata",
          a.created_at as "createdAt",
          l.user_id as "actorId"
        FROM zonga_listener_activity a
        JOIN zonga_listeners l ON l.id = a.listener_id
        WHERE (
          -- Own activity
          l.user_id = ${ctx.userId}
          OR
          -- Activity from creators the user follows
          a.listener_id IN (
            SELECT f.creator_id FROM zonga_listener_follows f
            JOIN zonga_listeners fl ON fl.id = f.listener_id
            WHERE fl.user_id = ${ctx.userId}
          )
        )
        ${beforeClause}
        ORDER BY a.created_at DESC
        LIMIT ${limit * 2}
      `)) as Array<{
        id: string
        activityType: string
        entityType: string
        entityId: string
        metadata: Record<string, unknown> | null
        createdAt: string
        actorId: string
      }>

      const activities: RawFeedActivity[] = rawRows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        type: r.activityType as RawFeedActivity['type'],
        contentId: r.entityId,
        contentType: r.entityType,
        metadata: r.metadata ?? undefined,
        createdAt: new Date(r.createdAt),
      }))

      // 2. Build enrichment port
      const enrichmentPort: FeedEnrichmentPort = {
        resolveActors: async (actorIds: string[]) => {
          if (actorIds.length === 0) return []
          const rows = await platformDb.execute(sql`
            SELECT user_id as id, display_name as "displayName", avatar_url as "avatarUrl"
            FROM zonga_listeners
            WHERE user_id = ANY(${actorIds}::text[])
          `) as Array<{ id: string; displayName: string; avatarUrl: string | null }>
          return rows.map((r) => ({
            id: r.id,
            displayName: r.displayName ?? 'Unknown',
            avatarUrl: r.avatarUrl ?? undefined,
          }))
        },

        resolveContent: async (contentIds: string[]) => {
          if (contentIds.length === 0) return []
          const rows = await platformDb.execute(sql`
            SELECT id, title, creator_id as "artistId",
                   metadata_json->>'coverUrl' as "coverUrl",
                   metadata_json->>'genre' as genre
            FROM zonga_content_assets
            WHERE id = ANY(${contentIds}::uuid[])
          `) as Array<{ id: string; title: string; artistId: string; coverUrl: string | null; genre: string | null }>
          return rows.map((r) => ({
            id: r.id,
            title: r.title ?? 'Unknown',
            coverUrl: r.coverUrl ?? undefined,
            artistName: r.artistId,
          }))
        },

        getTrendingItems: async (count: number) => {
          const rows = await platformDb.execute(sql`
            SELECT entity_id as id, COUNT(*) as plays
            FROM zonga_listener_activity
            WHERE activity_type = 'play' AND created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY entity_id
            ORDER BY plays DESC
            LIMIT ${count}
          `) as Array<{ id: string; plays: number }>
          return rows.map((r) => ({
            id: r.id,
            type: 'trending' as const,
            title: `Trending #${rows.indexOf(r) + 1}`,
            score: Number(r.plays),
          }))
        },

        getRecommendations: async (userId: string, count: number) => {
          // Simple recommendation: most-played assets the user hasn't heard
          const rows = await platformDb.execute(sql`
            SELECT a.id, a.title, COUNT(la.id) as popularity
            FROM zonga_content_assets a
            LEFT JOIN zonga_listener_activity la ON la.entity_id = a.id AND la.activity_type = 'play'
            WHERE a.status = 'published'
              AND a.id NOT IN (
                SELECT entity_id FROM zonga_listener_activity
                WHERE listener_id IN (SELECT id FROM zonga_listeners WHERE user_id = ${userId})
                  AND activity_type = 'play'
              )
            GROUP BY a.id, a.title
            ORDER BY popularity DESC
            LIMIT ${count}
          `) as Array<{ id: string; title: string; popularity: number }>
          return rows.map((r) => ({
            id: r.id,
            type: 'recommendation' as const,
            title: r.title,
            score: Number(r.popularity),
          }))
        },
      }

      // 3. Compose the feed
      const feed = await composeFeed({
        activities,
        enrichmentPort,
        maxItems: limit,
        currentUserId: ctx.userId,
      })

      return NextResponse.json({
        ok: true,
        data: {
          sections: feed.sections,
          totalItems: feed.totalItems,
          hasMore: rawRows.length >= limit * 2,
          cursor: rawRows.length > 0 ? rawRows[rawRows.length - 1]!.createdAt : undefined,
        },
      })
    }),
  )
}
