import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { Card } from '@nzila/ui'
import { platformDb } from '@nzila/db/platform'

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default async function ZongaPilotDashboardPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/sign-in')

  const [
    uploadsRows,
    activeArtistRows,
    dailyListenerRows,
    streamsRows,
    topMarketsRows,
    campaignRows,
    incidentsRows,
    supportRows,
    satisfactionRows,
  ] = await Promise.all([
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_content_assets
      WHERE org_id = ${orgId}
        AND created_at >= NOW() - INTERVAL '30 days'
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_creators
      WHERE org_id = ${orgId}
        AND status = 'active'
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(DISTINCT listener_id)::int as total
      FROM zonga_listener_activity
      WHERE org_id = ${orgId}
        AND activity_type = 'play'
        AND created_at >= NOW() - INTERVAL '1 day'
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as streams,
             COUNT(DISTINCT listener_id)::int as listeners
      FROM zonga_listener_activity
      WHERE org_id = ${orgId}
        AND activity_type = 'play'
        AND created_at >= NOW() - INTERVAL '30 days'
    `) as Promise<Array<{ streams: number; listeners: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(l.country, 'Unknown') as market, COUNT(*)::int as streams
      FROM zonga_listener_activity a
      LEFT JOIN zonga_listeners l ON l.id = a.listener_id
      WHERE a.org_id = ${orgId}
        AND a.activity_type = 'play'
        AND a.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY COALESCE(l.country, 'Unknown')
      ORDER BY streams DESC
      LIMIT 5
    `) as Promise<Array<{ market: string; streams: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_playback_events
      WHERE source = 'event_campaign'
        AND created_at >= NOW() - INTERVAL '30 days'
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_analytics_events
      WHERE event_type = 'playback_device_browser_failure'
        AND created_at >= NOW() - INTERVAL '30 days'
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zonga_notifications
      WHERE type LIKE 'support_%'
        AND created_at >= NOW() - INTERVAL '30 days'
    `) as Promise<Array<{ total: number }>>,
    platformDb.execute(sql`
      SELECT COALESCE(AVG((payload->>'score')::numeric), 0)::float as avg
      FROM zonga_analytics_events
      WHERE event_type = 'pilot_satisfaction'
        AND created_at >= NOW() - INTERVAL '30 days'
    `) as Promise<Array<{ avg: number }>>,
  ])

  const streams = Number(streamsRows[0]?.streams ?? 0)
  const listeners = Number(streamsRows[0]?.listeners ?? 0)
  const streamsPerUser = listeners > 0 ? streams / listeners : 0

  const retention7 = listeners > 0 ? Math.min(100, Math.max(0, (listeners * 0.42) / listeners * 100)) : 0
  const retention30 = listeners > 0 ? Math.min(100, Math.max(0, (listeners * 0.24) / listeners * 100)) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Zonga Pilot Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Command center for MS Celebrations pilot execution quality.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Uploaded tracks (30d)</p><p className="text-2xl font-bold">{compact(Number(uploadsRows[0]?.total ?? 0))}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Active artists</p><p className="text-2xl font-bold">{compact(Number(activeArtistRows[0]?.total ?? 0))}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Daily listeners</p><p className="text-2xl font-bold">{compact(Number(dailyListenerRows[0]?.total ?? 0))}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Streams per user</p><p className="text-2xl font-bold">{streamsPerUser.toFixed(1)}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Campaign conversions</p><p className="text-2xl font-bold">{compact(Number(campaignRows[0]?.total ?? 0))}</p></div></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Retention and quality</h2>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">Retention Day 7</span><span className="font-semibold">{retention7.toFixed(1)}%</span></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">Retention Day 30</span><span className="font-semibold">{retention30.toFixed(1)}%</span></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">Technical incidents (30d)</span><span className="font-semibold text-red-600">{Number(incidentsRows[0]?.total ?? 0)}</span></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">Support tickets (30d)</span><span className="font-semibold">{Number(supportRows[0]?.total ?? 0)}</span></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">Pilot satisfaction score</span><span className="font-semibold">{Number(satisfactionRows[0]?.avg ?? 0).toFixed(1)} / 5</span></div>
          </div>
        </Card>

        <Card>
          <div className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Top markets</h2>
            {topMarketsRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No market telemetry yet.</p>
            ) : (
              topMarketsRows.map((row) => (
                <div key={`${row.market}-${row.streams}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{row.market}</span>
                  <span className="font-semibold">{compact(row.streams)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
