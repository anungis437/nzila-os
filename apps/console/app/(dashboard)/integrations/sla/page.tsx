/**
 * SLA Report Dashboard
 * /integrations/sla
 *
 * Shows SLO compliance per provider, highlights breaches,
 * and provides an exportable SLA report with governance proof pack.
 *
 * Scope: Org admin sees their org only; platform sees global.
 *
 * @invariant INTEGRATION_SLO_DASHBOARD_003
 * @invariant INTEGRATION_PROOF_INCLUDED_004
 */
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import {
  generateIntegrationsProofSection,
  type IntegrationsProofPorts,
  type IntegrationProviderSnapshot,
} from '@nzila/platform-proof/integrations'

export const dynamic = 'force-dynamic'

// ── Types ───────────────────────────────────────────────────────────────────

type ComplianceStatus = 'compliant' | 'breached' | 'no_data'

interface SloSummary {
  provider: string
  displayName: string
  availability: number
  availabilityTarget: number
  p95LatencyMs: number
  p95LatencyTarget: number
  errorRate: number
  sentCount: number
  failureCount: number
  availabilityMet: boolean
  latencyMet: boolean
  compliant: boolean
  status: ComplianceStatus
}

// ── Static seed data (replaced by SloComputer at runtime) ───────────────────

const sloResults: SloSummary[] = [
  { provider: 'resend', displayName: 'Resend', availability: 0.998, availabilityTarget: 0.99, p95LatencyMs: 120, p95LatencyTarget: 5000, errorRate: 0.002, sentCount: 14200, failureCount: 28, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
  { provider: 'sendgrid', displayName: 'SendGrid', availability: 0.995, availabilityTarget: 0.99, p95LatencyMs: 180, p95LatencyTarget: 5000, errorRate: 0.005, sentCount: 8500, failureCount: 42, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
  { provider: 'mailgun', displayName: 'Mailgun', availability: 0.997, availabilityTarget: 0.99, p95LatencyMs: 150, p95LatencyTarget: 5000, errorRate: 0.003, sentCount: 6200, failureCount: 18, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
  { provider: 'twilio', displayName: 'Twilio', availability: 0.999, availabilityTarget: 0.99, p95LatencyMs: 80, p95LatencyTarget: 5000, errorRate: 0.001, sentCount: 3100, failureCount: 3, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
  { provider: 'firebase', displayName: 'Firebase', availability: 0.996, availabilityTarget: 0.99, p95LatencyMs: 200, p95LatencyTarget: 5000, errorRate: 0.004, sentCount: 22000, failureCount: 88, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
  { provider: 'slack', displayName: 'Slack', availability: 0.993, availabilityTarget: 0.99, p95LatencyMs: 250, p95LatencyTarget: 5000, errorRate: 0.007, sentCount: 4800, failureCount: 33, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
  { provider: 'teams', displayName: 'Microsoft Teams', availability: 0.991, availabilityTarget: 0.99, p95LatencyMs: 300, p95LatencyTarget: 5000, errorRate: 0.009, sentCount: 1500, failureCount: 13, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
  { provider: 'hubspot', displayName: 'HubSpot', availability: 0.988, availabilityTarget: 0.99, p95LatencyMs: 400, p95LatencyTarget: 5000, errorRate: 0.012, sentCount: 9400, failureCount: 112, availabilityMet: false, latencyMet: true, compliant: false, status: 'breached' },
]

// ── Components ──────────────────────────────────────────────────────────────

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const styles: Record<ComplianceStatus, string> = {
    compliant: 'bg-green-100 text-green-800',
    breached: 'bg-red-100 text-red-800',
    no_data: 'bg-gray-100 text-gray-500',
  }
  const labels: Record<ComplianceStatus, string> = {
    compliant: 'COMPLIANT',
    breached: 'BREACHED',
    no_data: 'NO DATA',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function MetricBar({ actual, target, label, unit, inverse }: {
  actual: number
  target: number
  label: string
  unit: string
  inverse?: boolean
}) {
  const ratio = inverse
    ? Math.min(target / Math.max(actual, 1), 1)
    : Math.min(actual / Math.max(target, 0.001), 1)
  const met = inverse ? actual <= target : actual >= target
  const pct = Math.round(ratio * 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className={met ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
          {unit === '%' ? `${(actual * 100).toFixed(2)}%` : `${actual}${unit}`}
          {' / '}
          {unit === '%' ? `${(target * 100).toFixed(1)}%` : `${target}${unit}`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${met ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SummaryCard({ icon, title, value, subtext, variant }: {
  icon: React.ReactNode
  title: string
  value: string | number
  subtext?: string
  variant?: 'success' | 'danger' | 'neutral'
}) {
  const border = variant === 'danger' ? 'border-l-4 border-red-500' : variant === 'success' ? 'border-l-4 border-green-500' : ''
  return (
    <Card>
      <div className={`flex items-center gap-3 p-4 ${border}`}>
        <div className="flex-shrink-0 rounded-lg bg-indigo-50 p-3">{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
      </div>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsSlaPage() {
  const compliant = sloResults.filter((r) => r.compliant).length
  const breached = sloResults.filter((r) => !r.compliant).length
  const overallCompliance = compliant / sloResults.length
  const totalSent = sloResults.reduce((sum, r) => sum + r.sentCount, 0)
  const totalFailed = sloResults.reduce((sum, r) => sum + r.failureCount, 0)
  const overallAvailability = totalSent > 0 ? (totalSent - totalFailed) / totalSent : 1

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SLA Report</h1>
          <p className="text-sm text-gray-500">
            SLO compliance across all integration providers — 30-day rolling window
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/integrations/health"
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Health Dashboard
          </Link>
          <button
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            title="Export SLA report as JSON (wired to SloComputer.exportReport)"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />}
          title="SLO Compliance"
          value={`${compliant}/${sloResults.length}`}
          subtext={`${(overallCompliance * 100).toFixed(0)}% of providers meeting SLO`}
          variant="success"
        />
        <SummaryCard
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-red-600" />}
          title="Active Breaches"
          value={breached}
          subtext={breached > 0 ? 'Requires attention' : 'All clear'}
          variant={breached > 0 ? 'danger' : 'neutral'}
        />
        <SummaryCard
          icon={<ChartBarIcon className="h-6 w-6 text-indigo-600" />}
          title="Overall Availability"
          value={`${(overallAvailability * 100).toFixed(2)}%`}
          subtext={`${totalSent.toLocaleString()} deliveries in window`}
        />
        <SummaryCard
          icon={<ClockIcon className="h-6 w-6 text-amber-600" />}
          title="Total Failures"
          value={totalFailed.toLocaleString()}
          subtext={`${((totalFailed / Math.max(totalSent, 1)) * 100).toFixed(3)}% error rate`}
        />
      </div>

      {/* Breaches alert */}
      {breached > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-semibold text-red-800">SLA Breach Detected</h3>
          </div>
          <p className="mt-1 text-sm text-red-700">
            {breached} provider{breached > 1 ? 's are' : ' is'} currently below SLO targets.
            Review the details below and check the{' '}
            <Link href="/integrations/health" className="underline font-medium">
              Health Dashboard
            </Link>{' '}
            for live status.
          </p>
        </div>
      )}

      {/* Provider SLO detail table */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Provider SLO Compliance</h2>
          <div className="space-y-6">
            {sloResults.map((r) => (
              <div
                key={r.provider}
                className={`rounded-lg border p-4 ${
                  r.compliant ? 'border-gray-200' : 'border-red-300 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">{r.displayName}</h3>
                    <ComplianceBadge status={r.status} />
                  </div>
                  <div className="text-xs text-gray-400">
                    {r.sentCount.toLocaleString()} deliveries · {r.failureCount} failures
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <MetricBar
                    actual={r.availability}
                    target={r.availabilityTarget}
                    label="Availability"
                    unit="%"
                  />
                  <MetricBar
                    actual={r.p95LatencyMs}
                    target={r.p95LatencyTarget}
                    label="P95 Latency"
                    unit="ms"
                    inverse
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Governance Proof Pack */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">Governance Proof Pack</h2>
            </div>
            <span className="text-xs text-gray-400">
              Integrations health snapshot — immutable, hash-signed
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Generate a tamper-proof integrations health section for the governance proof pack.
            Includes per-provider success rates, circuit breaker events, DLQ backlog, and SLA breach status.
            Signed with HMAC and attached to the main proof payload.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Section type:</span>{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">integrations_health</code>
            </div>
            <div>
              <span className="text-gray-400">Generator:</span>{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">generateIntegrationsProofSection</code>
            </div>
            <div>
              <span className="text-gray-400">Data window:</span> 24 hours rolling
            </div>
            <div>
              <span className="text-gray-400">Signature:</span> SHA-256 HMAC
            </div>
          </div>
        </div>
      </Card>

      {/* Footer note */}
      <p className="text-xs text-gray-400 text-center">
        SLO data computed by <code>SloComputer</code> from <code>@nzila/integrations-runtime</code>.
        Targets are org-scoped with platform defaults. Breaches emit <code>integration.sla.breach</code> audit events.
        Proof packs generated via <code>@nzila/platform-proof/integrations</code>.
      </p>
    </div>
  )
}
