/**
 * Platform Admin — Queue Manager
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Queue Manager | ITSM Config',
}

export default async function QueueManagerPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // TODO: fetch queues from DB. Warn loudly so an empty Queues list is not
  // silently mistaken for "no queues configured" by an admin.
  console.warn(
    '[platform-admin] itsm-config/queues: queues DB query is not wired — rendering empty list',
  )
  const queues: Array<{
    id: string
    name: string
    teamId: string | null
    slaProfileName: string | null
    ticketCount: number
    isDefault: boolean
  }> = []

  return (
    <div className="p-6 space-y-6">
      <Link href="/itsm-config" className="text-gray-400 hover:text-gray-600 text-sm">
        ← ITSM Config
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Manager</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure service queues, teams, working hours, and escalation paths.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + New Queue
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Queue</th>
              <th className="px-4 py-3 text-left">Team</th>
              <th className="px-4 py-3 text-left">SLA Profile</th>
              <th className="px-4 py-3 text-left">Open Tickets</th>
              <th className="px-4 py-3 text-left">Default</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {queues.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No queues configured yet.
                </td>
              </tr>
            ) : (
              queues.map((queue) => (
                <tr key={queue.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {queue.name}
                    {queue.isDefault && (
                      <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{queue.teamId ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{queue.slaProfileName ?? 'Platform Default'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{queue.ticketCount}</td>
                  <td className="px-4 py-3">
                    {queue.isDefault ? (
                      <span className="text-green-600 text-xs font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
