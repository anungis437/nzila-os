import Link from 'next/link'
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'
import { getPurchaseOrdersAction, getPurchaseOrdersSummaryAction } from '@/app/actions/purchase-orders'
import { getSuppliersAction } from '@/app/actions/suppliers'

/** PO status badge colours. */
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-amber-100 text-amber-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  partial_received: 'bg-purple-100 text-purple-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

/** Status display labels. */
const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  partial_received: 'Partial',
  received: 'Received',
  cancelled: 'Cancelled',
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function PurchaseOrdersListPage() {
  // Fetch POs and suppliers from database
  const [posResult, suppliersResult, summary] = await Promise.all([
    getPurchaseOrdersAction(),
    getSuppliersAction(),
    getPurchaseOrdersSummaryAction(),
  ])

  const orders = posResult.rows
  const suppliers = new Map(suppliersResult.rows.map((s) => [s.id, s]))

  // Summary stats from DB (summary is an object with direct properties)
  const draftCount = summary.draft
  const activeCount =
    summary.sent + summary.acknowledged + summary.partialReceived
  const awaitingDelivery = summary.sent
  const totalOpenValue = orders
    .filter((po) => !['received', 'cancelled'].includes(po.status))
    .reduce((acc, po) => acc + parseFloat(po.total), 0)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage supplier purchase orders with receiving workflow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <ArrowPathIcon className="h-4 w-4" />
            Sync with Zoho
          </button>
          <Link
            href="/purchase-orders/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            New PO
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Draft POs</p>
          <p className="text-2xl font-bold text-gray-600">{draftCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active Orders</p>
          <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Awaiting Delivery</p>
            <p className="text-2xl font-bold text-purple-600">{awaitingDelivery}</p>
          </div>
          {awaitingDelivery > 0 && (
            <TruckIcon className="h-8 w-8 text-purple-400" />
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Open PO Value</p>
          <p className="text-2xl font-bold text-green-600">
            ${totalOpenValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by PO number, supplier..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="ordered">Ordered</option>
          <option value="partially_received">Partially Received</option>
          <option value="received">Received</option>
        </select>
        <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          <FunnelIcon className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                PO Number
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Supplier
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Status
              </th>
              <th className="text-center px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Lines
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Total
              </th>
              <th className="text-center px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Received
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Expected
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => {
              const supplier = suppliers.get(po.supplierId)
              const totalAmount = parseFloat(po.total)
              return (
                <tr
                  key={po.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <Link href={`/purchase-orders/${po.id}`} className="font-semibold text-purple-600 hover:underline">
                      {po.ref}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-gray-900">{supplier?.name ?? 'Unknown'}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusColors[po.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {statusLabels[po.status] ?? po.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-gray-600">—</td>
                  <td className="px-5 py-4 text-right text-gray-900 font-mono font-semibold">
                    {totalAmount > 0 ? `$${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {po.status !== 'draft' && po.status !== 'cancelled' ? (
                      <span className={`text-xs font-medium ${po.status === 'received' ? 'text-green-600' : 'text-purple-600'}`}>
                        {po.status === 'received' ? '100%' : po.status === 'partial_received' ? 'Partial' : '0%'}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500">
                    {po.expectedDeliveryDate?.toLocaleDateString() ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 mb-3">No purchase orders found.</p>
            <Link href="/purchase-orders/new" className="text-purple-600 font-semibold hover:underline">
              Create your first PO →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
