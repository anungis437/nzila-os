import Link from 'next/link'
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

/** Status badge colours. */
const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PRICING: 'bg-blue-100 text-blue-700',
  READY: 'bg-indigo-100 text-indigo-700',
  SENT: 'bg-purple-100 text-purple-700',
  REVIEWING: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

// ── Placeholder data (replace with real DB fetch) ───────────────────────────

interface QuoteRow {
  id: string
  reference: string
  customer: string
  tier: string
  status: string
  total: string
  createdAt: string
}

const PLACEHOLDER_QUOTES: QuoteRow[] = [
  {
    id: 'demo-1',
    reference: 'SQ-2026-001',
    customer: 'Desjardins Assurances',
    tier: 'Premium',
    status: 'DRAFT',
    total: '$0.00',
    createdAt: '2026-02-24',
  },
  {
    id: 'demo-2',
    reference: 'SQ-2026-002',
    customer: 'Hydro-Québec',
    tier: 'Standard',
    status: 'SENT',
    total: '$0.00',
    createdAt: '2026-02-23',
  },
]

// ── Page Component ──────────────────────────────────────────────────────────

export default function QuotesListPage() {
  const quotes = PLACEHOLDER_QUOTES

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage gift box proposals and track their lifecycle.
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          New Quote
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by reference, client..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          <FunnelIcon className="h-4 w-4" />
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Reference
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Client
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Tier
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Status
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Total
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr
                key={q.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
              >
                <td className="px-5 py-4">
                  <Link href={`/quotes/${q.id}`} className="font-semibold text-purple-600 hover:underline">
                    {q.reference}
                  </Link>
                </td>
                <td className="px-5 py-4 text-gray-900">{q.customer}</td>
                <td className="px-5 py-4 text-gray-600">{q.tier}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusColors[q.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {q.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-gray-900 font-mono">{q.total}</td>
                <td className="px-5 py-4 text-right text-gray-500">{q.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {quotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-gray-500 mb-3">No quotes found.</p>
            <Link href="/quotes/new" className="text-purple-600 font-semibold hover:underline">
              Create your first quote →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
