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
import { getExecutiveOrgId } from '@/lib/executive-os'
import { getIntegrationConnection } from '@/lib/integrations-connections'
import { providerCatalog, type ProviderKey } from '@/lib/integrations-provider-catalog'
import { ProviderConnectionForm } from './provider-connection-form'

export const dynamic = 'force-dynamic'

// ── Provider metadata ───────────────────────────────────────────────────────

interface ProviderMeta {
  name: string
  type: string
  typeLabel: string
  color: string
  configHints: string[]
}

const providerMeta: Record<string, ProviderMeta> = {
  resend: {
    name: 'Resend',
    type: 'email',
    typeLabel: 'Email',
    color: 'bg-black',
    configHints: ['Obtain your API key from resend.com/api-keys'],
  },
  sendgrid: {
    name: 'SendGrid',
    type: 'email',
    typeLabel: 'Email',
    color: 'bg-blue-600',
    configHints: ['Create an API key at app.sendgrid.com/settings/api_keys'],
  },
  mailgun: {
    name: 'Mailgun',
    type: 'email',
    typeLabel: 'Email',
    color: 'bg-red-600',
    configHints: ['Supports US and EU regions.', 'Provide your sending domain.'],
  },
  twilio: {
    name: 'Twilio',
    type: 'sms',
    typeLabel: 'SMS',
    color: 'bg-red-500',
    configHints: ['TCPA compliance is your responsibility.'],
  },
  firebase: {
    name: 'Firebase Cloud Messaging',
    type: 'push',
    typeLabel: 'Push',
    color: 'bg-amber-500',
    configHints: ['Uses Firebase Admin SDK. Download service account JSON from Firebase console.'],
  },
  slack: {
    name: 'Slack',
    type: 'chatops',
    typeLabel: 'ChatOps',
    color: 'bg-purple-600',
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
    configHints: [
      'Use a private app access token with CRM scopes.',
      'Rate-limit backoff (429) handled automatically.',
    ],
  },
  m365: {
    name: 'Microsoft 365',
    type: 'productivity',
    typeLabel: 'Productivity',
    color: 'bg-blue-700',
    configHints: [
      'Register an app in Microsoft Entra ID with Microsoft Graph scopes.',
      'Use delegated scopes for user workflows and application scopes for background jobs.',
    ],
  },
  'google-workspace': {
    name: 'Google Workspace',
    type: 'productivity',
    typeLabel: 'Productivity',
    color: 'bg-emerald-600',
    configHints: [
      'Create OAuth credentials in Google Cloud Console and enable required Workspace APIs.',
      'Use domain-wide delegation for admin-level automation where applicable.',
    ],
  },
  webhooks: {
    name: 'Webhooks',
    type: 'webhooks',
    typeLabel: 'Webhooks',
    color: 'bg-gray-700',
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
  if (!meta || !(provider in providerCatalog)) notFound()
  const requiredSecrets = providerCatalog[provider as ProviderKey].requiredSecrets

  const orgId = await getExecutiveOrgId()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  let healthStatus: 'ok' | 'degraded' | 'down' | 'unknown' = 'unknown'
  if (baseUrl) {
    const healthResponse = await fetch(`${baseUrl}/api/integrations/health/${encodeURIComponent(provider)}`, {
      cache: 'no-store',
    })
    const healthJson = healthResponse.ok
      ? (await healthResponse.json()) as { health?: { status?: 'ok' | 'degraded' | 'down' } }
      : null
    healthStatus = healthJson?.health?.status ?? 'unknown'
  }

  const existingConnection = orgId
    ? await getIntegrationConnection(orgId, provider as ProviderKey).catch(() => null)
    : null

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
            Credentials are encrypted at rest (AES-256-GCM) and a live probe is executed before
            the connection is saved. Only org admins can modify.
          </p>

          {existingConnection && (
            <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              Connection already configured (status: <strong>{existingConnection.status}</strong>
              {existingConnection.lastValidatedAt && (
                <>
                  , last validated{' '}
                  {new Date(existingConnection.lastValidatedAt).toLocaleString()}
                </>
              )}
              ). Re-submitting the form will rotate the stored credentials.
            </div>
          )}

          {meta.configHints.length > 0 && (
            <div className="mb-4 space-y-1">
              <h3 className="text-sm font-medium text-gray-700">Setup hints</h3>
              <ul className="list-disc list-inside text-sm text-gray-500">
                {meta.configHints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}

          {orgId ? (
            <ProviderConnectionForm
              provider={provider}
              orgId={orgId}
              secrets={requiredSecrets}
            />
          ) : (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
              No active organisation context. Sign in with an org-scoped account to configure this
              provider.
            </div>
          )}
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
