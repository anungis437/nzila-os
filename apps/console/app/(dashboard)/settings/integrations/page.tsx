/**
 * Settings — Integrations
 * /settings/integrations
 *
 * Shows all third-party integrations. QBO status is loaded server-side
 * per entity via the /api/qbo/status route.
 *
 * URL params handled:
 *   ?qbo=connected   → show success banner (redirected from OAuth callback)
 *   ?qbo=denied      → show cancelled banner
 *   ?qbo=error       → show error banner
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { platformDb } from '@nzila/db/platform'
import { orgs, orgMembers, qboConnections } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { PuzzlePieceIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { Card } from '@nzila/ui'
import { QboConnectButton } from './QboConnectButton'
import { listIntegrationConnections } from '@/lib/integrations-connections'
import { type ProviderKey } from '@/lib/integrations-provider-catalog'
import { createLogger } from '@nzila/os-core/telemetry'

export const dynamic = 'force-dynamic'

const logger = createLogger('console.settings.integrations')

interface QboStatus {
  connected: boolean
  realmId?: string | null
  companyName?: string | null
  connectedAt?: string | null
}

async function getQboStatus(orgId: string): Promise<QboStatus> {
  const connection = await platformDb.query.qboConnections
    .findFirst({
      where: and(eq(qboConnections.orgId, orgId), eq(qboConnections.isActive, true)),
      orderBy: [desc(qboConnections.connectedAt)],
    })
    .catch((error) => {
      logger.warn('qbo status load failed; returning disconnected fallback', {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    })
  if (!connection) return { connected: false }
  return {
    connected: true,
    realmId: connection.realmId,
    companyName: connection.companyName,
    connectedAt: connection.connectedAt?.toISOString() ?? null,
  }
}

function StatusBanner({
  qbo,
  reason,
}: {
  qbo: string | null
  reason: string | null
}) {
  if (!qbo) return null

  if (qbo === 'connected') {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        <CheckCircleIcon className="h-5 w-5 text-green-500 shrink-0" />
        QuickBooks Online connected successfully.
      </div>
    )
  }

  if (qbo === 'denied') {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
        <XCircleIcon className="h-5 w-5 text-yellow-500 shrink-0" />
        QuickBooks authorization was cancelled.
      </div>
    )
  }

  return (
    <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
      <XCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
      QuickBooks connection failed{reason ? `: ${reason.replace(/_/g, ' ')}` : ''}.
    </div>
  )
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ qbo?: string; reason?: string; orgId?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams

  // Load orgs the user belongs to
  const memberships = await platformDb
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(10)
    .catch((error) => {
      logger.warn('integrations memberships load failed; returning empty fallback', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
      return [] as Array<{ orgId: string }>
    })

  // Load entity names
  const entityIds = memberships.map((m) => m.orgId)
  const entityRows =
    entityIds.length > 0
      ? await platformDb
          .select()
          .from(orgs)
          .where(eq(orgs.id, entityIds[0]))
          .catch((error) => {
            logger.warn('integrations org load failed; returning empty fallback', {
              orgId: entityIds[0],
              error: error instanceof Error ? error.message : String(error),
            })
            return [] as Array<typeof orgs.$inferSelect>
          })
      : []

  const primaryEntityId = params.orgId ?? entityIds[0]

  // Load QBO status for primary entity
  const qboStatus = primaryEntityId
    ? await getQboStatus(primaryEntityId)
    : { connected: false }

  const integrationConnections = primaryEntityId
    ? await listIntegrationConnections(primaryEntityId).catch((error) => {
        logger.warn('integration connections load failed; returning empty fallback', {
          orgId: primaryEntityId,
          error: error instanceof Error ? error.message : String(error),
        })
        return []
      })
    : []
  const integrationConnectionMap = new Map(
    integrationConnections.map((connection) => [connection.provider, connection]),
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <PuzzlePieceIcon className="h-7 w-7 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500">
            Connect third-party services to sync financial and operational data.
          </p>
        </div>
      </div>

      {/* OAuth result banner */}
      <StatusBanner qbo={params.qbo ?? null} reason={params.reason ?? null} />

      {/* Entity selector (if multiple orgs) */}
      {entityRows.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          Showing integrations for:{' '}
          <span className="font-medium text-gray-600">
            {entityRows[0]?.legalName ?? primaryEntityId}
          </span>
        </p>
      )}

      {/* Integrations list */}
      <div className="space-y-4">
        {/* ── QuickBooks Online ───────────────────────────────────────────────── */}
        <Card variant="bordered">
          <Card.Body>
            <div className="flex items-start gap-4">
              {/* QBO logo placeholder */}
              <div className="h-10 w-10 rounded-lg bg-[#2CA01C] flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">QB</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">QuickBooks Online</h3>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">
                    {process.env.INTUIT_ENVIRONMENT === 'production' ? 'production' : 'sandbox'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Sync your chart of accounts, P&amp;L, balance sheet, and expense data.
                  Required for CRA SR&amp;ED compliance and government funding audit trails.
                </p>

                {primaryEntityId ? (
                  <QboConnectButton
                    orgId={primaryEntityId}
                    connected={qboStatus.connected}
                    realmId={qboStatus.realmId}
                    companyName={qboStatus.companyName}
                    connectedAt={qboStatus.connectedAt}
                  />
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    You must be a member of an entity to connect integrations.
                  </p>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* ── Stripe (already integrated) ────────────────────────────────────── */}
        <Card variant="bordered">
          <Card.Body>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-[#635bff] flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">Stripe</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Active
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Payment processing, subscription billing, and revenue reporting. Managed via
                  STRIPE_SECRET_KEY environment variable.
                </p>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* ── Ready to configure ─────────────────────────────────────────────── */}
        {([
          {
            provider: 'm365',
            abbr: 'M',
            color: 'bg-blue-700',
            name: 'Microsoft 365',
            desc: 'Graph-powered Outlook, Calendar, and OneDrive workflows for enterprise ops.',
          },
          {
            provider: 'google-workspace',
            abbr: 'G',
            color: 'bg-emerald-600',
            name: 'Google Workspace',
            desc: 'Gmail, Drive, and Calendar automation for operational collaboration.',
          },
          {
            provider: 'hubspot',
            abbr: 'HS',
            color: 'bg-orange-500',
            name: 'HubSpot',
            desc: 'CRM sync — match revenue to contacts and pipeline stages.',
          },
          {
            provider: 'webhooks',
            abbr: 'WH',
            color: 'bg-gray-700',
            name: 'Webhooks',
            desc: 'Outbound event delivery with HMAC signing and replay protection.',
          },
        ] satisfies Array<{ provider: ProviderKey; abbr: string; color: string; name: string; desc: string }>).map((item) => (
          // Provider cards reflect persisted integration connection status for this org.
          <Card key={item.name} variant="bordered">
            <Card.Body>
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-lg ${item.color} flex items-center justify-center shrink-0`}
                >
                  <span className="text-white text-xs font-bold">{item.abbr}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {integrationConnectionMap.get(item.provider)?.status === 'connected' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Connected
                      </span>
                    ) : integrationConnectionMap.get(item.provider)?.status === 'error' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Error
                      </span>
                    ) : (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Connect via API
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  )
}
