/**
 * ITSM Ticket List — All tickets for org with filter/search
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TICKET_TYPES, TICKET_STATUSES, PRIORITIES } from '@nzila/itsm-core'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tickets | ITSM',
}

export default async function TicketListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; priority?: string; q?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  // TODO: query DB with filters scoped to orgId

  const tickets: Array<{
    id: string
    ticketNumber: string
    type: string
    status: string
    priority: string
    title: string
    assignedToId: string | null
    slaBreached: boolean
    createdAt: string
  }> = []

  const PRIORITY_LABEL: Record<string, string> = {
    p1_critical: 'P1',
    p2_high: 'P2',
    p3_medium: 'P3',
    p4_low: 'P4',
  }

  const STATUS_COLOR: Record<string, string> = {
    new: 'text-gray-600 bg-gray-100',
    triage: 'text-yellow-700 bg-yellow-100',
    assigned: 'text-blue-700 bg-blue-100',
    in_progress: 'text-indigo-700 bg-indigo-100',
    waiting_user: 'text-orange-700 bg-orange-100',
    waiting_vendor: 'text-purple-700 bg-purple-100',
    resolved: 'text-green-700 bg-green-100',
    closed: 'text-gray-400 bg-gray-50',
    reopened: 'text-red-700 bg-red-100',
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">All Tickets</h1>
        <Link
          href="/itsm/tickets/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Ticket
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2">
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={params.type ?? ''}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          {TICKET_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={params.priority ?? ''}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p] ?? p}</option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search tickets..."
          className="flex-1 min-w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {/* Ticket table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Ticket</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Priority</th>
              <th className="px-4 py-3 text-left">Assigned To</th>
              <th className="px-4 py-3 text-left">SLA</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No tickets found.{' '}
                  <Link href="/itsm/tickets/new" className="text-blue-600 hover:underline">
                    Create the first one.
                  </Link>
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/itsm/tickets/${ticket.id}`}
                      className="font-mono text-xs text-blue-600 hover:underline"
                    >
                      {ticket.ticketNumber}
                    </Link>
                    <p className="text-gray-900 text-sm truncate max-w-xs">{ticket.title}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{ticket.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{ticket.assignedToId ?? '—'}</td>
                  <td className="px-4 py-3">
                    {ticket.slaBreached ? (
                      <span className="text-red-600 font-medium text-xs">BREACHED</span>
                    ) : (
                      <span className="text-green-600 text-xs">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{ticket.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
