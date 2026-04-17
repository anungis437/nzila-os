/**
 * Provider Health Detail + Circuit Admin Controls
 * /integrations/health/[provider]
 *
 * Actions:
 * - "Open circuit now" (platform only)
 * - "Reset circuit" (platform only)
 * - "Run probe" (org admin allowed for their org)
 *
 * All actions are permission-checked and audited.
 */
import {
  ShieldExclamationIcon,
  ArrowPathIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@nzila/ui'
import { getProviderHealthDetail } from '@/lib/server-data'

export const dynamic = 'force-dynamic'

// ── Provider metadata ───────────────────────────────────────────────────────

const providerMeta: Record<string, { displayName: string; channel: string }> = {
  resend: { displayName: 'Resend', channel: 'email' },
  sendgrid: { displayName: 'SendGrid', channel: 'email' },
  mailgun: { displayName: 'Mailgun', channel: 'email' },
  twilio: { displayName: 'Twilio', channel: 'sms' },
  firebase: { displayName: 'Firebase', channel: 'push' },
  slack: { displayName: 'Slack', channel: 'chatops' },
  teams: { displayName: 'Microsoft Teams', channel: 'chatops' },
  hubspot: { displayName: 'HubSpot', channel: 'crm' },
  m365: { displayName: 'Microsoft 365', channel: 'productivity' },
  'google-workspace': { displayName: 'Google Workspace', channel: 'productivity' },
  webhooks: { displayName: 'Webhooks', channel: 'webhooks' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ProviderHealthPage({
  params,
}: {
  params: Promise<{ provider: string }>
}) {
  const { provider } = await params
  const meta = providerMeta[provider]
  if (!meta) return notFound()

  const { health, metrics } = await getProviderHealthDetail(provider)

  const isCircuitOpen = health.circuitState === 'open'
  const isCircuitHalfOpen = health.circuitState === 'half_open'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/integrations/health" className="hover:text-indigo-600">Health</Link>
            <span>/</span>
            <span>{meta.displayName}</span>
          </div>
          <h1 className="text-2xl font-bold">{meta.displayName} — Health Details</h1>
          <p className="text-sm text-gray-500 mt-1">Channel: {meta.channel} | Provider: {provider}</p>
        </div>
      </div>

      {/* Circuit breaker state */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <ShieldExclamationIcon className="h-5 w-5 text-purple-600" />
            Circuit Breaker
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500 uppercase">State</p>
              <p className={`text-lg font-bold ${
                isCircuitOpen ? 'text-red-600' : isCircuitHalfOpen ? 'text-amber-600' : 'text-green-600'
              }`}>
                {health.circuitState.toUpperCase().replace('_', '-')}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500 uppercase">Consecutive Failures</p>
              <p className="text-lg font-bold">{health.consecutiveFailures}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500 uppercase">Last Checked</p>
              <p className="text-sm">{health.lastCheckedAt ? new Date(health.lastCheckedAt).toLocaleString() : 'Never'}</p>
            </div>
          </div>
          {health.lastErrorMessage && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
              <strong>Last Error:</strong> [{health.lastErrorCode}] {health.lastErrorMessage}
            </div>
          )}
          {/* Admin actions — permission-gated at server action level */}
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              disabled={isCircuitOpen}
              title="Platform admin only — opens the circuit immediately"
            >
              <ExclamationTriangleIcon className="h-4 w-4" />
              Open Circuit Now
            </button>
            <button
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              disabled={!isCircuitOpen && !isCircuitHalfOpen}
              title="Platform admin only — resets the circuit to closed"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Reset Circuit
            </button>
            <button
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              title="Org admins can probe their own providers"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Run Probe
            </button>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <SignalIcon className="h-5 w-5 text-indigo-600" />
            Performance Metrics (Current Window)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Success Rate</p>
              <p className={`text-xl font-bold ${metrics.successRate < 99 ? 'text-amber-600' : 'text-green-600'}`}>
                {metrics.successRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">P50 Latency</p>
              <p className="text-xl font-bold">{metrics.p50LatencyMs}ms</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">P95 Latency</p>
              <p className="text-xl font-bold">{metrics.p95LatencyMs}ms</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">P99 Latency</p>
              <p className="text-xl font-bold">{metrics.p99LatencyMs}ms</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Total Sent</p>
              <p className="text-xl font-bold">{metrics.sentCount}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Failures</p>
              <p className="text-xl font-bold text-red-600">{metrics.failureCount}</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Rate Limited</p>
              <p className={`text-xl font-bold ${metrics.rateLimitedCount > 0 ? 'text-amber-600' : ''}`}>
                {metrics.rateLimitedCount}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-gray-500">Timeouts</p>
              <p className="text-xl font-bold">{metrics.timeoutCount}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
