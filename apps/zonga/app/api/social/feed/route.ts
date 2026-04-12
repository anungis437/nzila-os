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
import {
  composeFeed,
  type RawFeedActivity,
  type FeedEnrichmentPort,
  type ActorProfile,
  type ContentPreview,
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
          a.entity_id as "contentId",
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
        contentId: string
        metadata: Record<string, unknown> | null
        createdAt: string
        actorId: string
      }>

      const activities: RawFeedActivity[] = rawRows.map((r) => ({
        id: r.id,
        userId: r.actorId,
        activityType: r.activityType,
        contentId: r.contentId,
        entityType: r.entityType,
        metadata: r.metadata ?? {},
        createdAt: new Date(r.createdAt).toISOString(),
      }))

      // 2. Build enrichment port
      const enrichmentPort: FeedEnrichmentPort = {
        resolveActors: async (actorIds: readonly string[]): Promise<ReadonlyMap<string, ActorProfile>> => {
          if (actorIds.length === 0) return new Map()
          const rows = await platformDb.execute(sql`
            SELECT user_id as id, display_name as "displayName", avatar_url as "avatarUrl"
            FROM zonga_listeners
            WHERE user_id = ANY(${[...actorIds]}::text[])
          `) as Array<{ id: string; displayName: string; avatarUrl: string | null }>
          const map = new Map<string, ActorProfile>()
          for (const r of rows) {
            map.set(r.id, {
              userId: r.id,
              displayName: r.displayName ?? 'Unknown',
              avatarUrl: r.avatarUrl,
              isVerified: false,
            })
          }
          return map
        },

        resolveContent: async (contentIds: readonly string[]): Promise<ReadonlyMap<string, ContentPreview>> => {
          if (contentIds.length === 0) return new Map()
          const rows = await platformDb.execute(sql`
            SELECT id, title, creator_id as "artistId",
                   metadata_json->>'coverUrl' as "coverUrl",
                   metadata_json->>'genre' as genre
            FROM zonga_content_assets
            WHERE id = ANY(${[...contentIds]}::uuid[])
          `) as Array<{ id: string; title: string; artistId: string; coverUrl: string | null; genre: string | null }>
          const map = new Map<string, ContentPreview>()
          for (const r of rows) {
            map.set(r.id, {
              contentId: r.id,
              contentType: 'track',
              title: r.title ?? 'Unknown',
              subtitle: r.genre,
              imageUrl: r.coverUrl,
            })
          }
          return map
        },
      }

      // 3. Compose the feed
      const sections = await composeFeed(
        { activities, feedType: 'following', limit },
        enrichmentPort,
      )

      const totalItems = sections.reduce((n, s) => n + s.items.length, 0)

      return NextResponse.json({
        ok: true,
        data: {
          sections,
          totalItems,
          hasMore: rawRows.length >= limit * 2,
          cursor: rawRows.length > 0 ? rawRows[rawRows.length - 1]!.createdAt : undefined,
        },
      })
    }),
  )
}
