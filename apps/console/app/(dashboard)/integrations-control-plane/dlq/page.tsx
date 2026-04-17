/**
 * Nzila OS — Console: Dead Letter Queue Manager
 *
 * Inspect, replay, and purge DLQ entries for failed integration events.
 * Scoped per org + provider for strict isolation.
 *
 * @see @nzila/platform-integrations-control-plane/dlq
 */
import { requireRole } from '@/lib/rbac'
import { getDlqEntries } from '@/lib/server-data'
import Link from 'next/link'
import {
  BoltIcon,
  ArrowPathIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── UI helpers ─────────────────────────────────────────────────────────────

function RetryBadge({ count }: { count: number }) {
  const severity = count >= 5 ? 'bg-red-100 text-red-800' : count >= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${severity}`}>{count} retries</span>
}

export default async function DlqPage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const entries = await getDlqEntries()
  const byProvider = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.providerId] = (acc[e.providerId] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/integrations-control-plane" className="text-blue-600 hover:underline text-sm">
            ← Control Plane
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Dead Letter Queue</h1>
        <p className="text-gray-500 mt-1">Failed integration events awaiting replay or removal</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-3 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <BoltIcon className="h-5 w-5 text-red-600" />
            <p className="text-sm font-medium text-gray-500">Total Entries</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
        </div>
        {Object.entries(byProvider).map(([provider, count]) => (
          <div key={provider} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
              <p className="text-sm font-medium text-gray-500">{provider}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{count} entries</p>
          </div>
        ))}
      </div>

      {/* DLQ Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Queue Entries</h2>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
              <ArrowPathIcon className="h-4 w-4" /> Replay All
            </button>
            <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
              <TrashIcon className="h-4 w-4" /> Purge All
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-gray-500 font-medium">Entry ID</th>
              <th className="text-left py-2 text-gray-500 font-medium">Provider</th>
              <th className="text-left py-2 text-gray-500 font-medium">Org</th>
              <th className="text-left py-2 text-gray-500 font-medium">Event Type</th>
              <th className="text-left py-2 text-gray-500 font-medium">Retries</th>
              <th className="text-left py-2 text-gray-500 font-medium">Last Error</th>
              <th className="text-left py-2 text-gray-500 font-medium">Failed At</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.entryId} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-2 font-mono text-gray-600 text-xs">{e.entryId}</td>
                <td className="py-2 font-medium text-gray-900">{e.providerId}</td>
                <td className="py-2 text-gray-600">{e.orgId}</td>
                <td className="py-2 text-gray-700">{e.eventType}</td>
                <td className="py-2"><RetryBadge count={e.retryCount} /></td>
                <td className="py-2 text-red-700 text-xs">{e.lastError}</td>
                <td className="py-2 text-gray-500">{new Date(e.failedAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
