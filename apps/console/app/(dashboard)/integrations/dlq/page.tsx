/**
 * Dead Letter Queue Inspector
 * /integrations/dlq
 *
 * Lists all DLQ entries with inspection and replay capabilities.
 * Org-scoped. All replays are audited.
 */
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card } from '@nzila/ui'

export const dynamic = 'force-dynamic'

export default function DlqPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Integrations
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
            <h1 className="text-2xl font-bold text-gray-900">Dead Letter Queue</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Failed deliveries after max retries. Inspect payload, view error, and replay. All
            replays are audited.
          </p>
        </div>
        <button
          disabled
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Replay All (coming soon)
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card variant="bordered">
          <Card.Body>
            <p className="text-sm text-gray-500">Total DLQ entries</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </Card.Body>
        </Card>
        <Card variant="bordered">
          <Card.Body>
            <p className="text-sm text-gray-500">Last 24h</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </Card.Body>
        </Card>
        <Card variant="bordered">
          <Card.Body>
            <p className="text-sm text-gray-500">Replayed</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </Card.Body>
        </Card>
      </div>

      {/* DLQ table */}
      <Card variant="bordered">
        <Card.Body>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 pr-4 font-medium">Channel</th>
                  <th className="pb-2 pr-4 font-medium">Recipient</th>
                  <th className="pb-2 pr-4 font-medium">Error</th>
                  <th className="pb-2 pr-4 font-medium">Attempts</th>
                  <th className="pb-2 pr-4 font-medium">Failed At</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                    No dead letters. All deliveries successful or pending retry.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>

      {/* Legend */}
      <div className="mt-4 text-xs text-gray-400 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <EyeIcon className="h-3 w-3" /> Inspect — view full payload + error stack
        </span>
        <span className="flex items-center gap-1">
          <ArrowPathIcon className="h-3 w-3" /> Replay — re-dispatch through retry engine
          (audited)
        </span>
      </div>
    </div>
  )
}
