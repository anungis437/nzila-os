/**
 * Integration Provider Detail — Configure + Test + Logs
 * /integrations/[provider]
 *
 * Shows provider configuration status, configuration form placeholder,
 * health check trigger, and recent delivery logs.
 */
import {
  PuzzlePieceIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

// ── Provider metadata ───────────────────────────────────────────────────────

interface ProviderMeta {
  name: string
  type: string
  typeLabel: string
  color: string
  secrets: string[]
  configHints: string[]
}

const providerMeta: Record<string, ProviderMeta> = {
  resend: {
    name: 'Resend',
    type: 'email',
    typeLabel: 'Email',
    color: 'bg-black',
    secrets: ['apiKey'],
    configHints: ['Obtain your API key from resend.com/api-keys'],
  },
  sendgrid: {
    name: 'SendGrid',
    type: 'email',
    typeLabel: 'Email',
    color: 'bg-blue-600',
    secrets: ['apiKey'],
    configHints: ['Create an API key at app.sendgrid.com/settings/api_keys'],
  },
  mailgun: {
    name: 'Mailgun',
    type: 'email',
    typeLabel: 'Email',
    color: 'bg-red-600',
    secrets: ['apiKey', 'domain'],
    configHints: ['Supports US and EU regions.', 'Provide your sending domain.'],
  },
  twilio: {
    name: 'Twilio',
    type: 'sms',
    typeLabel: 'SMS',
    color: 'bg-red-500',
    secrets: ['accountSid', 'authToken', 'fromNumber'],
    configHints: ['TCPA compliance is your responsibility.'],
  },
  firebase: {
    name: 'Firebase Cloud Messaging',
    type: 'push',
    typeLabel: 'Push',
    color: 'bg-amber-500',
    secrets: ['projectId', 'clientEmail', 'privateKey'],
    configHints: ['Uses Firebase Admin SDK. Download service account JSON from Firebase console.'],
  },
  slack: {
    name: 'Slack',
    type: 'chatops',
    typeLabel: 'ChatOps',
    color: 'bg-purple-600',
    secrets: ['webhookUrl', 'botToken (optional)', 'defaultChannel (optional)'],
    configHints: [
      'Incoming webhook works without a bot token.',
      'Bot token enables channel routing via chat.postMessage.',
    ],
  },
  teams: {
    name: 'Microsoft Teams',
    type: 'chatops',
    typeLabel: 'ChatOps',
    color: 'bg-indigo-600',
    secrets: ['webhookUrl'],
    configHints: [
      'Create an incoming webhook in a Teams channel.',
      'Messages are sent as Adaptive Cards v1.4.',
    ],
  },
  hubspot: {
    name: 'HubSpot',
    type: 'crm',
    typeLabel: 'CRM',
    color: 'bg-orange-500',
    secrets: ['accessToken'],
    configHints: [
      'Use a private app access token with CRM scopes.',
      'Rate-limit backoff (429) handled automatically.',
    ],
  },
  webhooks: {
    name: 'Webhooks',
    type: 'webhooks',
    typeLabel: 'Webhooks',
    color: 'bg-gray-700',
    secrets: ['signingSecret'],
    configHints: [
      'HMAC-SHA256 signatures sent via X-Nzila-Signature header.',
      'Idempotency keys prevent duplicate processing.',
    ],
  },
}

function HealthIcon({ status }: { status: 'ok' | 'degraded' | 'down' | 'unknown' }) {
  switch (status) {
    case 'ok':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    case 'degraded':
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
    case 'down':
      return <XCircleIcon className="h-5 w-5 text-red-500" />
    default:
      return <span className="h-2 w-2 rounded-full bg-gray-300 inline-block" />
  }
}

interface Props {
  params: Promise<{ provider: string }>
}

export default async function ProviderDetailPage(props: Props) {
  const { provider } = await props.params
  const meta = providerMeta[provider]
  if (!meta) notFound()

  // In a real deployment this would read from integrations-db.
  // For now we render a static configuration + health UI.
  const healthStatus = 'unknown' as const

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Integrations
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`h-12 w-12 rounded-lg ${meta.color} flex items-center justify-center shrink-0`}
        >
          <PuzzlePieceIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meta.name}</h1>
          <p className="text-sm text-gray-500">
            {meta.typeLabel} integration &middot; Provider:{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">{provider}</code>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HealthIcon status={healthStatus} />
          <span className="text-sm text-gray-500 capitalize">{healthStatus}</span>
        </div>
      </div>

      {/* Configuration */}
      <Card variant="bordered" className="mb-6">
        <Card.Body>
          <h2 className="font-semibold text-gray-900 mb-3">Configuration</h2>
          <p className="text-sm text-gray-500 mb-4">
            Credentials are stored in Azure Key Vault, referenced via integration config. Only org
            admins can modify.
          </p>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Required credentials</h3>
            <div className="flex flex-wrap gap-2">
              {meta.secrets.map((s) => (
                <span
                  key={s}
                  className="bg-gray-100 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-gray-600"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {meta.configHints.length > 0 && (
            <div className="mt-4 space-y-1">
              <h3 className="text-sm font-medium text-gray-700">Setup hints</h3>
              <ul className="list-disc list-inside text-sm text-gray-500">
                {meta.configHints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-400 italic">
              Configuration management coming in next release. Use the orchestrator API to configure
              integrations programmatically.
            </p>
          </div>
        </Card.Body>
      </Card>

      {/* Health Check */}
      <Card variant="bordered" className="mb-6">
        <Card.Body>
          <h2 className="font-semibold text-gray-900 mb-2">Health Check</h2>
          <p className="text-sm text-gray-500 mb-4">
            Run a live health probe against this provider. Results are audited.
          </p>
          <button
            disabled
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run Health Check (coming soon)
          </button>
        </Card.Body>
      </Card>

      {/* Recent Deliveries */}
      <Card variant="bordered">
        <Card.Body>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Recent Deliveries</h2>
            <Link
              href={`/integrations/deliveries?provider=${provider}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all &rarr;
            </Link>
          </div>
          <p className="text-sm text-gray-400 italic">
            No deliveries recorded yet. Once this integration is configured and sends messages,
            delivery records will appear here.
          </p>
        </Card.Body>
      </Card>
    </div>
  )
}
