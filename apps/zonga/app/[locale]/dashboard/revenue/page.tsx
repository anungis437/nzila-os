/**
 * Zonga — Revenue Page (Server Component).
 *
 * Revenue dashboard: totals by source, revenue mix donut, per-creator
 * breakdown with payout rail badges, recent events with type icons.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import {
  getRevenueOverview,
  getRevenueByCreator,
} from '@/lib/actions/revenue-actions'
import { formatCurrencyAmount } from '@/lib/stripe'

function formatUSD(n: number): string {
  return formatCurrencyAmount(Math.round(n * 100), 'USD')
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return formatUSD(n)
}

const PAYOUT_RAILS = [
  { key: 'mpesa', label: 'M-Pesa', color: 'bg-green-100 text-green-700' },
  { key: 'mtn_momo', label: 'MTN MoMo', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'airtel_money', label: 'Airtel', color: 'bg-red-100 text-red-700' },
  { key: 'orange_money', label: 'Orange', color: 'bg-orange-100 text-orange-700' },
  { key: 'stripe', label: 'Stripe', color: 'bg-purple-100 text-purple-700' },
  { key: 'bank_transfer', label: 'Bank', color: 'bg-blue-100 text-blue-700' },
  { key: 'chipper_cash', label: 'Chipper', color: 'bg-teal-100 text-teal-700' },
  { key: 'flutterwave', label: 'Flutterwave', color: 'bg-indigo-100 text-indigo-700' },
]

const TYPE_ICONS: Record<string, string> = {
  stream: '🎧',
  download: '⬇️',
  sync_license: '🎬',
  subscription: '💳',
  tip: '🎁',
  ad_revenue: '📺',
}

export default async function RevenuePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [overview, byCreator] = await Promise.all([
    getRevenueOverview(),
    getRevenueByCreator(),
  ])

  const total = overview.totalRevenue || 1
  const sourceMix = [
    {
      label: 'Streams',
      amount: overview.streamRevenue,
      pct: Math.round((overview.streamRevenue / total) * 100),
      icon: '🎧',
      bar: 'bg-electric',
    },
    {
      label: 'Downloads',
      amount: overview.downloadRevenue,
      pct: Math.round((overview.downloadRevenue / total) * 100),
      icon: '⬇️',
      bar: 'bg-purple-500',
    },
    {
      label: 'Sync Licensing',
      amount: overview.syncRevenue,
      pct: Math.round((overview.syncRevenue / total) * 100),
      icon: '🎬',
      bar: 'bg-amber-500',
    },
    {
      label: 'Other',
      amount:
        overview.totalRevenue -
        overview.streamRevenue -
        overview.downloadRevenue -
        overview.syncRevenue,
      pct: Math.max(
        0,
        100 -
          Math.round((overview.streamRevenue / total) * 100) -
          Math.round((overview.downloadRevenue / total) * 100) -
          Math.round((overview.syncRevenue / total) * 100),
      ),
      icon: '📊',
      bar: 'bg-gray-400',
    },
  ].filter((s) => s.amount > 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Revenue</h1>
        <p className="text-gray-500 mt-1">
          {overview.eventCount.toLocaleString()} revenue events tracked
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Revenue',
            value: formatCompact(overview.totalRevenue),
            icon: '💰',
            color: 'text-emerald-600',
          },
          {
            label: 'Streams',
            value: formatCompact(overview.streamRevenue),
            icon: '🎧',
            color: 'text-blue-600',
          },
          {
            label: 'Downloads',
            value: formatCompact(overview.downloadRevenue),
            icon: '⬇️',
            color: 'text-purple-600',
          },
          {
            label: 'Sync Licensing',
            value: formatCompact(overview.syncRevenue),
            icon: '🎬',
            color: 'text-amber-600',
          },
        ].map((card) => (
          <Card key={card.label}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{card.icon}</span>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Revenue Mix Bar */}
      {sourceMix.length > 0 && (
        <Card>
          <div className="p-5">
            <h2 className="text-sm font-semibold text-navy mb-3">
              Revenue Mix
            </h2>
            {/* Stacked bar */}
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 mb-3">
              {sourceMix.map((s) => (
                <div
                  key={s.label}
                  className={`${s.bar} transition-all`}
                  style={{ width: `${Math.max(s.pct, 1)}%` }}
                  title={`${s.label}: ${s.pct}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              {sourceMix.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${s.bar}`} />
                  <span className="text-gray-600">
                    {s.icon} {s.label}
                  </span>
                  <span className="font-semibold text-navy">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Creator */}
        <div>
          <h2 className="text-lg font-semibold text-navy mb-3">
            💸 Per-Creator Revenue
          </h2>
          {byCreator.length === 0 ? (
            <Card>
              <div className="p-8 text-center">
                <div className="text-3xl mb-2">🎤</div>
                <p className="text-sm text-gray-500">
                  No creator revenue data yet.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-gray-100">
                {byCreator.map((c) => {
                  const maxTotal = Math.max(
                    ...byCreator.map((cr) => Number(cr.total)),
                    1,
                  )
                  const barWidth =
                    (Number(c.total) / maxTotal) * 100
                  return (
                    <Link
                      key={c.creatorId}
                      href={`creators/${c.creatorId}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy truncate">
                          {c.creatorName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {c.events} events
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 shrink-0">
                        {formatUSD(Number(c.total))}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Recent Revenue Events */}
        <div>
          <h2 className="text-lg font-semibold text-navy mb-3">
            📋 Recent Events
          </h2>
          {overview.recentEvents.length === 0 ? (
            <Card>
              <div className="p-8 text-center">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-sm text-gray-500">
                  No revenue events yet.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-gray-100">
                {overview.recentEvents.map(
                  (
                    event: {
                      id: string
                      type?: string
                      amount?: number
                      assetTitle?: string
                      source?: string
                      createdAt?: string
                    },
                    idx: number,
                  ) => (
                    <div
                      key={event.id ?? idx}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg shrink-0">
                          {TYPE_ICONS[event.type ?? ''] ?? '📊'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy truncate">
                            {event.assetTitle ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {event.source ?? event.type} ·{' '}
                            {event.createdAt
                              ? new Date(
                                  event.createdAt,
                                ).toLocaleDateString('en-CA')
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600 shrink-0">
                        {formatUSD(Number(event.amount ?? 0))}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Payout Rails */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-3">
          🏦 Supported Payout Rails
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PAYOUT_RAILS.map((rail) => (
            <div
              key={rail.key}
              className={`rounded-xl px-4 py-3 text-center ${rail.color}`}
            >
              <p className="text-sm font-semibold">{rail.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
