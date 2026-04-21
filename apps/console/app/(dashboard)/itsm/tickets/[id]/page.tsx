/**
 * ITSM Ticket Detail — ticket cockpit with event log and actions
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface TicketDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params

  // TODO: fetch ticket + events from DB scoped by orgId
  // const ticket = await getTicket(id, orgId)
  // if (!ticket) notFound()

  // Placeholder display
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
            <span className="font-mono text-xs text-gray-400">TKT-{id.slice(0, 8).toUpperCase()}</span>
            <h1 className="text-xl font-bold text-gray-900 mt-1">Ticket {id}</h1>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 font-medium">
            In Progress
          </span>
        </div>

        <p className="text-gray-500 text-sm">
          Ticket detail view. Data will populate once DB service layer is wired.
        </p>
      </div>

      {/* Event timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Event Timeline</h2>
        <p className="text-gray-400 text-sm">No events yet.</p>
      </div>
    </div>
  )
}
