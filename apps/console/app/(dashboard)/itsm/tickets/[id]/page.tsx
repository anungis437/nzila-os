/**
 * ITSM Ticket Detail — ticket cockpit with event log and actions
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { platformDb } from '@nzila/db/platform'
import { itsmTicketEvents, itsmTickets } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

interface TicketDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const orgId = await getExecutiveOrgId()

  if (!orgId) notFound()

  const ticket = await platformDb
    .select({
      id: itsmTickets.id,
      ticketNumber: itsmTickets.ticketNumber,
      title: itsmTickets.title,
      description: itsmTickets.description,
      status: itsmTickets.status,
      priority: itsmTickets.priority,
      assignedToId: itsmTickets.assignedToId,
      reportedById: itsmTickets.reportedById,
      createdAt: itsmTickets.createdAt,
      updatedAt: itsmTickets.updatedAt,
    })
    .from(itsmTickets)
    .where(and(eq(itsmTickets.id, id), eq(itsmTickets.orgId, orgId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null)

  if (!ticket) notFound()

  const events = await platformDb
    .select({
      id: itsmTicketEvents.id,
      eventType: itsmTicketEvents.eventType,
      actorId: itsmTicketEvents.actorId,
      body: itsmTicketEvents.body,
      fromValue: itsmTicketEvents.fromValue,
      toValue: itsmTicketEvents.toValue,
      createdAt: itsmTicketEvents.createdAt,
    })
    .from(itsmTicketEvents)
    .where(and(eq(itsmTicketEvents.orgId, orgId), eq(itsmTicketEvents.ticketId, ticket.id)))
    .orderBy(desc(itsmTicketEvents.createdAt))
    .limit(100)
    .catch(() => [])

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/itsm/tickets" className="text-gray-400 hover:text-gray-600 text-sm">
          ← All Tickets
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="font-mono text-xs text-gray-400">{ticket.ticketNumber}</span>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{ticket.title}</h1>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 font-medium">
            {ticket.status.replace(/_/g, ' ')}
          </span>
        </div>

        <p className="text-gray-500 text-sm">{ticket.description || 'No description provided.'}</p>
        <p className="text-xs text-gray-400 mt-3">
          Priority: {ticket.priority.replace(/_/g, ' ')} · Assigned: {ticket.assignedToId ?? 'unassigned'} · Reporter: {ticket.reportedById}
        </p>
      </div>

      {/* Event timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Event Timeline</h2>
        {events.length === 0 ? (
          <p className="text-gray-400 text-sm">No events yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-md border border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-700">{event.eventType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{event.createdAt?.toISOString() ?? ''}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">Actor: {event.actorId}</p>
                {(event.fromValue || event.toValue) && (
                  <p className="text-xs text-gray-500">{event.fromValue ?? '—'} → {event.toValue ?? '—'}</p>
                )}
                {event.body && <p className="text-sm text-gray-700 mt-1">{event.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
