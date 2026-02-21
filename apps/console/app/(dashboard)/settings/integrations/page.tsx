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
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { platformDb } from '@nzila/db/platform'
import { entities, entityMembers, qboConnections } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { PuzzlePieceIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { Card } from '@nzila/ui'
import { QboConnectButton } from './QboConnectButton'

export const dynamic = 'force-dynamic'

interface QboStatus {
  connected: boolean
  realmId?: string | null
  companyName?: string | null
  connectedAt?: string | null
}

async function getQboStatus(entityId: string): Promise<QboStatus> {
  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(eq(qboConnections.entityId, entityId), eq(qboConnections.isActive, true)),
    orderBy: [desc(qboConnections.connectedAt)],
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
  searchParams: Promise<{ qbo?: string; reason?: string; entityId?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams

  // Load entities the user belongs to
  const memberships = await platformDb
    .select({ entityId: entityMembers.entityId })
    .from(entityMembers)
    .where(eq(entityMembers.clerkUserId, userId))
    .limit(10)

  // Load entity names
  const entityIds = memberships.map((m) => m.entityId)
  const entityRows =
    entityIds.length > 0
      ? await platformDb.select().from(entities).where(eq(entities.id, entityIds[0]))
      : []

  const primaryEntityId = params.entityId ?? entityIds[0]

  // Load QBO status for primary entity
  const qboStatus = primaryEntityId
    ? await getQboStatus(primaryEntityId)
    : { connected: false }

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

      {/* Entity selector (if multiple entities) */}
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
                    entityId={primaryEntityId}
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

        {/* ── Coming soon ─────────────────────────────────────────────────────── */}
        {[
          {
            abbr: 'X',
            color: 'bg-sky-600',
            name: 'Xero',
            desc: 'Alternative accounting software integration for non-QBO entities.',
          },
          {
            abbr: 'P',
            color: 'bg-black',
            name: 'Plaid',
            desc: 'Bank account data aggregation for real-time cash flow visibility.',
          },
          {
            abbr: 'HS',
            color: 'bg-orange-500',
            name: 'HubSpot',
            desc: 'CRM sync — match revenue to contacts and pipeline stages.',
          },
        ].map((item) => (
          <Card key={item.name} variant="bordered" className="opacity-60">
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
                    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">
                      Coming soon
                    </span>
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
