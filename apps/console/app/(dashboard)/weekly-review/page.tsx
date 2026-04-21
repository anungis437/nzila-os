'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  BoltIcon,
  ChartBarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

type Cadence = 'daily' | 'weekly' | 'monthly'

// ── Placeholder types ─────────────────────────────────────────────────────────

type DailyOpsItem = {
  id: string
  type: 'urgent' | 'priority' | 'blocker'
  label: string
  detail?: string
  href?: string
}

type WeeklyMovement = {
  label: string
  previous: number | string
  current: number | string
  unit?: string
  trend: 'up' | 'down' | 'flat'
  positive?: boolean
}

type MonthlyMetric = {
  label: string
  value: string
  delta?: string
  note?: string
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function DailyOpsView() {
  const items: DailyOpsItem[] = [
    { id: '1', type: 'urgent', label: 'AgriCo ZA: 3 open P2 tickets — no assigned owner', detail: 'Renewal in 32 days. Critical.', href: '/itsm/clients/3' },
    { id: '2', type: 'priority', label: 'Thabo Legal: Re-engagement message pending 3 days', detail: 'Last contact: 18 days ago.', href: '/itsm/clients/2' },
    { id: '3', type: 'blocker', label: 'Zonga Pilot A kickoff unbooked — blocking onboarding', href: '/itsm/clients/5' },
    { id: '4', type: 'priority', label: 'FairCase P2 cluster: 4 tickets in 5 days — investigate', href: '/itsm/queue' },
    { id: '5', type: 'priority', label: 'Q3 infra proposal awaiting approval', href: '/execution' },
  ]

  const badge = (t: DailyOpsItem['type']) => ({
    urgent: 'bg-red-950/60 text-red-300 border border-red-700',
    priority: 'bg-amber-950/60 text-amber-300 border border-amber-600',
    blocker: 'bg-purple-950/60 text-purple-300 border border-purple-700',
  }[t])

  const labelMap = { urgent: 'Urgent', priority: 'Priority', blocker: 'Blocker' }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400 leading-relaxed">
        High-signal items that need a decision or action today. Derived from ticket priority, client health, and outstanding tasks.
      </p>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 mt-0.5 ${badge(item.type)}`}>
              {labelMap[item.type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{item.label}</p>
              {item.detail && <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>}
            </div>
            {item.href && (
              <Link href={item.href} className="text-blue-400 hover:text-blue-300 shrink-0">
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 grid sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-red-400">4</p>
          <p className="text-xs text-slate-400 mt-0.5">P1–P2 open</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-amber-400">2</p>
          <p className="text-xs text-slate-400 mt-0.5">At-risk clients</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-purple-400">1</p>
          <p className="text-xs text-slate-400 mt-0.5">Hard blockers</p>
        </div>
      </div>
    </div>
  )
}

function WeeklyExecView() {
  const movements: WeeklyMovement[] = [
    { label: 'Active Clients', previous: 4, current: 5, unit: '', trend: 'up', positive: true },
    { label: 'ARR Proxy', previous: 480, current: 600, unit: 'k ZAR', trend: 'up', positive: true },
    { label: 'Open P1/P2 Tickets', previous: 2, current: 4, unit: '', trend: 'up', positive: false },
    { label: 'SLA Compliance', previous: '94%', current: '87%', trend: 'down', positive: false },
    { label: 'Support Load', previous: 12, current: 17, unit: ' tickets', trend: 'up', positive: false },
    { label: 'Deployments Shipped', previous: 3, current: 7, unit: '', trend: 'up', positive: true },
    { label: 'Churn Risk Accounts', previous: 1, current: 2, unit: '', trend: 'up', positive: false },
    { label: 'Onboarding Stalls', previous: 0, current: 1, unit: '', trend: 'up', positive: false },
  ]

  const churnRiskClients = [
    { name: 'AgriCo ZA', product: 'Agrimo', renewal: '2025-08-01', score: 38 },
    { name: 'Thabo Legal', product: 'FairCase', renewal: '2025-09-15', score: 64 },
  ]

  const pipelineMovements = [
    { action: 'Zonga Pilot A', detail: 'Moved from prospect to contract_signed', positive: true },
    { action: 'Cape Logistics', detail: 'Renewal confirmed — +R120k', positive: true },
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        WoW movement across key business metrics. Reviewed every Monday morning.
      </p>

      {/* WoW metrics */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Week-on-Week Movement</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {movements.map(m => {
            const isPositive = m.trend === 'up' ? m.positive : !m.positive
            const trendColor = isPositive ? 'text-emerald-400' : 'text-red-400'
            const TrendIcon = m.trend === 'up' ? ArrowTrendingUpIcon : m.trend === 'down' ? ArrowTrendingDownIcon : ChartBarIcon
            return (
              <div key={m.label} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                <div className="flex items-end gap-2">
                  <p className={`text-lg font-bold ${!isPositive && m.trend !== 'flat' ? 'text-red-400' : 'text-white'}`}>
                    {m.current}{m.unit}
                  </p>
                  <p className="text-xs text-slate-500 mb-0.5">from {m.previous}{m.unit}</p>
                </div>
                <div className={`flex items-center gap-1 mt-1 text-xs ${trendColor}`}>
                  <TrendIcon className="h-3 w-3" />
                  <span>{m.trend === 'flat' ? 'No change' : m.positive ? 'Positive' : 'Needs attention'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pipeline movement */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Pipeline Movement</h3>
        <div className="space-y-2">
          {pipelineMovements.map((m, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center gap-3">
              {m.positive ? (
                <CheckCircleIcon className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircleIcon className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <div>
                <span className="text-sm font-medium text-white">{m.action}:</span>{' '}
                <span className="text-sm text-slate-400">{m.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <Link href="/revenue" className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          View full pipeline <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>

      {/* Churn risk */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Churn Risk Watch</h3>
        <div className="space-y-2">
          {churnRiskClients.map(c => (
            <div key={c.name} className="bg-red-950/40 border border-red-800 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{c.name}</p>
                <p className="text-xs text-slate-400">{c.product} · Renewal {c.renewal}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${c.score < 50 ? 'text-red-400' : 'text-amber-400'}`}>{c.score}</p>
                <p className="text-xs text-slate-500">Health score</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product reliability */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Product Reliability</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          {[
            { name: 'FairCase', status: '3 P2 incidents', color: 'text-red-400' },
            { name: 'Zonga', status: '2 incidents, 0 deploys', color: 'text-amber-400' },
            { name: 'Flow', status: 'Clean — 3 deploys', color: 'text-emerald-400' },
          ].map(p => (
            <div key={p.name} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-sm font-semibold text-white">{p.name}</p>
              <p className={`text-xs mt-0.5 ${p.color}`}>{p.status}</p>
            </div>
          ))}
        </div>
        <Link href="/command-center" className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          Full product health <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

function MonthlyBoardView() {
  const metrics: MonthlyMetric[] = [
    { label: 'Total ARR (proxy)', value: 'R600k', delta: '+R120k', note: 'New contract: Cape Logistics' },
    { label: 'Active Clients', value: '5', delta: '+1', note: 'Zonga Pilot A signed' },
    { label: 'Churned Clients', value: '0', note: 'No churn this month' },
    { label: 'NRR (proxy)', value: '120%', delta: '+20%', note: 'Expansion from Cape Logistics' },
    { label: 'Support Tickets (month)', value: '34', delta: '+6', note: 'FairCase P2 cluster main driver' },
    { label: 'SLA Attainment', value: '87%', delta: '-7%', note: 'Below target of 95%' },
    { label: 'Deployments Shipped', value: '11', delta: '+4', note: 'Flow and Platform leading' },
    { label: 'Open Bugs', value: '16', delta: '+3', note: 'FairCase primary source' },
  ]

  const wins = [
    'Cape Logistics signed 12-month contract — R120k ARR added',
    'Flow shipped 3 features — zero incident regressions',
    'Platform infra migrated to Canada Central — 40% cost reduction',
  ]

  const risks = [
    'AgriCo ZA renewal risk: renewal in 32 days, health score 38/100',
    'FairCase quality: 3 P2 incidents in one month — requires RCA',
    'Lerato M. overloaded — 12 tickets, potential burnout',
  ]

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Monthly board-level summary. Reviewed on the last working Friday of every month.
      </p>

      {/* Revenue & retention metrics */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Revenue & Retention</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{m.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-white">{m.value}</p>
                {m.delta && (
                  <p className={`text-xs font-medium ${m.delta.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.delta}
                  </p>
                )}
              </div>
              {m.note && <p className="text-xs text-slate-500 mt-0.5">{m.note}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Wins */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Major Wins</h3>
        <div className="space-y-1.5">
          {wins.map((w, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-4 py-2.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200">{w}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risks */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Risks Going Forward</h3>
        <div className="space-y-1.5">
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-2.5">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200">{r}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap delivery */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Roadmap Delivery</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          {[
            { product: 'Flow', planned: 4, shipped: 3, color: 'emerald' },
            { product: 'FairCase', planned: 3, shipped: 1, color: 'red' },
            { product: 'Zonga', planned: 2, shipped: 0, color: 'red' },
          ].map(p => {
            const pct = Math.round((p.shipped / p.planned) * 100)
            return (
              <div key={p.product} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <p className="text-sm font-semibold text-white mb-2">{p.product}</p>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-${p.color}-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{p.shipped}/{p.planned} shipped ({pct}%)</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <Link href="/board" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
          Generate board pack <ArrowRightIcon className="h-4 w-4" />
        </Link>
        <Link href="/evidence-packs" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
          Evidence packs <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WeeklyReviewPage() {
  const [cadence, setCadence] = useState<Cadence>('weekly')

  const tabs: { key: Cadence; label: string; icon: React.ElementType; description: string }[] = [
    { key: 'daily', label: 'Daily Ops', icon: BoltIcon, description: 'Urgent · Priorities · Blockers' },
    { key: 'weekly', label: 'Weekly Exec', icon: CalendarDaysIcon, description: 'Pipeline · Churn · Product' },
    { key: 'monthly', label: 'Monthly Board', icon: DocumentTextIcon, description: 'Revenue · Retention · Roadmap' },
  ]

  return (
    <main className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Execution Rhythm</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Daily ops, weekly exec review, and monthly board — all in one view.
          </p>
        </div>
        <Link
          href="/command-center"
          className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
        >
          ← Command Center
        </Link>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = cadence === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setCadence(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {!active && (
                <span className="hidden lg:block text-xs text-slate-600">— {tab.description}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
        {cadence === 'daily' && <DailyOpsView />}
        {cadence === 'weekly' && <WeeklyExecView />}
        {cadence === 'monthly' && <MonthlyBoardView />}
      </div>
    </main>
  )
}
