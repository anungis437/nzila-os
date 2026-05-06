/**
 * TrustCore — Compliance View
 *
 * Full compliance evaluation output: score gauge, confidence indicator,
 * status badge, summary stats, and a grouped risk list with recommendations.
 *
 * This is a server component — data is fetched upstream and passed as props.
 */

import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ClockIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline'
import type { ComplianceEvaluation, RiskItem, RiskCategory, RiskSeverity } from '@/types/core'
import { ComplianceStatusBadge } from './ComplianceStatusBadge'

// ── Score gauge ────────────────────────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: number }) {
  const color =
    confidence >= 70
      ? 'bg-green-100 text-green-700'
      : confidence >= 40
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      Confidence: {confidence}%
    </span>
  )
}

function ScoreGauge({ score, confidence, status }: { score: number; confidence: number; status: ComplianceEvaluation['status'] }) {
  const color =
    status === 'compliant'
      ? 'text-green-600'
      : status === 'at-risk'
        ? 'text-yellow-600'
        : 'text-red-600'

  const trackColor =
    status === 'compliant'
      ? 'bg-green-500'
      : status === 'at-risk'
        ? 'bg-yellow-400'
        : 'bg-red-500'

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <p className={`text-7xl font-black tabular-nums ${color}`}>{score}</p>
      <p className="text-sm text-gray-500 -mt-1">out of 100</p>
      {/* Progress bar */}
      <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${trackColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <ComplianceStatusBadge status={status} />
        <ConfidencePill confidence={confidence} />
      </div>
      {confidence < 60 && (
        <p className="text-xs text-yellow-600 text-center max-w-48">
          Low confidence — populate more modules for a reliable score
        </p>
      )}
    </div>
  )
}

// ── Summary stats ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  warning?: boolean
}

function StatCard({ label, value, warning }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className={`text-2xl font-bold ${warning && value > 0 ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

// ── SLA deadline display ───────────────────────────────────────────────────

function slaDeadlineText(
  deadline: string,
  nowMs: number,
): { text: string; color: string } {
  const deadlineMs = new Date(deadline).getTime()
  const diffMs = deadlineMs - nowMs

  if (diffMs <= 0) {
    return {
      text: `SLA deadline passed — ${new Date(deadline).toLocaleString()}`,
      color: 'text-red-600',
    }
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const color = hours < 4 ? 'text-red-600' : hours < 24 ? 'text-orange-500' : 'text-yellow-600'
  return {
    text: `${hours}h ${minutes}m remaining · Deadline: ${new Date(deadline).toLocaleString()}`,
    color,
  }
}

// ── Risk item ──────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<RiskSeverity, string> = {
  critical: 'border-l-red-500 bg-red-50',
  high: 'border-l-orange-400 bg-orange-50',
  medium: 'border-l-yellow-400 bg-yellow-50',
  low: 'border-l-gray-300 bg-gray-50',
}

const SEVERITY_ICON: Record<RiskSeverity, React.ComponentType<{ className?: string }>> = {
  critical: ExclamationCircleIcon,
  high: ExclamationTriangleIcon,
  medium: ExclamationTriangleIcon,
  low: InformationCircleIcon,
}

const SEVERITY_ICON_COLOR: Record<RiskSeverity, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-gray-400',
}

const EFFORT_LABELS: Record<NonNullable<RiskItem['effort']>, string> = {
  low: 'Quick fix',
  medium: 'Medium effort',
  high: 'Significant effort',
}

function RiskCard({ item, nowMs }: { item: RiskItem; nowMs: number }) {
  const Icon = SEVERITY_ICON[item.severity]
  return (
    <div
      className={`border-l-4 rounded-r-xl p-4 ${SEVERITY_STYLES[item.severity]}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${SEVERITY_ICON_COLOR[item.severity]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {item.severity}
            </span>
            {item.blocking && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                <NoSymbolIcon className="h-3 w-3" />
                BLOCKING
              </span>
            )}
            {item.effort && (
              <span className="text-xs text-gray-400">
                · {EFFORT_LABELS[item.effort]}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900">{item.message}</p>
          <p className="text-xs text-gray-600 mt-1">
            <span className="font-semibold">Recommendation: </span>
            {item.recommendation}
          </p>
          {item.slaDeadline && (() => {
            const sla = slaDeadlineText(item.slaDeadline, nowMs)
            return (
              <p className={`text-xs font-bold flex items-center gap-1 mt-1 ${sla.color}`}>
                <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                {sla.text}
              </p>
            )
          })()}
          {item.actionUrl && (
            <a
              href={item.actionUrl}
              className="inline-block mt-2 text-xs font-medium text-teal-600 hover:text-teal-700 underline"
            >
              → Go to module
            </a>
          )}
          {item.evidenceRefs && item.evidenceRefs.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {item.evidenceRefs.length} evidence record(s) linked
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Category section ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  governance: 'Governance',
  data: 'Data Inventory',
  pia: 'Privacy Impact Assessments',
  incident: 'Incidents',
  dsr: 'DSR Requests',
  vendor: 'Vendors',
}

const SEVERITY_ORDER: RiskSeverity[] = ['critical', 'high', 'medium', 'low']

function sortRisks(risks: RiskItem[]): RiskItem[] {
  return [...risks].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
}

function RiskSection({ category, risks, nowMs }: { category: RiskCategory; risks: RiskItem[]; nowMs: number }) {
  if (risks.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        {CATEGORY_LABELS[category]}
      </h3>
      <div className="space-y-2">
        {sortRisks(risks).map((item) => (
          <RiskCard key={item.id} item={item} nowMs={nowMs} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

const ALL_CATEGORIES: RiskCategory[] = ['governance', 'data', 'pia', 'incident', 'dsr', 'vendor']

interface ComplianceViewProps {
  evaluation: ComplianceEvaluation
}

export function ComplianceView({ evaluation }: ComplianceViewProps) {
  const { score, confidence, status, risks, summary, evaluatedAt } = evaluation
  // Use the evaluation timestamp as the reference "now" to keep this deterministic
  // for server rendering. SLA deadlines are relative to this point in time.
  const nowMs = new Date(evaluatedAt).getTime()

  const risksByCategory = ALL_CATEGORIES.reduce<Record<RiskCategory, RiskItem[]>>(
    (acc, cat) => {
      acc[cat] = risks.filter((r) => r.category === cat)
      return acc
    },
    { governance: [], data: [], pia: [], incident: [], dsr: [], vendor: [] },
  )

  const hasRisks = risks.length > 0

  return (
    <div className="space-y-8">
      {/* Score + status */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid md:grid-cols-[1fr_auto] divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Gauge */}
          <ScoreGauge score={score} confidence={confidence} status={status} />

          {/* Summary stats */}
          <div className="p-6 flex flex-col justify-center gap-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Summary
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Active Assets" value={summary.totalAssets} />
              <StatCard label="Missing PIAs" value={summary.missingPias} warning />
              <StatCard label="Overdue Requests" value={summary.overdueRequests} warning />
              <StatCard label="Open Incidents" value={summary.openIncidents} warning />
              <StatCard label="High-risk Vendors" value={summary.highRiskVendors} warning />
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-lg font-bold text-gray-900">{risks.length}</p>
                <p className="text-xs text-gray-500 mt-1">Total Risks</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Last evaluated {new Date(evaluatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Risk list */}
      {hasRisks ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {risks.length} Compliance Risk{risks.length !== 1 ? 's' : ''} Detected
            </h2>
          </div>
          {ALL_CATEGORIES.map((cat) => (
            <RiskSection key={cat} category={cat} risks={risksByCategory[cat]} nowMs={nowMs} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShieldCheckIcon className="h-12 w-12 mx-auto mb-4 text-green-400" />
          <p className="text-lg font-semibold text-gray-900">No compliance risks detected</p>
          <p className="text-sm text-gray-400 mt-1">
            All Law 25 checks passed for this organisation.
          </p>
        </div>
      )}
    </div>
  )
}
