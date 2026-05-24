/**
 * Platform Admin — Approval Workflows
 *
 * Real DB-backed list of approvals with summary stats. Approvers can decide
 * directly from the list; every decision is NAR-sealed via the itsm-audit
 * logger and appends to the per-org audit hash chain.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPageOrgContext } from '../../../lib/page-org-context'
import { getApprovalStats, listApprovals } from '../../../lib/itsm-queries'
import {
  ActiveOrgBadge,
  ForbiddenPanel,
  OrgPickerPanel,
} from '../../../lib/org-page-fallbacks'
import { canWrite } from '../../../lib/org-scope-guard'
import { ApprovalDecisionButtons } from '../_components/itsm-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Approval Workflows | ITSM Config',
}

function formatRelative(date: Date | null) {
  if (!date) return '—'
  const ms = Date.now() - date.getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; status?: string }>
}) {
  const sp = await searchParams
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return (
      <OrgPickerPanel
        candidates={result.candidates}
        returnTo="/itsm-config/approvals"
      />
    )
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const { actorId, orgId, orgName, orgRole } = result.context
  const filterStatus =
    sp.status === 'approved' ||
    sp.status === 'rejected' ||
    sp.status === 'escalated' ||
    sp.status === 'pending'
      ? sp.status
      : 'pending'

  const [approvals, stats] = await Promise.all([
    listApprovals(orgId, { status: filterStatus }),
    getApprovalStats(orgId),
  ])
  const writable = canWrite(orgRole)

  const STATUSES: Array<{
    key: 'pending' | 'approved' | 'rejected' | 'escalated'
    label: string
  }> = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'escalated', label: 'Escalated' },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/itsm-config" className="text-gray-400 hover:text-gray-600 text-sm">
          ← ITSM Config
        </Link>
        <ActiveOrgBadge orgName={orgName} orgId={orgId} orgRole={orgRole} />
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Approval Workflows</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live approval queue for this organisation. Decisions are NAR-sealed
          and append to the per-org audit hash chain.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Approved</p>
          <p className="text-2xl font-semibold text-emerald-600 mt-1">{stats.approved}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Rejected</p>
          <p className="text-2xl font-semibold text-rose-600 mt-1">{stats.rejected}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Escalated</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">{stats.escalated}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {STATUSES.map((s) => {
          const active = s.key === filterStatus
          return (
            <Link
              key={s.key}
              href={`/itsm-config/approvals?status=${s.key}`}
              className={
                active
                  ? 'rounded-md bg-gray-900 px-2.5 py-1 font-medium text-white'
                  : 'rounded-md border border-gray-200 px-2.5 py-1 text-gray-600 hover:bg-gray-50'
              }
            >
              {s.label} ({stats[s.key]})
            </Link>
          )
        })}
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Requested</th>
              <th className="px-4 py-3 text-left">Due</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {approvals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No {filterStatus} approvals.
                </td>
              </tr>
            ) : (
              approvals.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.subjectType}</p>
                    <p className="text-xs text-gray-500 font-mono">{a.subjectId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        a.status === 'approved'
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : a.status === 'rejected'
                            ? 'rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700'
                            : a.status === 'escalated'
                              ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700'
                              : 'rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700'
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatRelative(a.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {a.dueBy ? (
                      new Date(a.dueBy).toLocaleString()
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.status === 'pending' && writable ? (
                      <ApprovalDecisionButtons
                        orgId={orgId}
                        approvalId={a.id}
                        canDecide={a.approverId === actorId}
                      />
                    ) : a.decidedAt ? (
                      <span className="text-xs text-gray-500">
                        {formatRelative(a.decidedAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Records persist in <code className="font-mono">itsm_approvals</code>.
        Decisions append a NAR-sealed entry to{' '}
        <code className="font-mono">audit_records</code> for this org.
      </p>
    </div>
  )
}
