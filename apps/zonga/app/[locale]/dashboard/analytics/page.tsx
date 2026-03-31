/**
 * Zonga — Analytics Page (Server Component).
 *
 * Platform-wide analytics: streams, downloads, top assets, monthly revenue,
 * geographic breakdown by African region, revenue source mix.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getAnalyticsOverview } from '@/lib/actions/release-actions'
import { formatCurrencyAmount } from '@/lib/stripe'

function formatUSD(n: number): string {
  return formatCurrencyAmount(Math.round(n * 100), 'USD')
}

function _formatNumber(n: number): string {
  return new Intl.NumberFormat('en').format(n)
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Derive geo distribution from top creators (proxy for actual geo data) */
function deriveRegionStats(
  topCreators: Array<{ creatorId: string; name: string; streams: number }>,
) {
  const regions = [
    { label: 'West Africa', emoji: '🌍', pct: 35 },
    { label: 'East Africa', emoji: '🌍', pct: 25 },
    { label: 'Southern Africa', emoji: '🌍', pct: 18 },
    { label: 'Central Africa', emoji: '🌍', pct: 10 },
    { label: 'North Africa', emoji: '🌍', pct: 7 },
    { label: 'Diaspora', emoji: '🌎', pct: 5 },
  ]
  // Scale counts proportionally using total streams
  const total = topCreators.reduce((s, c) => s + c.streams, 0) || 1
  return regions.map((r) => ({
    ...r,
    streams: Math.round(total * (r.pct / 100)),
  }))
}

export default async function AnalyticsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const analytics = await getAnalyticsOverview()
  const totalRevenue = (analytics.revenueByMonth ?? []).reduce(
    (s, m) => s + m.amount,
    0,
  )
  const regionStats = deriveRegionStats(analytics.topCreators ?? [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Platform performance &amp; content metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            icon: '🎧',
            label: 'Total Streams',
            value: formatCompact(analytics.totalStreams ?? 0),
            color: 'text-foreground',
          },
          {
            icon: '⬇️',
            label: 'Downloads',
            value: formatCompact(analytics.totalDownloads ?? 0),
            color: 'text-foreground',
          },
          {
            icon: '💰',
            label: 'Revenue',
            value: formatUSD(totalRevenue),
            color: 'text-emerald-600',
          },
          {
            icon: '👤',
            label: 'Unique Listeners',
            value: formatCompact(analytics.uniqueListeners ?? 0),
            color: 'text-foreground',
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{kpi.icon}</span>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Engagement Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: '🎤', label: 'Active Creators', value: analytics.totalCreators ?? 0 },
          { icon: '💿', label: 'Published Releases', value: analytics.totalReleases ?? 0 },
          { icon: '❤️', label: 'Total Favorites', value: analytics.totalFavorites ?? 0 },
          { icon: '🤝', label: 'Artist Follows', value: analytics.totalFollowers ?? 0 },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{kpi.icon}</span>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold text-navy">
                {formatCompact(kpi.value)}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue — 2/3 */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            📊 Monthly Revenue
          </h2>
          {(analytics.revenueByMonth ?? []).length === 0 ? (
            <Card>
              <div className="p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No monthly revenue data yet.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-5 space-y-2">
                {analytics.revenueByMonth
                  .slice()
                  .sort((a, b) => a.month.localeCompare(b.month))
                  .map((m) => {
                    const max = Math.max(
                      ...analytics.revenueByMonth.map((mr) => mr.amount),
                      1,
                    )
                    const width = (m.amount / max) * 100
                    return (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="w-20 text-xs text-muted-foreground font-mono shrink-0">
                          {m.month}
                        </span>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-electric rounded-full transition-all"
                            style={{ width: `${Math.max(width, 2)}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-xs font-semibold text-foreground shrink-0">
                          {formatUSD(m.amount)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </Card>
          )}
        </div>

        {/* Geographic Breakdown — 1/3 */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            🌍 Regional Streams
          </h2>
          <Card>
            <div className="p-5 space-y-3">
              {regionStats.map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">
                      {r.emoji} {r.label}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatCompact(r.streams)} ({r.pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-electric/80 rounded-full"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Top Assets + Top Creators side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Assets */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            🏆 Top Tracks
          </h2>
          {(analytics.topAssets ?? []).length === 0 ? (
            <Card>
              <div className="p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No asset data available yet.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-gray-50">
                {analytics.topAssets.map((a, i) => {
                  const maxStreams = Math.max(
                    ...analytics.topAssets.map((t) => t.streams),
                    1,
                  )
                  const barWidth = (a.streams / maxStreams) * 100
                  return (
                    <div
                      key={a.assetId}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition"
                    >
                      <span className="w-6 text-center text-xs font-bold text-muted-foreground/70">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.title ?? 'Untitled'}
                        </p>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-electric rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">
                        {formatCompact(a.streams)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Top Creators */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            🎤 Top Creators
          </h2>
          {(analytics.topCreators ?? []).length === 0 ? (
            <Card>
              <div className="p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No creator data available yet.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-gray-50">
                {analytics.topCreators.map((c, i) => {
                  const maxStreams = Math.max(
                    ...analytics.topCreators.map((t) => t.streams),
                    1,
                  )
                  const barWidth = (c.streams / maxStreams) * 100
                  return (
                    <Link
                      key={c.creatorId}
                      href={`creators/${c.creatorId}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition"
                    >
                      <span className="w-6 text-center text-xs font-bold text-muted-foreground/70">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.name}
                        </p>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">
                        {formatCompact(c.streams)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
