/**
 * Platform Admin — Queue Manager
 *
 * Real DB-backed list. Each row shows the queue's member count, default SLA
 * name, and live open-ticket count (computed from itsm_tickets).
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPageOrgContext } from '../../../lib/page-org-context'
import { listQueues, listSlaProfiles } from '../../../lib/itsm-queries'
import {
  ActiveOrgBadge,
  ForbiddenPanel,
  OrgPickerPanel,
} from '../../../lib/org-page-fallbacks'
import { canWrite } from '../../../lib/org-scope-guard'
import {
  DeleteQueueButton,
  NewQueueDialog,
} from '../_components/itsm-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Queue Manager | ITSM Config',
}

export default async function QueueManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>
}) {
  const sp = await searchParams
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return (
      <OrgPickerPanel candidates={result.candidates} returnTo="/itsm-config/queues" />
    )
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const { orgId, orgName, orgRole } = result.context
  const [queues, slaProfiles] = await Promise.all([
    listQueues(orgId),
    listSlaProfiles(orgId),
  ])
  const writable = canWrite(orgRole)
  const slaOptions = slaProfiles.map((s) => ({ id: s.id, name: s.name }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/itsm-config" className="text-gray-400 hover:text-gray-600 text-sm">
          ← ITSM Config
        </Link>
        <ActiveOrgBadge orgName={orgName} orgId={orgId} orgRole={orgRole} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Manager</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure service queues, members, and default SLA profile assignments.
          </p>
        </div>
        {writable && <NewQueueDialog orgId={orgId} slaProfiles={slaOptions} />}
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Queue</th>
              <th className="px-4 py-3 text-left">Members</th>
              <th className="px-4 py-3 text-left">Default SLA</th>
              <th className="px-4 py-3 text-right">Open Tickets</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {queues.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No queues configured for this organisation yet.
                  {writable && ' Click “New Queue” to create one.'}
                </td>
              </tr>
            ) : (
              queues.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {q.name}
                    {q.description && (
                      <p className="text-xs text-gray-500 mt-0.5 font-normal">
                        {q.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{q.memberCount}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {q.defaultSlaName ?? (
                      <span className="text-gray-400">Platform default</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {q.openTicketCount}
                  </td>
                  <td className="px-4 py-3">
                    {q.active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {writable ? (
                      <DeleteQueueButton orgId={orgId} queueId={q.id} />
                    ) : (
                      <span className="text-xs text-gray-300">Read-only</span>
                    )}
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
