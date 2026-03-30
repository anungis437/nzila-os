/**
 * Mobility OS — Clients List
 *
 * Client directory with search, wealth tier filtering, and quick-access to profiles.
 */
export const dynamic = 'force-dynamic'

import Link from 'next/link'

const tierBadge: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  hnwi: 'bg-blue-100 text-blue-700',
  uhnwi: 'bg-amber-100 text-amber-800',
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tier?: string }>
}) {
  const params = await searchParams
  const _search = params.search
  const _tier = params.tier

  // TODO: Replace with real DB query
  const clients = [
    { id: 'cl-001', name: 'Jean-Pierre Mokolo', nationality: 'CD', tier: 'hnwi', activeCases: 2, email: 'jp@example.com' },
    { id: 'cl-002', name: 'Amina Diallo', nationality: 'SN', tier: 'uhnwi', activeCases: 1, email: 'amina@example.com' },
    { id: 'cl-003', name: 'Chen Wei', nationality: 'CN', tier: 'hnwi', activeCases: 1, email: 'chen@example.com' },
    { id: 'cl-004', name: 'Fatima Al-Hassan', nationality: 'AE', tier: 'standard', activeCases: 1, email: 'fatima@example.com' },
    { id: 'cl-005', name: 'Kwame Asante', nationality: 'GH', tier: 'hnwi', activeCases: 3, email: 'kwame@example.com' },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">Client directory and profiles</p>
        </div>
        <Link
          href="/clients/new"
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition"
        >
          Add Client
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="search"
          placeholder="Search clients..."
          className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        />
        {['All', 'HNWI', 'UHNWI', 'Standard'].map((f) => (
          <button
            key={f}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Clients Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <div
            key={client.id}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{client.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{client.email}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full uppercase ${tierBadge[client.tier] ?? 'bg-gray-100 text-gray-600'}`}>
                {client.tier}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Nationality: {client.nationality}</span>
              <span className="text-gray-500">{client.activeCases} active case{client.activeCases !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
