/**
 * Support Desk — Nzila Service Operations Layer
 *
 * Unified support queue for all Nzila products.
 * Kanban columns: new → triage → assigned → in_progress → waiting → resolved.
 * Product filter tabs let agents focus on one product at a time.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Support Desk | Service Operations',
}

// Status columns displayed on the board (terminal states excluded)
const BOARD_COLUMNS: Array<{ status: string; label: string; color: string }> = [
  { status: 'new', label: 'New', color: 'bg-gray-100 text-gray-700' },
  { status: 'triage', label: 'Triage', color: 'bg-yellow-100 text-yellow-800' },
  { status: 'assigned', label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-indigo-100 text-indigo-700' },
  { status: 'waiting_user', label: 'Waiting User', color: 'bg-orange-100 text-orange-700' },
  { status: 'waiting_vendor', label: 'Waiting Vendor', color: 'bg-purple-100 text-purple-700' },
  { status: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-700' },
]

const PRIORITY_BADGE: Record<string, string> = {
  p1_critical: 'bg-red-500 text-white',
  p2_high: 'bg-orange-400 text-white',
  p3_medium: 'bg-yellow-300 text-gray-800',
  p4_low: 'bg-gray-200 text-gray-600',
}

export default async function QueueBoardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // TODO: fetch real tickets from DB scoped by orgId
  const ticketsByStatus: Record<string, Array<{ id: string; ticketNumber: string; title: string; priority: string; assignedToId: string | null; updatedAt: string }>> = {
    new: [],
    triage: [],
    assigned: [],
    in_progress: [],
    waiting_user: [],
    waiting_vendor: [],
    resolved: [],
  }

  const totalOpen = Object.values(ticketsByStatus).flat().length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Desk</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalOpen} open ticket{totalOpen !== 1 ? 's' : ''} · All Nzila products
          </p>
        </div>
        <Link
          href="/itsm/tickets/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + New Ticket
        </Link>
      </div>

      {/* Product filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {['All', 'Union Eyes', 'FairCase', 'Flow', 'Zonga', 'Agrimo'].map((label) => (
          <button
            key={label}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              label === 'All'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((col) => {
          const tickets = ticketsByStatus[col.status] ?? []
          return (
            <div
              key={col.status}
              className="flex-shrink-0 w-64 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* Column header */}
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${col.color}`}>
                  {col.label}
                </span>
                <span className="text-xs text-gray-400">{tickets.length}</span>
              </div>

              {/* Ticket cards */}
              <div className="p-2 space-y-2 min-h-32">
                {tickets.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No tickets</p>
                ) : (
                  tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/itsm/tickets/${ticket.id}`}
                      className="block bg-white rounded-md border border-gray-200 p-3 hover:border-blue-400 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 font-mono">{ticket.ticketNumber}</span>
                        <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${PRIORITY_BADGE[ticket.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ticket.priority.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 line-clamp-2">{ticket.title}</p>
                      {ticket.assignedToId && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {ticket.assignedToId}
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
