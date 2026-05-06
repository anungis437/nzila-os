/**
 * TrustCore — Admin Lead List
 *
 * /admin/leads
 *
 * Platform admin only. Lists all captured pre-onboarding leads.
 */

import { requireRole } from '@/lib/rbac/requireRole'
import { listTrustcoreLeads } from '@nzila/db/queries/trustcore'
import { UserGroupIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

function statusBadge(lead: { convertedAt: Date | null }) {
  if (lead.convertedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
        Converted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      Lead
    </span>
  )
}

export default async function AdminLeadsPage() {
  await requireRole(['platform_admin'])
  const leads = await listTrustcoreLeads()

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <UserGroupIcon className="h-7 w-7 text-teal-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Capture</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {leads.length} total lead{leads.length !== 1 ? 's' : ''} captured
          </p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          No leads captured yet.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Source
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Captured
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Converted
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => (
                <tr
                  key={lead.id}
                  className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                >
                  <td className="px-5 py-3 text-gray-800 font-medium">{lead.email}</td>
                  <td className="px-5 py-3 text-gray-600 capitalize">
                    {lead.source.replace(/_/g, ' ')}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {lead.capturedAt.toLocaleDateString('en-CA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {lead.convertedAt
                      ? lead.convertedAt.toLocaleDateString('en-CA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-5 py-3">{statusBadge(lead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
