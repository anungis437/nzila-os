import Link from 'next/link'
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { getSuppliersAction } from '@/app/actions/suppliers'

/** Supplier status badge colours. */
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
}

/** Sync status indicators. */
const syncStatusDisplay: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  synced: { icon: CheckCircleIcon, color: 'text-green-500', label: 'Synced' },
  pending: { icon: ArrowPathIcon, color: 'text-amber-500', label: 'Pending' },
  error: { icon: ExclamationTriangleIcon, color: 'text-red-500', label: 'Error' },
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function SuppliersListPage() {
  // Fetch suppliers from database
  const result = await getSuppliersAction()
  const suppliers = result.rows

  // Summary stats
  const activeCount = suppliers.filter((s) => s.status === 'active').length
  const pendingSyncCount = suppliers.filter((s) => s.zohoVendorId === null).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your supplier relationships and track purchase orders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <ArrowPathIcon className="h-4 w-4" />
            Sync with Zoho
          </button>
          <Link
            href="/suppliers/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Add Supplier
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Suppliers</p>
          <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending Sync</p>
          <p className="text-2xl font-bold text-amber-600">{pendingSyncCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Avg Lead Time</p>
          <p className="text-2xl font-bold text-purple-600">
            {suppliers.length > 0 
              ? Math.round(suppliers.reduce((acc, s) => acc + (s.leadTimeDays ?? 0), 0) / suppliers.length)
              : 0} days
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, code, email..."
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
                Supplier
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Contact
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Status
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Zoho Sync
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Lead Time
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => {
              const syncStatus = supplier.zohoVendorId ? 'synced' : 'pending'
              const syncInfo = syncStatusDisplay[syncStatus]
              const SyncIcon = syncInfo.icon
              return (
                <tr
                  key={supplier.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <Link href={`/suppliers/${supplier.id}`} className="block">
                      <span className="font-semibold text-purple-600 hover:underline block">
                        {supplier.name}
                      </span>
                      <span className="text-xs text-gray-500">{supplier.id.slice(0, 8)}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-900 block">{supplier.email ?? '—'}</span>
                    <span className="text-xs text-gray-500">{supplier.phone ?? '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${statusColors[supplier.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {supplier.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${syncInfo.color}`}>
                      <SyncIcon className="h-4 w-4" />
                      {syncInfo.label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-900 font-mono">
                    {supplier.leadTimeDays ?? 0}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500">
                    {supplier.updatedAt?.toLocaleDateString() ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {suppliers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-gray-500 mb-3">No suppliers found.</p>
            <Link href="/suppliers/new" className="text-purple-600 font-semibold hover:underline">
              Add your first supplier →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
