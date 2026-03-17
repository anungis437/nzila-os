import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeftIcon,
  PencilIcon,
  ArrowPathIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { getSupplierAction } from '@/app/actions/suppliers'
import { getPurchaseOrdersAction } from '@/app/actions/purchase-orders'

/** Sync status indicators. */
const syncStatusDisplay: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  synced: { icon: CheckCircleIcon, color: 'text-green-700', bg: 'bg-green-100', label: 'Synced with Zoho' },
  pending: { icon: ClockIcon, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Sync Pending' },
  error: { icon: ExclamationTriangleIcon, color: 'text-red-700', bg: 'bg-red-100', label: 'Sync Error' },
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  const supplier = await getSupplierAction(params.id)
  if (!supplier) {
    notFound()
  }

  // Fetch recent POs for this supplier
  const posResult = await getPurchaseOrdersAction({ limit: 5, supplierId: params.id })
  const recentPOs = posResult.rows

  // Determine sync status
  const syncStatus = supplier.zohoVendorId ? 'synced' : 'pending'
  const syncInfo = syncStatusDisplay[syncStatus]
  const SyncIcon = syncInfo.icon

  // Parse address if stored as JSON
  const address =
    typeof supplier.address === 'object' && supplier.address
      ? (supplier.address as { street?: string; city?: string; state?: string; postalCode?: string; country?: string })
      : null

  // Stats
  const totalPOValue = recentPOs.reduce((acc, po) => acc + parseFloat(po.total), 0)
  const activePOs = recentPOs.filter((po) => !['received', 'cancelled'].includes(po.status)).length

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Suppliers
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${syncInfo.bg} ${syncInfo.color}`}>
              <SyncIcon className="h-3.5 w-3.5" />
              {syncInfo.label}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            ID: <span className="font-mono">{supplier.id.slice(0, 8)}</span>
            {supplier.zohoVendorId && (
              <> · Zoho ID: <span className="font-mono">{supplier.zohoVendorId}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <ArrowPathIcon className="h-4 w-4" />
            Sync Now
          </button>
          <Link
            href={`/suppliers/${params.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
          >
            <PencilIcon className="h-4 w-4" />
            Edit Supplier
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Contact Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <EnvelopeIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  {supplier.email ? (
                    <a href={`mailto:${supplier.email}`} className="text-sm text-purple-600 hover:underline">
                      {supplier.email}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PhoneIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  {supplier.phone ? (
                    <a href={`tel:${supplier.phone}`} className="text-sm text-gray-900">
                      {supplier.phone}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BuildingOfficeIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contact Person</p>
                  <p className="text-sm text-gray-900">{supplier.contactName ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Address</p>
                  {address ? (
                    <p className="text-sm text-gray-900">
                      {address.street && <>{address.street}<br /></>}
                      {address.city}, {address.state} {address.postalCode}<br />
                      {address.country}
                    </p>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent POs */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Purchase Orders</h2>
              <Link
                href={`/purchase-orders/new?supplierId=${supplier.id}`}
                className="text-sm text-purple-600 font-medium hover:underline"
              >
                + New PO
              </Link>
            </div>
            {recentPOs.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">PO Number</th>
                    <th className="text-left py-2 font-medium text-gray-500">Status</th>
                    <th className="text-right py-2 font-medium text-gray-500">Amount</th>
                    <th className="text-right py-2 font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPOs.map((po) => (
                    <tr key={po.id} className="border-b border-gray-50">
                      <td className="py-3">
                        <Link href={`/purchase-orders/${po.id}`} className="text-purple-600 hover:underline font-medium">
                          {po.ref}
                        </Link>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${po.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {po.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono">${parseFloat(po.total).toLocaleString()}</td>
                      <td className="py-3 text-right text-gray-500">
                        {po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">No purchase orders yet.</p>
            )}
          </div>

          {/* Notes */}
          {supplier.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Summary</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize mt-1 ${supplier.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {supplier.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Terms</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{supplier.paymentTerms ?? 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Active POs</p>
                <p className="text-2xl font-bold text-purple-600">{activePOs}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total PO Value (Recent)</p>
                <p className="text-xl font-bold text-gray-900">${totalPOValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Lead Time</span>
                <span className="text-gray-900">{supplier.leadTimeDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rating</span>
                <span className="text-gray-900">{supplier.rating ? `${supplier.rating}/5` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">
                  {supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span className="text-gray-900">
                  {supplier.updatedAt ? new Date(supplier.updatedAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">Danger Zone</h3>
            <p className="text-xs text-gray-500 mb-4">
              Deactivating a supplier will prevent new purchase orders.
            </p>
            <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition w-full justify-center">
              <TrashIcon className="h-4 w-4" />
              Deactivate Supplier
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
