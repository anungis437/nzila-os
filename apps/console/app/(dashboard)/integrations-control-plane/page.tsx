/**
 * Nzila OS — Console: Integration Control Plane Dashboard
 *
 * Unified view of all integration providers including:
 *   - Provider health overview per org
 *   - Webhook verification status
 *   - Rate-limit utilisation
 *   - DLQ backlog indicator
 *
 * @see @nzila/platform-integrations-control-plane
 */
import { requireRole } from '@/lib/rbac'
import { getIntegrationProviders, type IntegrationProviderRow } from '@/lib/server-data'
import {
  PuzzlePieceIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type ProviderRow = IntegrationProviderRow

// ── UI helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProviderRow['status'] }) {
  const cfg = {
    healthy: { bg: 'bg-green-100', text: 'text-green-800', label: 'Healthy' },
    degraded: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Degraded' },
    down: { bg: 'bg-red-100', text: 'text-red-800', label: 'Down' },
  } as const
  const c = cfg[status]
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>
}

function MetricCard({ title, value, icon: Icon, accent }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`h-5 w-5 ${accent}`} />
        <p className="text-sm font-medium text-gray-500">{title}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export default async function IntegrationsControlPlanePage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const providers = await getIntegrationProviders()
  const healthyCount = providers.filter((p) => p.status === 'healthy').length
  const degradedCount = providers.filter((p) => p.status === 'degraded').length
  const downCount = providers.filter((p) => p.status === 'down').length
  const totalDlq = providers.reduce((sum, p) => sum + p.dlqDepth, 0)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Integration Control Plane</h1>
        <p className="text-gray-500 mt-1">Provider health, webhook integrity & rate-limit utilisation across all orgs</p>
      </div>

      {/* Metrics */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard title="Healthy" value={String(healthyCount)} icon={CheckCircleIcon} accent="text-green-600" />
        <MetricCard title="Degraded" value={String(degradedCount)} icon={ExclamationTriangleIcon} accent="text-yellow-600" />
        <MetricCard title="Down" value={String(downCount)} icon={XCircleIcon} accent="text-red-600" />
        <MetricCard title="DLQ Backlog" value={String(totalDlq)} icon={BoltIcon} accent="text-blue-600" />
      </div>

      {/* Provider Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <PuzzlePieceIcon className="h-5 w-5 text-gray-500" />
          Providers
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-gray-500 font-medium">Provider</th>
              <th className="text-left py-2 text-gray-500 font-medium">Org</th>
              <th className="text-left py-2 text-gray-500 font-medium">Status</th>
              <th className="text-left py-2 text-gray-500 font-medium">Webhook</th>
              <th className="text-left py-2 text-gray-500 font-medium">Rate Limit</th>
              <th className="text-left py-2 text-gray-500 font-medium">DLQ</th>
              <th className="text-left py-2 text-gray-500 font-medium">Last Checked</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p, i) => (
              <tr key={`${p.providerId}-${p.orgId}`} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-2 font-medium text-gray-900">{p.providerId}</td>
                <td className="py-2 text-gray-600">{p.orgId}</td>
                <td className="py-2"><StatusBadge status={p.status} /></td>
                <td className="py-2">
                  {p.webhookVerified
                    ? <span className="text-green-700 flex items-center gap-1"><ShieldCheckIcon className="h-4 w-4" /> Verified</span>
                    : <span className="text-red-700 flex items-center gap-1"><XCircleIcon className="h-4 w-4" /> Unverified</span>
                  }
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${p.rateLimitUsage > 0.8 ? 'bg-red-500' : p.rateLimitUsage > 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.round(p.rateLimitUsage * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-500 text-xs">{Math.round(p.rateLimitUsage * 100)}%</span>
                  </div>
                </td>
                <td className="py-2">
                  {p.dlqDepth > 0
                    ? <span className="text-red-700 font-medium">{p.dlqDepth}</span>
                    : <span className="text-gray-400">0</span>
                  }
                </td>
                <td className="py-2 text-gray-500">{new Date(p.lastCheckedAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DLQ Link */}
      <div className="text-sm">
        <Link href="/integrations-control-plane/dlq" className="text-blue-600 hover:underline font-medium">
          View Dead Letter Queue →
        </Link>
      </div>
    </div>
  )
}
