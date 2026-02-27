/**
 * Nzila OS — Performance Envelope Dashboard
 *
 * Displays P50/P95/P99 latency, error rate, and per-app throughput.
 * Org-scoped for org admins; global view for platform admins.
 * No secrets exposed.
 *
 * @see @nzila/platform-performance
 */
import { requireRole, getUserRole } from '@/lib/rbac'
import {
  getPerformanceEnvelope,
  getGlobalPerformanceEnvelope,
} from '@nzila/platform-performance'
import {
  ClockIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

interface MetricCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  subtitle?: string
}

function MetricCard({ label, value, icon: Icon, color, subtitle }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-4">
        <div className={`inline-flex p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; orgId?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const role = await getUserRole()
  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const isPlatformAdmin = role === 'platform_admin' || role === 'studio_admin'
  const orgId = params.orgId

  const envelope = isPlatformAdmin && !orgId
    ? await getGlobalPerformanceEnvelope({ windowMinutes: 60 })
    : orgId
      ? await getPerformanceEnvelope(orgId, { windowMinutes: 60 })
      : null

  if (!envelope) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900">Performance Envelope</h1>
        <p className="text-gray-500 mt-4">
          Select an organization to view performance metrics.
        </p>
      </div>
    )
  }

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Performance Envelope</h1>
        <p className="text-gray-500 mt-1">
          {isPlatformAdmin && !orgId
            ? 'Global latency & throughput — all orgs'
            : `Org-scoped performance — ${orgId}`}
        </p>
      </div>

      {/* Percentile cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <MetricCard
          label="P50 Latency"
          value={`${envelope.p50}ms`}
          icon={ClockIcon}
          color="bg-blue-50 text-blue-600"
          subtitle="Median response time"
        />
        <MetricCard
          label="P95 Latency"
          value={`${envelope.p95}ms`}
          icon={BoltIcon}
          color="bg-amber-50 text-amber-600"
          subtitle="95th percentile"
        />
        <MetricCard
          label="P99 Latency"
          value={`${envelope.p99}ms`}
          icon={ExclamationTriangleIcon}
          color="bg-red-50 text-red-600"
          subtitle="99th percentile"
        />
        <MetricCard
          label="Error Rate"
          value={`${envelope.errorRate}%`}
          icon={ExclamationTriangleIcon}
          color={envelope.errorRate > 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
        />
        <MetricCard
          label="Throughput"
          value={`${envelope.throughput} req/min`}
          icon={ArrowTrendingUpIcon}
          color="bg-purple-50 text-purple-600"
        />
        <MetricCard
          label="Sample Size"
          value={envelope.sampleSize.toLocaleString()}
          icon={ServerStackIcon}
          color="bg-gray-100 text-gray-600"
          subtitle="Data points in window"
        />
      </div>

      {/* Per-app throughput table */}
      {envelope.perApp.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Throughput per App</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-6 py-3 font-medium">Route</th>
                <th className="px-6 py-3 font-medium">Requests</th>
                <th className="px-6 py-3 font-medium">Avg Latency</th>
                <th className="px-6 py-3 font-medium">Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {envelope.perApp.map((app) => (
                <tr key={app.route} className="text-gray-700">
                  <td className="px-6 py-3 font-mono text-xs">{app.route}</td>
                  <td className="px-6 py-3">{app.requestCount}</td>
                  <td className="px-6 py-3">{app.avgLatencyMs}ms</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        app.errorRate > 5
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {app.errorRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
