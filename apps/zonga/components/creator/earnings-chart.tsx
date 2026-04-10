'use client'

/**
 * Zonga — Creator Earnings Chart
 *
 * Displays monthly earnings breakdown with a bar chart and summary stats.
 */

import { useMemo } from 'react'
import { Card } from '@nzila/ui'
import { TrendingUp, DollarSign, BarChart3 } from 'lucide-react'

interface MonthlyEarning {
  month: string            // "2026-01", "2026-02", etc.
  streaming: number
  downloads: number
  tickets: number
  tips: number
  total: number
}

interface EarningsSummary {
  totalEarned: number
  totalPaid: number
  pendingPayout: number
  availableBalance: number
  currency: string
}

interface CreatorEarningsChartProps {
  monthlyData: MonthlyEarning[]
  summary: EarningsSummary
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[parseInt(m, 10) - 1]} ${year?.slice(2)}`
}

export function CreatorEarningsChart({ monthlyData, summary }: CreatorEarningsChartProps) {
  const maxTotal = useMemo(() => {
    return Math.max(...monthlyData.map((d) => d.total), 1)
  }, [monthlyData])

  const sourceColors = {
    streaming: 'bg-blue-500',
    downloads: 'bg-emerald-500',
    tickets: 'bg-amber-500',
    tips: 'bg-pink-500',
  } as const

  return (
    <Card>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Earnings</h3>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Earned</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(summary.totalEarned, summary.currency)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">Available</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(summary.availableBalance, summary.currency)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <span className="text-xs text-muted-foreground">Total Paid Out</span>
            <p className="text-base font-semibold text-foreground">
              {formatCurrency(summary.totalPaid, summary.currency)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <span className="text-xs text-muted-foreground">Pending</span>
            <p className="text-base font-semibold text-amber-600">
              {formatCurrency(summary.pendingPayout, summary.currency)}
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        {monthlyData.length > 0 ? (
          <div>
            <div className="flex items-end gap-1.5" style={{ height: 160 }}>
              {monthlyData.map((d) => {
                const totalPct = (d.total / maxTotal) * 100
                const streamPct = d.total > 0 ? (d.streaming / d.total) * totalPct : 0
                const dlPct = d.total > 0 ? (d.downloads / d.total) * totalPct : 0
                const ticketPct = d.total > 0 ? (d.tickets / d.total) * totalPct : 0
                const tipPct = d.total > 0 ? (d.tips / d.total) * totalPct : 0

                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden"
                      style={{ height: `${totalPct}%`, minHeight: d.total > 0 ? 4 : 0 }}
                      title={`${formatMonth(d.month)}: ${formatCurrency(d.total, summary.currency)}`}
                    >
                      <div className={sourceColors.streaming} style={{ height: `${streamPct > 0 ? (streamPct / totalPct) * 100 : 0}%` }} />
                      <div className={sourceColors.downloads} style={{ height: `${dlPct > 0 ? (dlPct / totalPct) * 100 : 0}%` }} />
                      <div className={sourceColors.tickets} style={{ height: `${ticketPct > 0 ? (ticketPct / totalPct) * 100 : 0}%` }} />
                      <div className={sourceColors.tips} style={{ height: `${tipPct > 0 ? (tipPct / totalPct) * 100 : 0}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex gap-1.5 mt-1">
              {monthlyData.map((d) => (
                <div key={d.month} className="flex-1 text-center">
                  <span className="text-[10px] text-muted-foreground">{formatMonth(d.month)}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${sourceColors.streaming}`} /> Streaming
              </span>
              <span className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${sourceColors.downloads}`} /> Downloads
              </span>
              <span className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${sourceColors.tickets}`} /> Tickets
              </span>
              <span className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${sourceColors.tips}`} /> Tips
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No earnings data yet
          </div>
        )}
      </div>
    </Card>
  )
}
