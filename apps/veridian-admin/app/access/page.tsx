import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Access Governance' }

type ReviewStatus = 'current' | 'overdue'

interface AccessGrant {
  user: string
  role: string
  sites: string
  lastReview: string
  status: ReviewStatus
}

const accessGrants: AccessGrant[] = [
  { user: 'clinician-demo-01', role: 'CLINICIAN', sites: 'demo-site', lastReview: '2024-10-01', status: 'current' },
  { user: 'clinician-demo-02', role: 'SPECIALIST', sites: 'demo-site, imaging-demo', lastReview: '2024-09-15', status: 'current' },
  { user: 'clinician-demo-03', role: 'CLINICIAN', sites: 'demo-site', lastReview: '2024-07-20', status: 'overdue' },
  { user: 'clinician-demo-04', role: 'CARE_COORDINATOR', sites: 'demo-site', lastReview: '2024-11-01', status: 'current' },
  { user: 'admin-demo-01', role: 'SITE_ADMIN', sites: 'demo-site', lastReview: '2024-06-30', status: 'overdue' },
]

const statusStyle: Record<ReviewStatus, string> = {
  current: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
}

export default function AccessPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Access Governance</h1>
        <p className="text-slate-500 mt-1">
          Synthetic access grants — no real user accounts. All entries are fabricated.
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="p-5 rounded-xl border border-slate-200 bg-white text-center min-w-[120px]">
          <div className="text-3xl font-extrabold text-teal-600">{accessGrants.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total grants</div>
        </div>
        <div className="p-5 rounded-xl border border-slate-200 bg-white text-center min-w-[120px]">
          <div className="text-3xl font-extrabold text-rose-600">
            {accessGrants.filter((g) => g.status === 'overdue').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Overdue reviews</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">User</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Role</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Sites</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Last Review</th>
              <th className="text-center px-5 py-3 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accessGrants.map((grant) => (
              <tr key={grant.user} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-700">{grant.user}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                    {grant.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">{grant.sites}</td>
                <td className="px-5 py-3 text-slate-500">{grant.lastReview}</td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusStyle[grant.status]}`}
                  >
                    {grant.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
