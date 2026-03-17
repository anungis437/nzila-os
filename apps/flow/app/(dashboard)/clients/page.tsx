import Link from 'next/link'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'

// ── Placeholder data (replace with real DB fetch) ───────────────────────────

interface ClientRow {
  id: string
  name: string
  contactName: string
  email: string | null
  phone: string | null
  quoteCount: number
  lastActivity: string
}

const PLACEHOLDER_CLIENTS: ClientRow[] = [
  {
    id: 'c-1',
    name: 'Desjardins Assurances',
    contactName: 'Marie-Claire Dubé',
    email: 'achats@desjardins.com',
    phone: '514-555-0100',
    quoteCount: 3,
    lastActivity: '2026-02-24',
  },
  {
    id: 'c-2',
    name: 'Hydro-Québec',
    contactName: 'Jean-François Lavoie',
    email: 'cadeaux@hydroquebec.com',
    phone: '418-555-0200',
    quoteCount: 1,
    lastActivity: '2026-02-20',
  },
  {
    id: 'c-3',
    name: 'Bombardier Aéronautique',
    contactName: 'Isabelle Tremblay',
    email: 'corp.gifts@bombardier.com',
    phone: '514-555-0300',
    quoteCount: 0,
    lastActivity: '2026-02-18',
  },
]

export default function ClientsPage() {
  const clients = PLACEHOLDER_CLIENTS

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your client directory and view quote history.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm">
          <PlusIcon className="h-4 w-4" />
          Add Client
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search clients..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <div
            key={client.id}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{client.name}</h3>
                <p className="text-sm text-gray-500">{client.contactName}</p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full">
                {client.quoteCount} quotes
              </span>
            </div>

            <div className="space-y-1.5 mb-4">
              {client.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <PhoneIcon className="h-4 w-4 text-gray-400" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Last activity: {client.lastActivity}</span>
              <Link
                href={`/quotes/new?client=${client.id}`}
                className="text-sm font-semibold text-purple-600 hover:text-purple-700"
              >
                New Quote →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-gray-500 mb-3">No clients yet.</p>
        </div>
      )}
    </div>
  )
}
