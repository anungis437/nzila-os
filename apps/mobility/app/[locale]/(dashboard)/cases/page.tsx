/**
 * Mobility OS — Cases List
 *
 * Table view of all mobility cases with filtering by status, program, and advisor.
 */
export const dynamic = 'force-dynamic'

import Link from 'next/link'

const statusColors: Record<string, string> = {
  intake: 'bg-gray-100 text-gray-700',
  eligibility_review: 'bg-blue-100 text-blue-700',
  kyc_aml: 'bg-amber-100 text-amber-700',
  document_collection: 'bg-purple-100 text-purple-700',
  application_prep: 'bg-indigo-100 text-indigo-700',
  submitted: 'bg-cyan-100 text-cyan-700',
  government_review: 'bg-teal-100 text-teal-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  active: 'bg-emerald-100 text-emerald-800',
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; program?: string; page?: string }>
}) {
  const params = await searchParams
  const _status = params.status
  const _program = params.program
  const _page = Number(params.page ?? '1')

  // TODO: Replace with real DB query
  const cases = [
    { id: 'c-001', client: 'Jean-Pierre Mokolo', program: 'Malta MPRP', status: 'document_collection', advisor: 'Sarah N.', updated: '2026-03-09' },
    { id: 'c-002', client: 'Amina Diallo', program: 'Portugal Golden Visa', status: 'kyc_aml', advisor: 'David K.', updated: '2026-03-08' },
    { id: 'c-003', client: 'Chen Wei', program: 'Grenada CBI', status: 'submitted', advisor: 'Sarah N.', updated: '2026-03-07' },
    { id: 'c-004', client: 'Fatima Al-Hassan', program: 'UAE Golden Visa', status: 'eligibility_review', advisor: 'Marie T.', updated: '2026-03-06' },
    { id: 'c-005', client: 'Kwame Asante', program: 'St Kitts CBI', status: 'approved', advisor: 'David K.', updated: '2026-03-05' },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cases</h1>
          <p className="text-gray-500 mt-1">Manage client immigration cases</p>
        </div>
        <Link
          href="/cases/new"
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition"
        >
          New Case
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        {['All', 'Active', 'Pending', 'Completed'].map((filter) => (
          <button
            key={filter}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Cases Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Client</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Program</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Advisor</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition cursor-pointer">
                <td className="px-6 py-4 font-medium text-gray-900">{c.client}</td>
                <td className="px-6 py-4 text-gray-600">{c.program}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{c.advisor}</td>
                <td className="px-6 py-4 text-gray-500">{c.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
