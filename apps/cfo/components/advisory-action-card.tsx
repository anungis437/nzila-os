/**
 * CFO — Advisory Action Card (Client Component).
 *
 * Renders actionable AI-driven advisory insights as cards with
 * priority badges, impact estimates, and one-click action buttons.
 * Used on the Advisory AI page and Dashboard home.
 */
'use client'

import { useState } from 'react'
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Clock,
} from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────────────────── */

export type AdvisoryPriority = 'critical' | 'high' | 'medium' | 'low'
export type AdvisoryCategory = 'tax' | 'cash-flow' | 'compliance' | 'growth' | 'risk'

export interface AdvisoryInsight {
  id: string
  title: string
  description: string
  category: AdvisoryCategory
  priority: AdvisoryPriority
  estimatedImpact: number
  actionLabel: string
  details?: string
  clientName?: string
  dueDate?: string
}

interface AdvisoryActionCardProps {
  insights?: AdvisoryInsight[]
  onAction?: (insightId: string) => void
}

/* ── Demo data ────────────────────────────────────────────────────────────── */

const DEMO_INSIGHTS: AdvisoryInsight[] = [
  {
    id: 'adv-001',
    title: 'Tax-loss harvesting opportunity',
    description:
      'Client portfolio has $14,200 in unrealized losses that can offset $22,800 capital gains before year-end.',
    category: 'tax',
    priority: 'high',
    estimatedImpact: 3_692,
    actionLabel: 'Generate Harvest Plan',
    clientName: 'Maple Corp',
    dueDate: '2026-12-15',
    details:
      'By selling specific lots and immediately repurchasing (30-day rule compliant alternatives), ' +
      'we can crystalize losses to offset the Q3 gains. Net tax savings: ~$3,692 at 25.98% rate.',
  },
  {
    id: 'adv-002',
    title: 'GST/HST installment reminder',
    description: 'Quarterly installment due in 12 days. Estimated amount: $8,450 based on prior-year method.',
    category: 'compliance',
    priority: 'critical',
    estimatedImpact: 0,
    actionLabel: 'Prepare Filing',
    dueDate: '2026-07-31',
    details:
      'CRA requires quarterly installments when annual net tax exceeds $3,000. ' +
      'Prior-year method yields $8,450; current-year method yields $7,920.',
  },
  {
    id: 'adv-003',
    title: 'Salary vs dividend optimization',
    description:
      'Switching to 60/40 salary-dividend split could save $6,800/yr for this CCPC.',
    category: 'tax',
    priority: 'medium',
    estimatedImpact: 6_800,
    actionLabel: 'Run Full Analysis',
    clientName: 'Ottawa Digital',
    details:
      'Current 100% salary structure misses eligible dividend integration benefits at their income level. ' +
      'A blended approach preserves CPP/RRSP room while reducing total tax burden.',
  },
  {
    id: 'adv-004',
    title: 'Cash flow crunch predicted',
    description: 'AR aging shows $30K in 60+ day receivables. Cash runway drops to 18 days in 6 weeks.',
    category: 'cash-flow',
    priority: 'high',
    estimatedImpact: 30_000,
    actionLabel: 'Start Dunning Workflow',
    clientName: 'Capital Health Inc.',
    details:
      'Three invoices over $10K each are overdue. Sending dunning sequence now with escalation ' +
      'at 75 and 90 days. Consider offering early-payment discount (2/10 NET 30) on future invoices.',
  },
]

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const priorityConfig: Record<
  AdvisoryPriority,
  { bg: string; text: string; label: string }
> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Critical' },
  high: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'High' },
  medium: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Medium' },
  low: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Low' },
}

const categoryIcon: Record<AdvisoryCategory, React.ReactNode> = {
  tax: <DollarSign className="h-4 w-4" />,
  'cash-flow': <TrendingUp className="h-4 w-4" />,
  compliance: <Shield className="h-4 w-4" />,
  growth: <Zap className="h-4 w-4" />,
  risk: <AlertTriangle className="h-4 w-4" />,
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-CA', { maximumFractionDigits: 0 })

/* ── Component ────────────────────────────────────────────────────────────── */

export function AdvisoryActionCards({
  insights = DEMO_INSIGHTS,
  onAction,
}: AdvisoryActionCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actedOn, setActedOn] = useState<Set<string>>(new Set())

  const handleAction = (id: string) => {
    setActedOn((prev) => new Set(prev).add(id))
    onAction?.(id)
  }

  const sortedInsights = [...insights].sort((a, b) => {
    const order: Record<AdvisoryPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    }
    return order[a.priority] - order[b.priority]
  })

  return (
    <div className="space-y-3">
      {/* Header stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Lightbulb className="h-4 w-4 text-electric" />
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </span>
        <span>
          Total impact:{' '}
          <span className="font-semibold text-electric">
            {fmt(insights.reduce((s, i) => s + i.estimatedImpact, 0))}
          </span>
        </span>
        {actedOn.size > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {actedOn.size} acted on
          </span>
        )}
      </div>

      {/* Cards */}
      {sortedInsights.map((insight) => {
        const isExpanded = expandedId === insight.id
        const isActed = actedOn.has(insight.id)
        const priority = priorityConfig[insight.priority]

        return (
          <div
            key={insight.id}
            className={`rounded-xl border bg-card p-4 shadow-sm transition-colors ${
              isActed ? 'border-green-500/30 opacity-75' : 'border-border hover:border-electric/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Left */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0 text-muted-foreground">
                  {categoryIcon[insight.category]}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priority.bg} ${priority.text}`}>
                      {priority.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{insight.description}</p>
                  {(insight.clientName || insight.dueDate) && (
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {insight.clientName && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> {insight.clientName}
                        </span>
                      )}
                      {insight.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Due {insight.dueDate}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-2 shrink-0">
                {insight.estimatedImpact > 0 && (
                  <span className="text-sm font-semibold text-electric">{fmt(insight.estimatedImpact)}</span>
                )}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground
                             hover:bg-secondary transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && insight.details && (
              <div className="mt-3 rounded-lg bg-secondary/50 px-4 py-3 text-sm text-foreground">
                {insight.details}
              </div>
            )}

            {/* Action button */}
            <div className="mt-3 flex justify-end">
              {isActed ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Action triggered
                </span>
              ) : (
                <button
                  onClick={() => handleAction(insight.id)}
                  className="rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white
                             shadow-sm transition-colors hover:bg-electric/90"
                >
                  <Zap className="mr-1.5 inline h-3.5 w-3.5" />
                  {insight.actionLabel}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
