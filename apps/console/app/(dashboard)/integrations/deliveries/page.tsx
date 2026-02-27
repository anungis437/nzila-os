/**
 * Delivery Logs — Filterable delivery history
 * /integrations/deliveries
 *
 * Shows all integration deliveries with filters for provider, status, and date.
 * Org-scoped. Platform admins see global view.
 */
import {
  ArrowLeftIcon,
  FunnelIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card } from '@nzila/ui'

export const dynamic = 'force-dynamic'

// ── Status helpers ──────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <CheckCircleIcon className="h-4 w-4 text-green-500" />
    case 'queued':
      return <ClockIcon className="h-4 w-4 text-blue-500" />
    case 'failed':
      return <XCircleIcon className="h-4 w-4 text-red-500" />
    case 'dlq':
      return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
    default:
      return <span className="h-2 w-2 rounded-full bg-gray-300 inline-block" />
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'sent':
      return 'bg-green-100 text-green-700'
    case 'queued':
      return 'bg-blue-100 text-blue-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    case 'dlq':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ provider?: string; status?: string }>
}

export default async function DeliveriesPage(props: Props) {
  const searchParams = await props.searchParams
  const filterProvider = searchParams.provider ?? null
  const filterStatus = searchParams.status ?? null

  // In production this reads from integrations-db integration_deliveries table.
  // For now, render the UI skeleton with filter controls.

  const providers = [
    'resend',
    'sendgrid',
    'mailgun',
    'twilio',
    'firebase',
    'slack',
    'teams',
    'hubspot',
  ]
  const statuses = ['queued', 'sent', 'failed', 'dlq']

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Logs</h1>
        <p className="text-sm text-gray-500">
          All integration deliveries. Filtered by org tenant. Platform admins see global view.
        </p>
      </div>

      {/* Filters */}
      <Card variant="bordered" className="mb-6">
        <Card.Body>
          <div className="flex items-center gap-3 flex-wrap">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>

            {/* Provider filter */}
            <div className="flex flex-wrap gap-1">
              <Link
                href="/integrations/deliveries"
                className={`px-2 py-1 rounded text-xs font-medium ${
                  !filterProvider ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All providers
              </Link>
              {providers.map((p) => (
                <Link
                  key={p}
                  href={`/integrations/deliveries?provider=${p}${filterStatus ? `&status=${filterStatus}` : ''}`}
                  className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                    filterProvider === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>

            <span className="text-gray-300">|</span>

            {/* Status filter */}
            <div className="flex flex-wrap gap-1">
              <Link
                href={`/integrations/deliveries${filterProvider ? `?provider=${filterProvider}` : ''}`}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  !filterStatus ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All statuses
              </Link>
              {statuses.map((s) => (
                <Link
                  key={s}
                  href={`/integrations/deliveries?${filterProvider ? `provider=${filterProvider}&` : ''}status=${s}`}
                  className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                    filterStatus === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Table */}
      <Card variant="bordered">
        <Card.Body>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 pr-4 font-medium">Channel</th>
                  <th className="pb-2 pr-4 font-medium">Recipient</th>
                  <th className="pb-2 pr-4 font-medium">Attempts</th>
                  <th className="pb-2 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                    {filterProvider || filterStatus
                      ? `No deliveries matching filters${filterProvider ? ` provider=${filterProvider}` : ''}${filterStatus ? ` status=${filterStatus}` : ''}`
                      : 'No deliveries recorded yet. Deliveries appear here once integrations are configured and active.'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}
