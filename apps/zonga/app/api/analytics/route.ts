/**
 * Zonga Creator Analytics API
 *
 * GET  /api/analytics — Returns creator revenue, engagement, and performance metrics.
 * POST /api/analytics — Ingest an analytics event (play, skip, search, share, session).
 * Org-scoped, auth-gated, evidence-backed.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import {
  createPlayEvent,
  createSkipEvent,
  createSearchEvent,
  createShareEvent,
  createSessionEvent,
  type AnalyticsEvent,
} from '@nzila/zonga-analytics'
import { z } from 'zod'
import { recordZongaPlaybackWatch } from '@/lib/pilot-metrics'

const IngestSchema = z.object({
  type: z.enum(['play', 'skip', 'search', 'share', 'session']),
  userId: z.string().uuid(),
  data: z.record(z.unknown()),
})

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)d$/)
  return match ? Number(match[1]) : 30
}

export async function GET(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.analytics.get', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const creatorId = url.searchParams.get('creatorId')
      const period = url.searchParams.get('period') ?? '30d'
      const view = url.searchParams.get('view') ?? 'creator'

      const periodDays = parsePeriod(period)
      const since = new Date(Date.now() - periodDays * 86_400_000)
      const sinceIso = since.toISOString()

      if (view === 'admin') {
        // Admin dashboard — platform-wide metrics
        const [dauRows, mauRows, revenueRows, listenerRows] = await Promise.all([
          platformDb.execute(sql`
            SELECT DATE(created_at) as date, COUNT(DISTINCT listener_id) as count
            FROM zonga_listener_activity
            WHERE created_at >= ${sinceIso}::timestamptz
            GROUP BY DATE(created_at) ORDER BY date
          `) as Promise<Array<{ date: string; count: number }>>,
          platformDb.execute(sql`
            SELECT COUNT(DISTINCT listener_id) as count
            FROM zonga_listener_activity
            WHERE created_at >= ${sinceIso}::timestamptz
          `) as Promise<Array<{ count: number }>>,
          platformDb.execute(sql`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM zonga_revenue_events
            WHERE created_at >= ${sinceIso}::timestamptz AND org_id = ${ctx.orgId}
          `) as Promise<Array<{ total: number }>>,
          platformDb.execute(sql`
            SELECT COUNT(*) as total FROM zonga_listeners
            WHERE created_at >= ${sinceIso}::timestamptz
          `) as Promise<Array<{ total: number }>>,
        ])

        const adminData = {
          dauTimeSeries: dauRows.map((r) => ({ date: String(r.date), count: Number(r.count) })),
          mauCount: Number(mauRows[0]?.count ?? 0),
          platformRevenue: Number(revenueRows[0]?.total ?? 0),
          newListeners: Number(listenerRows[0]?.total ?? 0),
        }

        return NextResponse.json({ ok: true, data: { view: 'admin', period, periodDays, ...adminData } })
      }

      // Creator dashboard — scoped to a specific creator or the current user
      const targetCreator = creatorId ?? ctx.userId
      const [streamRows, revenueRow, listenerRow, geoRows, dailyRows] = await Promise.all([
        platformDb.execute(sql`
          SELECT COUNT(*) as total FROM zonga_listener_activity
          WHERE entity_type = 'asset' AND activity_type = 'play'
            AND created_at >= ${sinceIso}::timestamptz
            AND entity_id IN (
              SELECT id FROM zonga_content_assets WHERE creator_id = ${targetCreator} AND org_id = ${ctx.orgId}
            )
        `) as Promise<Array<{ total: number }>>,
        platformDb.execute(sql`
          SELECT COALESCE(SUM(amount), 0) as total FROM zonga_revenue_events
          WHERE target_entity_id IN (
            SELECT id FROM zonga_content_assets WHERE creator_id = ${targetCreator} AND org_id = ${ctx.orgId}
          ) AND created_at >= ${sinceIso}::timestamptz
        `) as Promise<Array<{ total: number }>>,
        platformDb.execute(sql`
          SELECT COUNT(DISTINCT listener_id) as total FROM zonga_listener_activity
          WHERE entity_type = 'asset' AND activity_type = 'play'
            AND entity_id IN (
              SELECT id FROM zonga_content_assets WHERE creator_id = ${targetCreator} AND org_id = ${ctx.orgId}
            ) AND created_at >= ${sinceIso}::timestamptz
        `) as Promise<Array<{ total: number }>>,
        platformDb.execute(sql`
          SELECT l.country, COUNT(*) as plays FROM zonga_listener_activity a
          JOIN zonga_listeners l ON l.id = a.listener_id
          WHERE a.entity_type = 'asset' AND a.activity_type = 'play'
            AND a.entity_id IN (
              SELECT id FROM zonga_content_assets WHERE creator_id = ${targetCreator} AND org_id = ${ctx.orgId}
            ) AND a.created_at >= ${sinceIso}::timestamptz
          GROUP BY l.country ORDER BY plays DESC LIMIT 20
        `) as Promise<Array<{ country: string; plays: number }>>,
        platformDb.execute(sql`
          SELECT DATE(created_at) as date, COUNT(*) as streams FROM zonga_listener_activity
          WHERE entity_type = 'asset' AND activity_type = 'play'
            AND entity_id IN (
              SELECT id FROM zonga_content_assets WHERE creator_id = ${targetCreator} AND org_id = ${ctx.orgId}
            ) AND created_at >= ${sinceIso}::timestamptz
          GROUP BY DATE(created_at) ORDER BY date
        `) as Promise<Array<{ date: string; streams: number }>>,
      ])

      const creatorData = {
        totalStreams: Number(streamRows[0]?.total ?? 0),
        totalRevenue: Number(revenueRow[0]?.total ?? 0),
        uniqueListeners: Number(listenerRow[0]?.total ?? 0),
        topCountries: geoRows.map((r) => ({ country: String(r.country ?? 'Unknown'), plays: Number(r.plays) })),
        dailyStreams: dailyRows.map((r) => ({ date: String(r.date), streams: Number(r.streams) })),
      }

      return NextResponse.json({ ok: true, data: { view: 'creator', period, periodDays, creatorId: targetCreator, ...creatorData } })
    }),
  )
}

export async function POST(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('zonga.analytics.ingest', { 'http.method': 'POST' }, async () => {
      const body = await request.json()
      const parsed = IngestSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Invalid event payload', details: parsed.error.flatten() }, { status: 400 })
      }

      const { type, userId, data } = parsed.data
      let event: AnalyticsEvent

      // orgId is from the current org scope
      const orgId = ctx.orgId

      switch (type) {
        case 'play':
          event = createPlayEvent(orgId, userId, {
            assetId: String(data.trackId ?? ''),
            creatorId: String(data.artistId ?? ''),
            durationMs: Number(data.durationMs ?? 0),
            positionMs: Number(data.listenedMs ?? 0),
            completionPercent: Number(data.durationMs) > 0
              ? Math.round((Number(data.listenedMs ?? 0) / Number(data.durationMs)) * 100)
              : 0,
            quality: String(data.quality ?? 'standard'),
            isComplete: Number(data.listenedMs ?? 0) >= Number(data.durationMs ?? 1) * 0.9,
            source: (data.source as 'search' | 'recommendation' | 'playlist' | 'direct' | 'share' | 'radio') ?? 'direct',
          })
          break
        case 'skip':
          event = createSkipEvent(orgId, userId, {
            assetId: String(data.trackId ?? ''),
            creatorId: String(data.artistId ?? ''),
            positionMs: Number(data.skipAtMs ?? 0),
            durationMs: Number(data.totalDurationMs ?? 0),
            reason: (data.reason as 'manual' | 'queue_next' | 'dislike') ?? 'manual',
          })
          break
        case 'search':
          event = createSearchEvent(orgId, userId, {
            query: String(data.query ?? ''),
            resultCount: Number(data.resultCount ?? 0),
            selectedIndex: data.selectedIndex != null ? Number(data.selectedIndex) : null,
            selectedAssetId: data.selectedAssetId != null ? String(data.selectedAssetId) : null,
            latencyMs: Number(data.latencyMs ?? 0),
          })
          break
        case 'share':
          event = createShareEvent(orgId, userId, {
            entityType: (data.contentType as 'track' | 'playlist' | 'artist' | 'event') ?? 'track',
            contentId: String(data.contentId ?? ''),
            platform: (data.platform as 'whatsapp' | 'twitter' | 'facebook' | 'copy_link' | 'other') ?? 'other',
            deepLink: String(data.deepLink ?? ''),
          })
          break
        case 'session':
          event = createSessionEvent(orgId, userId, 'session_start', {
            sessionId: String(data.sessionId ?? crypto.randomUUID()),
            durationMs: Number(data.durationMs ?? 0),
            tracksPlayed: Number(data.tracksPlayed ?? 0),
            searchCount: Number(data.searchCount ?? 0),
          })
          break
      }

      // Persist event to the activity log
      await platformDb.execute(sql`
        INSERT INTO zonga_analytics_events (event_type, user_id, payload, created_at)
        VALUES (${event.type}, ${userId}, ${JSON.stringify(event)}::jsonb, ${event.timestamp}::timestamptz)
      `)

      if (type === 'play') {
        const listenedMs = Number((parsed.data.data.listenedMs as number | undefined) ?? 0)
        const playbackSource = String(parsed.data.data.source ?? 'direct')
        const replayFlag = playbackSource === 'replay' || Boolean(parsed.data.data.isReplay)
        const assetId = String(parsed.data.data.trackId ?? '')

        if (assetId) {
          recordZongaPlaybackWatch(orgId, assetId, listenedMs, userId, event.id, replayFlag).catch(() => {
            // Keep analytics ingestion resilient; metric failures are non-blocking.
          })
        }
      }

      return NextResponse.json({ ok: true, data: { eventId: event.id } }, { status: 201 })
    }),
  )
}
