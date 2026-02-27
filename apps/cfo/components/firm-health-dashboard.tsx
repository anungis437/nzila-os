/**
 * CFO — Firm Health Dashboard (Client Component).
 *
 * Admin-level dashboard showing per-firm health scores, key metrics,
 * SLA compliance, and trend indicators. Designed for multi-tenant
 * VCFO platform administration.
 */
'use client'

import { useState } from 'react'
import {
  Activity,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Clock,
  BarChart3,
  Search,
} from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface FirmHealth {
  firmId: string
  firmName: string
  healthScore: number // 0–100
  status: 'healthy' | 'degraded' | 'critical'
  activeClients: number
  mrr: number
  overdueTasksPct: number
  avgSlaCompliance: number
  qboSyncStatus: 'synced' | 'stale' | 'error'
  lastActivityAt: string
  trend: 'up' | 'stable' | 'down'
}

interface FirmHealthDashboardProps {
  firms?: FirmHealth[]
}

/* ── Demo data ────────────────────────────────────────────────────────────── */

const DEMO_FIRMS: FirmHealth[] = [
  {
    firmId: 'firm-001',
    firmName: 'TAAG Accounting',
    healthScore: 94,
    status: 'healthy',
    activeClients: 128,
    mrr: 42_500,
    overdueTasksPct: 3.2,
    avgSlaCompliance: 97,
    qboSyncStatus: 'synced',
    lastActivityAt: new Date().toISOString(),
    trend: 'up',
  },
  {
    firmId: 'firm-002',
    firmName: 'Capital CPA Group',
    healthScore: 78,
    status: 'degraded',
    activeClients: 64,
    mrr: 18_200,
    overdueTasksPct: 12.5,
    avgSlaCompliance: 82,
    qboSyncStatus: 'stale',
    lastActivityAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    trend: 'stable',
  },
  {
    firmId: 'firm-003',
    firmName: 'Maple Leaf Tax Services',
    healthScore: 88,
    status: 'healthy',
    activeClients: 91,
    mrr: 28_700,
    overdueTasksPct: 5.1,
    avgSlaCompliance: 94,
    qboSyncStatus: 'synced',
    lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
    trend: 'up',
  },
  {
    firmId: 'firm-004',
    firmName: 'Gatineau Fiscalité Inc.',
    healthScore: 45,
    status: 'critical',
    activeClients: 22,
    mrr: 5_800,
    overdueTasksPct: 28.0,
    avgSlaCompliance: 61,
    qboSyncStatus: 'error',
    lastActivityAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    trend: 'down',
  },
]

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function healthColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

function healthBg(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function statusIcon(status: FirmHealth['status']) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-amber-600" />
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-600" />
  }
}

function trendIcon(trend: FirmHealth['trend']) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-green-600" />
    case 'stable':
      return <Activity className="h-4 w-4 text-muted-foreground" />
    case 'down':
      return <TrendingDown className="h-4 w-4 text-red-600" />
  }
}

function syncBadge(status: FirmHealth['qboSyncStatus']) {
  const styles = {
    synced: 'bg-green-500/10 text-green-600',
    stale: 'bg-amber-500/10 text-amber-600',
    error: 'bg-red-500/10 text-red-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-CA', { maximumFractionDigits: 0 })

/* ── Component ────────────────────────────────────────────────────────────── */

export function FirmHealthDashboard({ firms = DEMO_FIRMS }: FirmHealthDashboardProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'healthScore' | 'mrr' | 'activeClients'>('healthScore')

  const filtered = firms
    .filter((f) => f.firmName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b[sortBy] - a[sortBy])

  const totalClients = firms.reduce((s, f) => s + f.activeClients, 0)
  const totalMrr = firms.reduce((s, f) => s + f.mrr, 0)
  const avgHealth = Math.round(firms.reduce((s, f) => s + f.healthScore, 0) / firms.length)
  const criticalCount = firms.filter((f) => f.status === 'critical').length

  return (
    <div className="space-y-6">
      {/* Platform summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" /> Total Firms
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{firms.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Total Clients
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{totalClients}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" /> Platform MRR
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{fmt(totalMrr)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" /> Avg Health
          </p>
          <p className={`mt-1 text-2xl font-semibold ${healthColor(avgHealth)}`}>
            {avgHealth}
            <span className="text-sm text-muted-foreground">/100</span>
          </p>
          {criticalCount > 0 && (
            <p className="mt-1 text-xs text-red-600">
              {criticalCount} critical firm{criticalCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search firms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm
                       text-foreground placeholder:text-muted-foreground
                       focus:outline-none focus:ring-2 focus:ring-electric/40"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground
                     focus:outline-none focus:ring-2 focus:ring-electric/40"
        >
          <option value="healthScore">Sort by Health</option>
          <option value="mrr">Sort by MRR</option>
          <option value="activeClients">Sort by Clients</option>
        </select>
      </div>

      {/* Firm cards */}
      <div className="space-y-3">
        {filtered.map((f) => (
          <div
            key={f.firmId}
            className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-electric/30
                       transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: name, status, trend */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Health ring */}
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4
                                border-secondary">
                  <div
                    className={`absolute inset-0 rounded-full ${healthBg(f.healthScore)} opacity-15`}
                  />
                  <span className={`text-sm font-bold ${healthColor(f.healthScore)}`}>
                    {f.healthScore}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{f.firmName}</h3>
                    {statusIcon(f.status)}
                    {trendIcon(f.trend)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {f.activeClients} clients · {fmt(f.mrr)}/mo · Last active{' '}
                    {new Date(f.lastActivityAt).toLocaleDateString('en-CA')}
                  </p>
                </div>
              </div>

              {/* Right: metrics */}
              <div className="flex items-center gap-6 shrink-0 text-right">
                <div>
                  <p className="text-xs text-muted-foreground">SLA</p>
                  <p className={`text-sm font-semibold ${
                    f.avgSlaCompliance >= 90 ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {f.avgSlaCompliance}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className={`text-sm font-semibold ${
                    f.overdueTasksPct <= 5 ? 'text-green-600' : f.overdueTasksPct <= 15 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {f.overdueTasksPct}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">QBO</p>
                  {syncBadge(f.qboSyncStatus)}
                </div>
              </div>
            </div>

            {/* Health bar */}
            <div className="mt-3 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full ${healthBg(f.healthScore)} transition-all duration-500`}
                style={{ width: `${f.healthScore}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
