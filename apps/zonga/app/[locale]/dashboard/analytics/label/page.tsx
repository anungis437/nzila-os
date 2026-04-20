import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getLabelDashboardData, type LabelRangePreset } from '@/lib/actions/label-analytics-actions'

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default async function LabelAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: LabelRangePreset; start?: string; end?: string }>
}) {
  const query = await searchParams
  const preset = query.preset ?? '30d'
  const data = await getLabelDashboardData({ preset, start: query.start, end: query.end })

  const exportQuery = `preset=${data.range.preset}&start=${encodeURIComponent(data.range.startIso)}&end=${encodeURIComponent(data.range.endIso)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Label Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Executive-ready streaming and growth analytics for label operators.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`?preset=today`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">Today</Link>
          <Link href={`?preset=7d`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">7 days</Link>
          <Link href={`?preset=30d`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">30 days</Link>
          <Link href={`/api/analytics/label-export?format=csv&${exportQuery}`} className="rounded-lg bg-electric px-3 py-1.5 text-xs font-medium text-white hover:bg-electric/90">Export CSV</Link>
          <Link href={`/api/analytics/label-export?format=pdf&${exportQuery}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">Export PDF Summary</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Total streams</p><p className="text-2xl font-bold">{compact(data.totals.totalStreams)}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Unique listeners</p><p className="text-2xl font-bold">{compact(data.totals.uniqueListeners)}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Repeat listeners</p><p className="text-2xl font-bold">{compact(data.totals.repeatListeners)}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Saves / follows</p><p className="text-2xl font-bold">{compact(data.totals.saves + data.totals.follows)}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-muted-foreground">Completion %</p><p className="text-2xl font-bold">{data.totals.completionPct.toFixed(1)}%</p></div></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Top songs</h2>
            <div className="space-y-2">
              {data.topSongs.slice(0, 8).map((row) => (
                <div key={`${row.title}-${row.streams}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">{row.title}</span>
                  <span className="font-semibold text-foreground">{compact(row.streams)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Top artists</h2>
            <div className="space-y-2">
              {data.topArtists.slice(0, 8).map((row) => (
                <div key={`${row.artist}-${row.streams}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">{row.artist}</span>
                  <span className="font-semibold text-foreground">{compact(row.streams)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Top countries</h2>
            <div className="space-y-2">
              {data.topCountries.slice(0, 8).map((row) => (
                <div key={`${row.country}-${row.streams}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">{row.country}</span>
                  <span className="font-semibold text-foreground">{compact(row.streams)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Top cities</h2>
            <div className="space-y-2">
              {data.topCities.slice(0, 8).map((row) => (
                <div key={`${row.city}-${row.streams}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">{row.city}</span>
                  <span className="font-semibold text-foreground">{compact(row.streams)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Source of traffic + campaign traffic</h2>
          <p className="text-xs text-muted-foreground mb-2">Event campaign traffic: {compact(data.totals.eventCampaignTraffic)}</p>
          <div className="space-y-2">
            {data.sourceTraffic.map((row) => (
              <div key={`${row.source}-${row.streams}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{row.source}</span>
                <span className="font-semibold text-foreground">{compact(row.streams)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Growth over time</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {data.growth.slice(-12).map((row) => (
              <div key={row.day} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{row.day}</p>
                <p className="font-semibold text-foreground">{compact(row.streams)}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
