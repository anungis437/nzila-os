/**
 * ITSM Problem Register
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { PROBLEM_STATUSES } from '@nzila/itsm-core'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Problem Register | ITSM',
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-yellow-100 text-yellow-700',
  known_error: 'bg-orange-100 text-orange-700',
  pending_change: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
}

export default async function ProblemRegisterPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // TODO: fetch problems from DB scoped by orgId
  const problems: Array<{
    id: string
    status: string
    priority: string
    title: string
    rootCause: string | null
    linkedTicketCount: number
    affectedServices: string[]
    createdAt: string
  }> = []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Problem Register</h1>
          <p className="text-sm text-gray-500 mt-1">Root cause analysis and known errors</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Log Problem
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {PROBLEM_STATUSES.map((s) => (
          <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer ${STATUS_COLOR[s] ?? 'bg-gray-100 text-gray-600'}`}>
            {s.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {/* Problems table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Problem</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Priority</th>
              <th className="px-4 py-3 text-left">Linked Tickets</th>
              <th className="px-4 py-3 text-left">Root Cause</th>
              <th className="px-4 py-3 text-left">Logged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {problems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No problems logged yet.
                </td>
              </tr>
            ) : (
              problems.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-sm">{p.title}</p>
                    {p.affectedServices.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.affectedServices.join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status] ?? 'bg-gray-100'}`}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs uppercase">{p.priority}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{p.linkedTicketCount}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {p.rootCause ?? 'Under investigation'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{p.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
