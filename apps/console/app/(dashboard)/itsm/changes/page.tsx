/**
 * ITSM Change Calendar — RFC list with calendar view
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { CHANGE_TYPES } from '@nzila/itsm-core'
import { platformDb } from '@nzila/db/platform'
import { itsmChanges } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Change Calendar | ITSM',
}

const CHANGE_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
  rolled_back: 'bg-purple-100 text-purple-700',
}

export default async function ChangeCalendarPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  let changes: Array<{
    id: string
    rfcNumber: string
    type: string
    status: string
    title: string
    scheduledStart: string | null
    scheduledEnd: string | null
    riskLevel: string
  }> = []

  if (orgId) {
    const rows = await platformDb
      .select({
        id: itsmChanges.id,
        changeNumber: itsmChanges.changeNumber,
        type: itsmChanges.type,
        status: itsmChanges.status,
        title: itsmChanges.title,
        scheduledStart: itsmChanges.scheduledStart,
        scheduledEnd: itsmChanges.scheduledEnd,
        riskLevel: itsmChanges.riskLevel,
      })
      .from(itsmChanges)
      .where(eq(itsmChanges.orgId, orgId))
      .orderBy(desc(itsmChanges.createdAt))
      .limit(200)
      .catch(() => [])

    changes = rows.map((row) => ({
      id: row.id,
      rfcNumber: row.changeNumber,
      type: row.type,
      status: row.status,
      title: row.title,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      riskLevel: row.riskLevel,
    }))
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">RFC pipeline and change schedule</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Request Change
        </button>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        {CHANGE_TYPES.map((t) => (
          <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 cursor-pointer hover:bg-gray-200">
            {t.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {/* Changes table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">RFC</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Risk</th>
              <th className="px-4 py-3 text-left">Scheduled Window</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {changes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No change requests filed yet.
                </td>
              </tr>
            ) : (
              changes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-blue-600">{c.rfcNumber}</span>
                    <p className="text-gray-900 truncate max-w-xs">{c.title}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{c.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHANGE_STATUS_COLOR[c.status] ?? 'bg-gray-100'}`}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{c.riskLevel}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {c.scheduledStart ? `${c.scheduledStart} – ${c.scheduledEnd ?? '?'}` : '—'}
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
