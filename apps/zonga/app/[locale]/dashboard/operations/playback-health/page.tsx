import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'

interface MetricRow {
  event_type: string
  count: number
}

interface LatencyRow {
  p50_ms: number
  p95_ms: number
}

interface TopFailureRow {
  user_agent: string | null
  failures: number
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

export default async function PlaybackHealthPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/sign-in')

  const [countsRaw, latencyRaw, failuresRaw] = await Promise.all([
    platformDb.execute(sql`
      SELECT event_type, COUNT(*)::int as count
      FROM zonga_analytics_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND event_type LIKE 'playback_%'
      GROUP BY event_type
    `),
    platformDb.execute(sql`
      SELECT
        COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY NULLIF((payload->>'latencyMs')::numeric, 0)), 0)::int as p50_ms,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY NULLIF((payload->>'latencyMs')::numeric, 0)), 0)::int as p95_ms
      FROM zonga_analytics_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND event_type = 'playback_play_start_latency'
    `),
    platformDb.execute(sql`
      SELECT payload->>'userAgent' as user_agent, COUNT(*)::int as failures
      FROM zonga_analytics_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND event_type = 'playback_device_browser_failure'
      GROUP BY payload->>'userAgent'
      ORDER BY failures DESC
      LIMIT 5
    `),
  ])

  const countsRows = countsRaw as unknown as MetricRow[]
  const latencyRows = latencyRaw as unknown as LatencyRow[]
  const failuresRows = failuresRaw as unknown as TopFailureRow[]

  const counts = new Map(countsRows.map((r) => [r.event_type, Number(r.count)]))
  const plays = counts.get('playback_play_start_latency') ?? 0
  const buffers = counts.get('playback_buffer_event') ?? 0
  const completions = counts.get('playback_completion') ?? 0
  const skips = counts.get('playback_skip') ?? 0
  const failures = counts.get('playback_device_browser_failure') ?? 0

  const latency = latencyRows[0] ?? { p50_ms: 0, p95_ms: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zonga Playback Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last 7 days telemetry for demo and pilot reliability.
          </p>
        </div>
        <Link
          href="../"
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
        >
          Back to Operations
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Play Starts</p><p className="text-2xl font-bold">{plays}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Buffer Events</p><p className="text-2xl font-bold text-amber-600">{buffers}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Completions</p><p className="text-2xl font-bold text-emerald-600">{completions}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Skips</p><p className="text-2xl font-bold text-blue-600">{skips}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Failures</p><p className="text-2xl font-bold text-red-600">{failures}</p></div></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Reliability Ratios</h2>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Completion rate</span>
              <span className="font-semibold text-foreground">{pct(completions, plays)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Skip rate</span>
              <span className="font-semibold text-foreground">{pct(skips, plays)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Failure rate</span>
              <span className="font-semibold text-foreground">{pct(failures, plays)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Buffer events per play</span>
              <span className="font-semibold text-foreground">{plays > 0 ? (buffers / plays).toFixed(2) : '0.00'}</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Play Start Latency</h2>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">P50 latency</span>
              <span className="font-semibold text-foreground">{latency.p50_ms} ms</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">P95 latency</span>
              <span className="font-semibold text-foreground">{latency.p95_ms} ms</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Target: keep P95 under 1500 ms for pilot demos and partner sessions.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Top Device/Browser Failures</h2>
          {failuresRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No playback device failures in the last 7 days.</p>
          ) : (
            <div className="space-y-2">
              {failuresRows.map((row) => (
                <div key={`${row.user_agent ?? 'unknown'}-${row.failures}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">{row.user_agent ?? 'Unknown user agent'}</span>
                  <span className="font-semibold text-red-600">{row.failures}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
