/**
 * Integrations Health Dashboard
 * /integrations/health
 *
 * Shows provider health status, success rates, P95 latency,
 * rate-limit events, and circuit breaker state.
 *
 * Scope: Org admin sees their org only; platform sees global with filters.
 *
 * @invariant INTEGRATION_HEALTHCHECK_REQUIRED_002
 */
import {
  HeartIcon,
  SignalIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getProviderHealthList, type ProviderHealthRow } from '@/lib/server-data'

export const dynamic = 'force-dynamic'

// ── Types for the dashboard ─────────────────────────────────────────────────

type HealthStatus = ProviderHealthRow['status']
type CircuitState = ProviderHealthRow['circuitState']

// ── Components ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealthStatus }) {
  const styles: Record<HealthStatus, string> = {
    ok: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    down: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  )
}

function CircuitBadge({ state }: { state: CircuitState }) {
  const styles: Record<CircuitState, string> = {
    closed: 'bg-green-100 text-green-800',
    half_open: 'bg-yellow-100 text-yellow-800',
    open: 'bg-red-100 text-red-800',
  }
  const labels: Record<CircuitState, string> = {
    closed: 'CLOSED',
    half_open: 'HALF-OPEN',
    open: 'OPEN',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[state]}`}>
      {labels[state]}
    </span>
  )
}

function SummaryCard({ icon, title, value, subtext }: {
  icon: React.ReactNode
  title: string
  value: string | number
  subtext?: string
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 p-4">
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

export default async function IntegrationsHealthPage() {
  const providers = await getProviderHealthList()
  const healthy = providers.filter((p) => p.status === 'ok').length
  const degraded = providers.filter((p) => p.status === 'degraded').length
  const down = providers.filter((p) => p.status === 'down').length
  const avgSuccessRate = providers.reduce((sum, p) => sum + p.successRate, 0) / providers.length
  const totalRateLimited = providers.reduce((sum, p) => sum + p.rateLimitedCount, 0)
  const circuitsOpen = providers.filter((p) => p.circuitState === 'open').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integration Health</h1>
          <p className="text-sm text-gray-500">Provider status, latency, and circuit breaker overview</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/integrations"
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Catalog
          </Link>
          <Link
            href="/integrations/sla"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            SLA Report
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<HeartIcon className="h-6 w-6 text-green-600" />}
          title="Healthy Providers"
          value={`${healthy}/${providers.length}`}
          subtext={degraded > 0 ? `${degraded} degraded` : undefined}
        />
        <SummaryCard
          icon={<SignalIcon className="h-6 w-6 text-indigo-600" />}
          title="Avg Success Rate"
          value={`${avgSuccessRate.toFixed(1)}%`}
          subtext="Across all providers"
        />
        <SummaryCard
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />}
          title="Rate Limited Events"
          value={totalRateLimited}
          subtext="Current window"
        />
        <SummaryCard
          icon={<ShieldCheckIcon className="h-6 w-6 text-purple-600" />}
          title="Circuits Open"
          value={circuitsOpen}
          subtext={down > 0 ? `${down} providers down` : 'All circuits closed'}
        />
      </div>

      {/* Provider table */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Provider Health Status</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">P95 Latency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate Limited</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Circuit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {providers.map((p) => (
                  <tr key={p.provider} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.displayName}</td>
                    <td className="px-4 py-3 text-sm"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-sm">
                      <span className={p.successRate < 99 ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                        {p.successRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4 text-gray-400" />
                        {p.p95LatencyMs}ms
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={p.rateLimitedCount > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                        {p.rateLimitedCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm"><CircuitBadge state={p.circuitState} /></td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/integrations/health/${p.provider}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  )
}
