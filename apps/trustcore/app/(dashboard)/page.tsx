/**
 * TrustCore — Dashboard Home
 *
 * Displays a live compliance posture overview backed by DB queries.
 */

import { getAuthContext } from '@/lib/auth/getAuthContext'
import { getTrustcoreDashboardSummary } from '@nzila/db/queries/trustcore'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InboxArrowDownIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import type { TrustcoreDashboardSummary } from '@nzila/db/queries/trustcore'

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
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub: string
  external?: boolean
}) {
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

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const ctx = await getAuthContext()
  const summary = await getTrustcoreDashboardSummary(ctx.orgId)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Org: <span className="font-mono">{ctx.orgId}</span> · Law 25 framework
        </p>
      </div>

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
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Export &amp; Share
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ExportButton
            href="/api/export/audit"
            icon={ArrowDownTrayIcon}
            label="Download Audit Report (JSON)"
            sub="Full structured audit export for this org"
          />
          <ExportButton
            href="/api/export/evidence"
            icon={DocumentTextIcon}
            label="Download Evidence Bundle"
            sub="All evidence events, grouped by type"
          />
          <ExportButton
            href={`/trust-center/${ctx.orgId}`}
            icon={GlobeAltIcon}
            label="View Trust Center"
            sub="Shareable compliance summary page"
            external
          />
        </div>
      </div>
    </div>
  )
}
