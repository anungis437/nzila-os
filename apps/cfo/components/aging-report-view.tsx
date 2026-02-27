/**
 * CFO — Aging Report & Revenue Recognition View (Client Component).
 *
 * Two-tab panel showing:
 * 1. AR / AP aging buckets with visual distribution bars
 * 2. Revenue recognition status (ASC 606 / IFRS 15)
 *
 * Uses @nzila/commerce-services aging report engine.
 */
'use client'

import { useState } from 'react'
import {
  Clock,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from 'lucide-react'

/* ── Types (self-contained for client-side rendering) ─────────────────────── */

interface AgingBucket {
  label: string
  arAmount: number
  apAmount: number
}

interface RevenueItem {
  contractId: string
  customer: string
  totalValue: number
  recognized: number
  deferred: number
  completionPct: number
  standard: 'ASC 606' | 'IFRS 15'
}

interface AgingReportViewProps {
  /**
   * Aging buckets from the server action.
   * If omitted, shows demo data (for marketing/demo mode).
   */
  buckets?: AgingBucket[]
  revenueItems?: RevenueItem[]
}

/* ── Demo data ────────────────────────────────────────────────────────────── */

const DEMO_BUCKETS: AgingBucket[] = [
  { label: 'Current', arAmount: 245_000, apAmount: 180_000 },
  { label: '1–30 days', arAmount: 82_000, apAmount: 45_000 },
  { label: '31–60 days', arAmount: 35_000, apAmount: 22_000 },
  { label: '61–90 days', arAmount: 18_000, apAmount: 8_000 },
  { label: '90+ days', arAmount: 12_500, apAmount: 3_200 },
]

const DEMO_REVENUE: RevenueItem[] = [
  {
    contractId: 'C-2026-001',
    customer: 'Maple Corp',
    totalValue: 120_000,
    recognized: 84_000,
    deferred: 36_000,
    completionPct: 70,
    standard: 'IFRS 15',
  },
  {
    contractId: 'C-2026-002',
    customer: 'Ottawa Digital',
    totalValue: 55_000,
    recognized: 55_000,
    deferred: 0,
    completionPct: 100,
    standard: 'ASC 606',
  },
  {
    contractId: 'C-2026-003',
    customer: 'Gatineau Services',
    totalValue: 200_000,
    recognized: 40_000,
    deferred: 160_000,
    completionPct: 20,
    standard: 'IFRS 15',
  },
  {
    contractId: 'C-2026-004',
    customer: 'Capital Health Inc.',
    totalValue: 90_000,
    recognized: 67_500,
    deferred: 22_500,
    completionPct: 75,
    standard: 'ASC 606',
  },
]

/* ── Component ────────────────────────────────────────────────────────────── */

type Tab = 'aging' | 'revenue'

export function AgingReportView({
  buckets = DEMO_BUCKETS,
  revenueItems = DEMO_REVENUE,
}: AgingReportViewProps) {
  const [tab, setTab] = useState<Tab>('aging')

  const totalAR = buckets.reduce((s, b) => s + b.arAmount, 0)
  const totalAP = buckets.reduce((s, b) => s + b.apAmount, 0)
  const overdueAR = buckets
    .filter((b) => b.label !== 'Current')
    .reduce((s, b) => s + b.arAmount, 0)

  const totalRecognized = revenueItems.reduce((s, r) => s + r.recognized, 0)
  const totalDeferred = revenueItems.reduce((s, r) => s + r.deferred, 0)

  const maxBucket = Math.max(...buckets.map((b) => Math.max(b.arAmount, b.apAmount)), 1)

  const fmt = (n: number) =>
    '$' + n.toLocaleString('en-CA', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          onClick={() => setTab('aging')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'aging'
              ? 'bg-electric text-white'
              : 'bg-background text-foreground hover:bg-secondary'
          }`}
        >
          <Clock className="mr-1.5 inline h-4 w-4" />
          Aging Buckets
        </button>
        <button
          onClick={() => setTab('revenue')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'revenue'
              ? 'bg-electric text-white'
              : 'bg-background text-foreground hover:bg-secondary'
          }`}
        >
          <TrendingUp className="mr-1.5 inline h-4 w-4" />
          Revenue Recognition
        </button>
      </div>

      {tab === 'aging' ? (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Total AR</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{fmt(totalAR)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Total AP</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{fmt(totalAP)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Overdue AR
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-600">{fmt(overdueAR)}</p>
            </div>
          </div>

          {/* Aging chart */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-electric" /> Receivables
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-rose-500" /> Payables
              </span>
            </div>

            {buckets.map((b) => (
              <div key={b.label} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{b.label}</p>
                <div className="flex gap-1.5 items-center">
                  <div
                    className="h-5 rounded bg-electric transition-all duration-500"
                    style={{ width: `${(b.arAmount / maxBucket) * 100}%` }}
                  />
                  <span className="text-xs font-mono text-foreground whitespace-nowrap">
                    {fmt(b.arAmount)}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <div
                    className="h-5 rounded bg-rose-500 transition-all duration-500"
                    style={{ width: `${(b.apAmount / maxBucket) * 100}%` }}
                  />
                  <span className="text-xs font-mono text-foreground whitespace-nowrap">
                    {fmt(b.apAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Revenue summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Total Recognized</p>
              <p className="mt-1 text-xl font-semibold text-green-600">{fmt(totalRecognized)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Total Deferred</p>
              <p className="mt-1 text-xl font-semibold text-amber-600">{fmt(totalDeferred)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Contracts</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{revenueItems.length}</p>
            </div>
          </div>

          {/* Revenue table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Contract</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Recognized</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Deferred</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Completion</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Standard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {revenueItems.map((r) => (
                  <tr key={r.contractId} className="hover:bg-secondary/50">
                    <td className="px-4 py-3 font-mono text-foreground">{r.contractId}</td>
                    <td className="px-4 py-3 text-foreground">{r.customer}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{fmt(r.totalValue)}</td>
                    <td className="px-4 py-3 font-mono text-green-600">{fmt(r.recognized)}</td>
                    <td className="px-4 py-3 font-mono text-amber-600">{fmt(r.deferred)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-electric transition-all"
                            style={{ width: `${r.completionPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{r.completionPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-mono">
                        {r.standard}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
