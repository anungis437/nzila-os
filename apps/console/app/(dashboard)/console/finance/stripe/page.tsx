/**
 * /console/finance/stripe — Stripe Dashboard Page
 *
 * Displays connection info, webhook health, refund queue,
 * revenue summary, and report generation controls.
 */
import { platformDb } from '@nzila/db/platform'
import {
  stripeConnections,
  stripeWebhookEvents,
  stripeRefunds,
  stripePayments,
  stripeReports,
} from '@nzila/db/schema'
import { eq, desc, and, sql, count } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { RefundQueue } from './refund-queue'
import { GenerateReportsButton } from './generate-reports-button'

export const dynamic = 'force-dynamic'

async function getStripeData(entityId: string) {
  const [connection] = await platformDb
    .select()
    .from(stripeConnections)
    .where(eq(stripeConnections.entityId, entityId))
    .limit(1)

  const [latestEvent] = await platformDb
    .select({
      id: stripeWebhookEvents.id,
      type: stripeWebhookEvents.type,
      receivedAt: stripeWebhookEvents.receivedAt,
      processingStatus: stripeWebhookEvents.processingStatus,
    })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.entityId, entityId))
    .orderBy(desc(stripeWebhookEvents.receivedAt))
    .limit(1)

  const [eventStats] = await platformDb
    .select({
      total: count(),
      processed: sql<number>`count(*) filter (where ${stripeWebhookEvents.processingStatus} = 'processed')`,
      failed: sql<number>`count(*) filter (where ${stripeWebhookEvents.processingStatus} = 'failed')`,
      received: sql<number>`count(*) filter (where ${stripeWebhookEvents.processingStatus} = 'received')`,
    })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.entityId, entityId))

  const pendingRefunds = await platformDb
    .select()
    .from(stripeRefunds)
    .where(
      and(
        eq(stripeRefunds.entityId, entityId),
        eq(stripeRefunds.status, 'pending_approval'),
      ),
    )
    .orderBy(desc(stripeRefunds.createdAt))

  const recentPayments = await platformDb
    .select({
      id: stripePayments.id,
      stripeObjectId: stripePayments.stripeObjectId,
      objectType: stripePayments.objectType,
      status: stripePayments.status,
      amountCents: stripePayments.amountCents,
      currency: stripePayments.currency,
      occurredAt: stripePayments.occurredAt,
    })
    .from(stripePayments)
    .where(eq(stripePayments.entityId, entityId))
    .orderBy(desc(stripePayments.occurredAt))
    .limit(10)

  const recentReports = await platformDb
    .select()
    .from(stripeReports)
    .where(eq(stripeReports.entityId, entityId))
    .orderBy(desc(stripeReports.generatedAt))
    .limit(5)

  return {
    connection,
    latestEvent,
    eventStats: eventStats ?? { total: 0, processed: 0, failed: 0, received: 0 },
    pendingRefunds,
    recentPayments,
    recentReports,
  }
}

// TODO: In production, entityId should come from the user's session context.
// For now, we use a query param or first entity.
export default async function StripeFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const entityId = params.entityId

  if (!entityId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Stripe Integration</h1>
        <p className="text-gray-500">
          Select an entity to view Stripe integration details.
          Pass <code className="text-sm bg-gray-100 px-1 rounded">?entityId=UUID</code> in the URL.
        </p>
      </div>
    )
  }

  const data = await getStripeData(entityId)

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Stripe Integration</h1>

      {/* Connection Info */}
      <section className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Connection</h2>
        {data.connection ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Account ID:</span>{' '}
              <span className="font-mono">{data.connection.accountId}</span>
            </div>
            <div>
              <span className="text-gray-500">Livemode:</span>{' '}
              <span className={data.connection.livemode ? 'text-green-600 font-semibold' : 'text-yellow-600'}>
                {data.connection.livemode ? 'LIVE' : 'TEST'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>{' '}
              <span className={data.connection.status === 'connected' ? 'text-green-600' : 'text-red-600'}>
                {data.connection.status}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Last Event:</span>{' '}
              <span>{data.connection.lastEventAt?.toISOString() ?? 'Never'}</span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No Stripe connection configured for this entity.</p>
        )}
      </section>

      {/* Webhook Health */}
      <section className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Webhook Health</h2>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.eventStats.total}</div>
            <div className="text-gray-500">Total Events</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.eventStats.processed}</div>
            <div className="text-gray-500">Processed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{data.eventStats.failed}</div>
            <div className="text-gray-500">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{data.eventStats.received}</div>
            <div className="text-gray-500">Pending</div>
          </div>
        </div>
        {data.latestEvent && (
          <div className="mt-4 text-sm text-gray-500">
            Latest: <span className="font-mono">{data.latestEvent.type}</span>{' '}
            at {data.latestEvent.receivedAt.toISOString()}
          </div>
        )}
      </section>

      {/* Refund Queue */}
      <section className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          Refund Queue{' '}
          {data.pendingRefunds.length > 0 && (
            <span className="ml-2 text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {data.pendingRefunds.length} pending
            </span>
          )}
        </h2>
        <RefundQueue refunds={data.pendingRefunds} entityId={entityId} />
      </section>

      {/* Recent Payments */}
      <section className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Payments</h2>
        {data.recentPayments.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Object ID</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{p.stripeObjectId.slice(0, 24)}...</td>
                  <td className="py-2">{p.objectType}</td>
                  <td className="py-2">
                    <span className={p.status === 'succeeded' ? 'text-green-600' : 'text-gray-600'}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">
                    {(Number(p.amountCents) / 100).toFixed(2)} {p.currency}
                  </td>
                  <td className="py-2">{p.occurredAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400">No payments recorded yet.</p>
        )}
      </section>

      {/* Reports */}
      <section className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Reports</h2>
        <GenerateReportsButton entityId={entityId} />
        {data.recentReports.length > 0 && (
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Type</th>
                <th className="pb-2">Period</th>
                <th className="pb-2">Generated</th>
                <th className="pb-2">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {data.recentReports.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{r.reportType}</td>
                  <td className="py-2">{r.startDate} — {r.endDate}</td>
                  <td className="py-2">{r.generatedAt.toLocaleDateString()}</td>
                  <td className="py-2 font-mono text-xs">{r.sha256.slice(0, 16)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
