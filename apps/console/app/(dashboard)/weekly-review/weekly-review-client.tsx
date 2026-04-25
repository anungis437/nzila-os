'use client'

import { useState, type ElementType } from 'react'
import Link from 'next/link'
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  BoltIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { CommandPageShell } from '@/components/command-page-shell'

type Cadence = 'daily' | 'weekly' | 'monthly'

export interface WeeklyReviewData {
  daily: {
    items: Array<{
      id: string
      type: 'urgent' | 'priority' | 'blocker'
      label: string
      detail?: string
      href?: string
    }>
    p1p2Open: number
    atRiskClients: number
    hardBlockers: number
  }
  weekly: {
    summary: string
    decisionCandidates: Array<{ title: string; detail: string; priority: string }>
    pipelineMovements: Array<{ action: string; detail: string; positive: boolean }>
    churnRiskClients: Array<{ name: string; product: string; renewal: string; score: number }>
    productHealth: Array<{ product: string; incidentsThisMonth: number; supportLoad: number; deploymentsShipped: number; openBugs: number }>
    risksRising: string[]
  }
  monthly: {
    metrics: Array<{ label: string; value: string; delta?: string; note?: string }>
    wins: string[]
    risks: string[]
    roadmapSignals: Array<{ product: string; incidentsThisMonth: number; supportLoad: number; deploymentsShipped: number; openBugs: number }>
  }
}

function DailyOpsView({ daily }: { daily: WeeklyReviewData['daily'] }) {
  const badge = (t: WeeklyReviewData['daily']['items'][number]['type']) => ({
    urgent: 'bg-red-950/60 text-red-300 border border-red-700',
    priority: 'bg-amber-950/60 text-amber-300 border border-amber-600',
    blocker: 'bg-purple-950/60 text-purple-300 border border-purple-700',
  }[t])

  const labelMap = { urgent: 'Urgent', priority: 'Priority', blocker: 'Blocker' }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300 leading-relaxed">
        High-signal items that need a decision or action today. Pulled from execution initiatives, support risk, and account attention signals.
      </p>
      <div className="space-y-2">
        {daily.items.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-400">
            No urgent execution items are open right now.
          </div>
        ) : daily.items.map(item => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-start gap-3">
            <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 mt-0.5 ${badge(item.type)}`}>
              {labelMap[item.type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{item.label}</p>
              {item.detail && <p className="text-xs text-slate-300 mt-0.5">{item.detail}</p>}
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
          <p className="text-xl font-bold text-red-400">{daily.p1p2Open}</p>
          <p className="text-xs text-slate-300 mt-0.5">P1-P2 open</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-amber-400">{daily.atRiskClients}</p>
          <p className="text-xs text-slate-300 mt-0.5">At-risk clients</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-purple-400">{daily.hardBlockers}</p>
          <p className="text-xs text-slate-300 mt-0.5">Hard blockers</p>
        </div>
      </div>
    </div>
  )
}

function WeeklyExecView({ weekly }: { weekly: WeeklyReviewData['weekly'] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-300">{weekly.summary}</p>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Decision Queue</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {weekly.decisionCandidates.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-400">
              No executive decisions queued.
            </div>
          ) : weekly.decisionCandidates.map((item) => (
            <div key={item.title} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="text-xs text-slate-300 mt-1">{item.detail}</p>
              <p className="text-xs text-slate-400 mt-1 uppercase">{item.priority}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Pipeline Movement</h3>
        <div className="space-y-2">
          {weekly.pipelineMovements.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-400">
              No founder-action pipeline items are currently aging.
            </div>
          ) : weekly.pipelineMovements.map((movement) => (
            <div key={movement.action} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center gap-3">
              {movement.positive ? (
                <CheckCircleIcon className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircleIcon className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <div>
                <span className="text-sm font-medium text-white">{movement.action}:</span>{' '}
                <span className="text-sm text-slate-300">{movement.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <Link href="/revenue" className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          View full pipeline <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Churn Risk Watch</h3>
        <div className="space-y-2">
          {weekly.churnRiskClients.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-400">
              No at-risk client accounts are currently flagged.
            </div>
          ) : weekly.churnRiskClients.map((client) => (
            <div key={client.name} className="bg-red-950/40 border border-red-800 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{client.name}</p>
                <p className="text-xs text-slate-300">{client.product.replace(/_/g, ' ')} · Renewal {client.renewal}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${client.score < 50 ? 'text-red-400' : 'text-amber-400'}`}>{client.score}</p>
                <p className="text-xs text-slate-400">Health score</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Product Reliability</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {weekly.productHealth.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-400">
              No product health snapshots available.
            </div>
          ) : weekly.productHealth.map((product) => (
            <div key={product.product} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-sm font-semibold text-white">{product.product.replace(/_/g, ' ')}</p>
              <p className={`text-xs mt-0.5 ${product.incidentsThisMonth > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {product.incidentsThisMonth} incidents · {product.deploymentsShipped} deploys
              </p>
              <p className="text-xs text-slate-400 mt-1">support {product.supportLoad} · bugs {product.openBugs}</p>
            </div>
          ))}
        </div>
      </div>

      {weekly.risksRising.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Cross-Domain Risks</h3>
          <div className="space-y-1.5">
            {weekly.risksRising.map((risk) => (
              <div key={risk} className="flex items-start gap-2.5 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-2.5">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-200">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MonthlyBoardView({ monthly }: { monthly: WeeklyReviewData['monthly'] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Monthly board-level summary, built from runway, capital priority, and product health signals.
      </p>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Board Metrics</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {monthly.metrics.map(metric => (
            <div key={metric.label} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">{metric.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-white">{metric.value}</p>
                {metric.delta && <p className="text-xs font-medium text-blue-400">{metric.delta}</p>}
              </div>
              {metric.note && <p className="text-xs text-slate-400 mt-0.5">{metric.note}</p>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Major Wins</h3>
        <div className="space-y-1.5">
          {monthly.wins.map((win) => (
            <div key={win} className="flex items-start gap-2.5 bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-4 py-2.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200">{win}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Risks Going Forward</h3>
        <div className="space-y-1.5">
          {monthly.risks.map((risk) => (
            <div key={risk} className="flex items-start gap-2.5 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-2.5">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200">{risk}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Roadmap Delivery Signals</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {monthly.roadmapSignals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-400">
              No product delivery signals available.
            </div>
          ) : monthly.roadmapSignals.map((signal) => (
            <div key={signal.product} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-sm font-semibold text-white mb-2">{signal.product.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-300">deploys {signal.deploymentsShipped}</p>
              <p className="text-xs text-slate-300">incidents {signal.incidentsThisMonth}</p>
              <p className="text-xs text-slate-300">bugs {signal.openBugs}</p>
            </div>
          ))}
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

export function WeeklyReviewClient({ data }: { data: WeeklyReviewData }) {
  const [cadence, setCadence] = useState<Cadence>('weekly')

  const tabs: { key: Cadence; label: string; icon: ElementType; description: string }[] = [
    { key: 'daily', label: 'Daily Ops', icon: BoltIcon, description: 'Urgent · Priorities · Blockers' },
    { key: 'weekly', label: 'Weekly Exec', icon: CalendarDaysIcon, description: 'Pipeline · Churn · Product' },
    { key: 'monthly', label: 'Monthly Board', icon: DocumentTextIcon, description: 'Runway · Risks · Delivery' },
  ]

  return (
    <CommandPageShell className="space-y-8 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Execution Rhythm</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Daily ops, weekly exec review, and monthly board - all in one view.
          </p>
        </div>
        <Link
          href="/command-center"
          className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
        >
          ← Command Center
        </Link>
      </div>

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
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {!active && (
                <span className="hidden lg:block text-xs text-slate-400">- {tab.description}</span>
              )}
            </button>
          )
        })}
      </div>

      {cadence === 'daily' && <DailyOpsView daily={data.daily} />}
      {cadence === 'weekly' && <WeeklyExecView weekly={data.weekly} />}
      {cadence === 'monthly' && <MonthlyBoardView monthly={data.monthly} />}
    </CommandPageShell>
  )
}