/**
 * TrustCore — Dashboard Home
 *
 * Displays a live compliance posture overview backed by DB queries.
 */

import { getAuthContext } from '@/lib/auth/getAuthContext'
import { getTrustcoreDashboardSummary, listTrustcoreReminders, listComplianceSnapshots } from '@nzila/db/queries/trustcore'
import { generateTrustcoreReminders } from '@/lib/reminders/engine'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import { canExportAudit, canExportEvidence, canAccessTrustCenter } from '@/lib/billing/featureAccess'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InboxArrowDownIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  BoltIcon,
  LockClosedIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline'
import type { TrustcoreDashboardSummary, TrustcoreComplianceSnapshot } from '@nzila/db/queries/trustcore'
import { ActionCenter } from '@/components/reminders/ActionCenter'
import { FreePlanBanner } from '@/components/billing/FreePlanBanner'

export const dynamic = 'force-dynamic'

// ── UI components ──────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`h-5 w-5 ${accent}`} />
        <p className="text-sm font-medium text-gray-500">{title}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

type AuditStatus = TrustcoreDashboardSummary['auditReadinessStatus']

function StatusBadge({ status }: { status: AuditStatus }) {
  const styles: Record<AuditStatus, string> = {
    ready: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    not_ready: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${styles[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Export action button ────────────────────────────────────────────────────

function ExportButton({
  href,
  icon: Icon,
  label,
  sub,
  external,
  locked,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub: string
  external?: boolean
  locked?: boolean
}) {
  if (locked) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 opacity-60 cursor-not-allowed" title="Upgrade to Pro to unlock">
        <LockClosedIcon className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-gray-500">{label}</p>
          <p className="text-xs text-gray-400">{sub}</p>
          <p className="text-xs text-amber-600 font-medium mt-0.5">Upgrade to Pro to unlock</p>
        </div>
      </div>
    )
  }
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 transition group"
    >
      <Icon className="h-5 w-5 text-teal-600 mt-0.5 shrink-0 group-hover:text-teal-700" />
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </a>
  )
}

// ── Compliance History widget ──────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  'compliant': 'bg-green-500',
  'partially-compliant': 'bg-yellow-400',
  'non-compliant': 'bg-red-500',
  'unknown': 'bg-gray-300',
}

function ComplianceHistory({ snapshots }: { snapshots: TrustcoreComplianceSnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardDocumentCheckIcon className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Compliance History</h2>
        </div>
        <p className="text-xs text-gray-400">No snapshots yet. Run a compliance check to start tracking.</p>
      </div>
    )
  }

  const latest = snapshots[0]!
  const previous = snapshots[1]
  const trend = !previous
    ? 'stable'
    : latest.score > previous.score
    ? 'up'
    : latest.score < previous.score
    ? 'down'
    : 'stable'

  const TrendIcon =
    trend === 'up' ? ArrowTrendingUpIcon : trend === 'down' ? ArrowTrendingDownIcon : MinusIcon
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Compliance History</h2>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
        </div>
      </div>
      <div className="space-y-2">
        {snapshots.slice(0, 3).map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[s.status] ?? STATUS_DOT.unknown}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">
                {s.createdAt?.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) ?? '—'}
                <span className="ml-2 text-gray-400">{s.triggeredBy}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-sm font-bold ${i === 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                {s.score}
              </span>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const ctx = await getAuthContext()

  // Run reminder engine to auto-refresh reminders on every dashboard load
  // (idempotent — won't create duplicates)
  await generateTrustcoreReminders(ctx.orgId).catch(() => {
    // Non-fatal: if reminder generation fails, dashboard still loads
  })

  const [summary, reminders, subscription, recentSnapshots] = await Promise.all([
    getTrustcoreDashboardSummary(ctx.orgId),
    listTrustcoreReminders(ctx.orgId),
    getResolvedSubscription(ctx.orgId),
    listComplianceSnapshots(ctx.orgId, 3),
  ])

  const canAct = ctx.role === 'org_admin' || ctx.role === 'staff' || ctx.role === 'platform_admin'
  const isFree = subscription.plan === 'free'
  // eslint-disable-next-line react-hooks/purity -- server component, not a hook
  const nowMs = Date.now()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Org: <span className="font-mono">{ctx.orgId}</span> · Law 25 framework
        </p>
      </div>
      {isFree && <FreePlanBanner />}

      {/* Metric cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <MetricCard
          title="Compliance Score"
          value={`${summary.complianceScore}/100`}
          sub="Live — deducted by open risks and overdue requests"
          icon={ShieldCheckIcon}
          accent="text-teal-600"
        />
        <MetricCard
          title="Open Risks"
          value={summary.openRisks}
          sub="Incidents open or contained"
          icon={ExclamationTriangleIcon}
          accent="text-yellow-500"
        />
        <MetricCard
          title="Pending Requests"
          value={summary.pendingRequests}
          sub="Access / correction / deletion / portability"
          icon={InboxArrowDownIcon}
          accent="text-blue-500"
        />
        <MetricCard
          title="Critical Incidents"
          value={summary.incidentAlerts}
          sub="Critical-severity open incidents"
          icon={BellAlertIcon}
          accent="text-red-500"
        />
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-indigo-500" />
            <p className="text-sm font-medium text-gray-500">Audit Readiness</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={summary.auditReadinessStatus} />
            <p className="text-xs text-gray-400">
              Evaluated {new Date(summary.evaluatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Export / Share actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Export &amp; Share
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ExportButton
            href="/api/export/audit"
            icon={ArrowDownTrayIcon}
            label="Download Audit Report (JSON)"
            sub="Full structured audit export for this org"
            locked={!canExportAudit(subscription)}
          />
          <ExportButton
            href="/api/export/evidence"
            icon={DocumentTextIcon}
            label="Download Evidence Bundle"
            sub="All evidence events, grouped by type"
            locked={!canExportEvidence(subscription)}
          />
          <ExportButton
            href={`/trust-center/${ctx.orgId}`}
            icon={GlobeAltIcon}
            label="View Trust Center"
            sub="Shareable compliance summary page"
            external
            locked={!canAccessTrustCenter(subscription)}
          />
        </div>
      </div>

      {/* Compliance History */}
      <ComplianceHistory snapshots={recentSnapshots} />

      {/* Action Center */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <BoltIcon className="h-4 w-4 text-teal-600" />
            Action Center
          </h2>
          {reminders.filter((r) => r.status === 'open' || r.status === 'overdue').length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
              {reminders.filter((r) => r.status === 'open' || r.status === 'overdue').length} active
            </span>
          )}
        </div>
        <ActionCenter reminders={reminders} canAct={canAct} nowMs={nowMs} />
      </div>
    </div>
  )
}
