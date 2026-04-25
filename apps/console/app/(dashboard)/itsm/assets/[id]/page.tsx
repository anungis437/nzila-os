/**
 * ITSM Asset Detail — asset profile with risk score breakdown
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { platformDb } from '@nzila/db/platform'
import { itsmAssets, itsmTickets } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

interface AssetDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const orgId = await getExecutiveOrgId()

  if (!orgId) notFound()

  const asset = await platformDb
    .select({
      id: itsmAssets.id,
      name: itsmAssets.name,
      type: itsmAssets.type,
      lifecycle: itsmAssets.lifecycle,
      ownerId: itsmAssets.ownerId,
      manufacturer: itsmAssets.manufacturer,
      model: itsmAssets.model,
      riskScore: itsmAssets.riskScore,
      warrantyExpiry: itsmAssets.warrantyExpiry,
      location: itsmAssets.location,
    })
    .from(itsmAssets)
    .where(and(eq(itsmAssets.id, id), eq(itsmAssets.orgId, orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null)

  if (!asset) notFound()

  const relatedTickets = await platformDb
    .select({
      id: itsmTickets.id,
      ticketNumber: itsmTickets.ticketNumber,
      title: itsmTickets.title,
      status: itsmTickets.status,
      priority: itsmTickets.priority,
    })
    .from(itsmTickets)
    .where(and(eq(itsmTickets.orgId, orgId), eq(itsmTickets.assetId, asset.id)))
    .orderBy(desc(itsmTickets.createdAt))
    .limit(25)
    .catch(() => [])

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link href="/itsm/assets" className="text-gray-400 hover:text-gray-600 text-sm">
        ← Assets / CMDB
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{asset.name}</h1>
        <p className="text-gray-500 text-sm">
          {[asset.type.replace(/_/g, ' '), asset.manufacturer, asset.model].filter(Boolean).join(' · ') || 'Asset profile'}
        </p>
      </div>

      {/* Risk score card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Risk Analysis</h2>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-gray-900">{asset.riskScore ?? 0}</div>
          <p className="text-sm text-gray-500">
            Lifecycle: {asset.lifecycle.replace(/_/g, ' ')} · Owner: {asset.ownerId ?? 'unassigned'} · Warranty: {asset.warrantyExpiry ?? 'n/a'}
          </p>
        </div>
      </div>

      {/* Related tickets */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Related Tickets</h2>
        {relatedTickets.length === 0 ? (
          <p className="text-gray-400 text-sm">No tickets linked to this asset yet.</p>
        ) : (
          <div className="space-y-2">
            {relatedTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/itsm/tickets/${ticket.id}`}
                className="block rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <p className="font-mono text-xs text-gray-400">{ticket.ticketNumber}</p>
                <p className="text-sm text-gray-900">{ticket.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ticket.status.replace(/_/g, ' ')} · {ticket.priority.replace(/_/g, ' ')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
