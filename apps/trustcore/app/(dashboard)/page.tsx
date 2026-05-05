/**
 * TrustCore — Dashboard Home
 *
 * Displays a structured compliance posture overview.
 * All metric fields reflect the real data model — no static lorem content.
 */

import { getAuthContext } from '@/lib/auth/getAuthContext'
import { evaluateCompliance } from '@/lib/compliance/engine'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InboxArrowDownIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'
import type { ComplianceStatus } from '@/types/core'

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

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const styles: Record<ComplianceStatus, string> = {
    compliant: 'bg-green-100 text-green-700',
    'at-risk': 'bg-yellow-100 text-yellow-700',
    'non-compliant': 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const ctx = await getAuthContext()

  // Stub inputs — will be replaced with real DB queries in the next prompt.
  const compliance = evaluateCompliance(ctx.orgId, {
    verifiedControlIds: [],
    applicableControlIds: [],
    openRisks: [],
  })

  const metrics = {
    complianceScore: compliance.score,
    openRisks: compliance.risks.length,
    pendingRequests: 0,
    incidentAlerts: 0,
    auditReadinessStatus: compliance.status,
  }

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
          value={`${metrics.complianceScore}/100`}
          sub="Based on verified controls"
          icon={ShieldCheckIcon}
          accent="text-teal-600"
        />
        <MetricCard
          title="Open Risks"
          value={metrics.openRisks}
          sub="Unresolved risk items"
          icon={ExclamationTriangleIcon}
          accent="text-yellow-500"
        />
        <MetricCard
          title="Pending Requests"
          value={metrics.pendingRequests}
          sub="Access / correction / deletion"
          icon={InboxArrowDownIcon}
          accent="text-blue-500"
        />
        <MetricCard
          title="Incident Alerts"
          value={metrics.incidentAlerts}
          sub="Active incidents requiring action"
          icon={BellAlertIcon}
          accent="text-red-500"
        />
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-indigo-500" />
            <p className="text-sm font-medium text-gray-500">Audit Readiness</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={metrics.auditReadinessStatus} />
            <p className="text-xs text-gray-400">
              Evaluated {new Date(compliance.evaluatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
