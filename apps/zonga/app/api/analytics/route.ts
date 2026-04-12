/**
 * Zonga Creator Analytics API
 *
 * GET  /api/analytics — Returns creator revenue, engagement, and performance metrics.
 * POST /api/analytics — Ingest an analytics event (play, skip, search, share, session).
 * Org-scoped, auth-gated, evidence-backed.
 */
import { NextResponse } from 'next/server'
import { withOrgScope, authenticateUser } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import {
  aggregateCreatorDashboard,
  aggregateAdminDashboard,
  createPlayEvent,
  createSkipEvent,
  createSearchEvent,
  createShareEvent,
  createSessionEvent,
  type AnalyticsEvent,
} from '@nzila/zonga-analytics'
import { z } from 'zod'

const IngestSchema = z.object({
  type: z.enum(['play', 'skip', 'search', 'share', 'session']),
  userId: z.string().uuid(),
  data: z.record(z.unknown()),
})

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

        const dashboard = aggregateAdminDashboard({
          dauTimeSeries: dauRows.map((r) => ({ date: String(r.date), count: Number(r.count) })),
          mauCount: Number(mauRows[0]?.count ?? 0),
          platformRevenue: Number(revenueRows[0]?.total ?? 0),
          retentionCohorts: [],
          newListeners: Number(listenerRows[0]?.total ?? 0),
        })

        return NextResponse.json({ ok: true, data: { view: 'admin', period, periodDays, ...dashboard } })
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

      const dashboard = aggregateCreatorDashboard({
        totalStreams: Number(streamRows[0]?.total ?? 0),
        totalRevenue: Number(revenueRow[0]?.total ?? 0),
        uniqueListeners: Number(listenerRow[0]?.total ?? 0),
        topCountries: geoRows.map((r) => ({ country: String(r.country ?? 'Unknown'), plays: Number(r.plays) })),
        dailyStreams: dailyRows.map((r) => ({ date: String(r.date), streams: Number(r.streams) })),
      })

      return NextResponse.json({ ok: true, data: { view: 'creator', period, periodDays, creatorId: targetCreator, ...dashboard } })
    }),
  )
}

export async function POST(request: Request) {
  return withOrgScope(request, () =>
    withSpan('zonga.analytics.ingest', { 'http.method': 'POST' }, async () => {
      const body = await request.json()
      const parsed = IngestSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Invalid event payload', details: parsed.error.flatten() }, { status: 400 })
      }

      const { type, userId, data } = parsed.data
      let event: AnalyticsEvent

      switch (type) {
        case 'play':
          event = createPlayEvent({
            userId,
            trackId: String(data.trackId ?? ''),
            artistId: String(data.artistId ?? ''),
            durationMs: Number(data.durationMs ?? 0),
            listenedMs: Number(data.listenedMs ?? 0),
            quality: String(data.quality ?? 'standard'),
            source: String(data.source ?? 'unknown'),
          })
          break
        case 'skip':
          event = createSkipEvent({
            userId,
            trackId: String(data.trackId ?? ''),
            skipAtMs: Number(data.skipAtMs ?? 0),
            totalDurationMs: Number(data.totalDurationMs ?? 0),
            reason: String(data.reason ?? 'manual'),
          })
          break
        case 'search':
          event = createSearchEvent({
            userId,
            query: String(data.query ?? ''),
            resultCount: Number(data.resultCount ?? 0),
            selectedIndex: data.selectedIndex != null ? Number(data.selectedIndex) : undefined,
          })
          break
        case 'share':
          event = createShareEvent({
            userId,
            contentId: String(data.contentId ?? ''),
            contentType: String(data.contentType ?? 'track'),
            platform: String(data.platform ?? 'link'),
          })
          break
        case 'session':
          event = createSessionEvent({
            userId,
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

      return NextResponse.json({ ok: true, data: { eventId: event.id } }, { status: 201 })
    }),
  )
}
