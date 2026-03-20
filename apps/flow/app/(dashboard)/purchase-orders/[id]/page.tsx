import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PrinterIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'
import { getPurchaseOrderWithLinesAction } from '@/app/actions/purchase-orders'
import { getSupplierAction } from '@/app/actions/suppliers'
import { POActions } from './po-actions'
import { StatusBadge, LifecycleTimeline, SystemGuidance } from '@/app/(dashboard)/components'
import type { TimelineEvent } from '@/app/(dashboard)/components'

// ── Page Component ──────────────────────────────────────────────────────────

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  const po = await getPurchaseOrderWithLinesAction(id)
  if (!po) {
    notFound()
  }

  // Fetch supplier name
  const supplier = await getSupplierAction(po.supplierId)

  // Parse numeric fields
  const subtotal = parseFloat(po.subtotal)
  const taxTotal = parseFloat(po.taxTotal)
  const total = parseFloat(po.total)

  // Calculate totals
  const totalReceived = po.lines.reduce((acc, line) => acc + line.quantityReceived, 0)
  const totalOrdered = po.lines.reduce((acc, line) => acc + line.quantity, 0)
  const receivedPercentage = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0

  const canReceive = ['sent', 'acknowledged', 'partial_received'].includes(po.status)
  const _canEdit = po.status === 'draft'
  const _canApprove = po.status === 'draft' || po.status === 'acknowledged'

  // Build timeline events
  const poTimeline: TimelineEvent[] = [
    { label: 'Created', description: `PO created by ${po.createdBy}`, timestamp: po.createdAt },
  ]
  if (po.sentAt) poTimeline.push({ label: 'Sent to Supplier', timestamp: po.sentAt })
  if (po.expectedDeliveryDate && !po.actualDeliveryDate)
    poTimeline.push({ label: 'Expected Delivery', timestamp: po.expectedDeliveryDate })
  if (po.actualDeliveryDate) poTimeline.push({ label: 'Received', timestamp: po.actualDeliveryDate })

  // Guidance
  const poGuidance = (() => {
    switch (po.status) {
      case 'draft':             return { severity: 'info' as const, msg: 'Review line items and send to the supplier when ready.' }
      case 'sent':              return { severity: 'info' as const, msg: 'Waiting for supplier acknowledgement.' }
      case 'acknowledged':      return { severity: 'tip' as const, msg: 'Supplier acknowledged. Begin receiving items as they arrive.' }
      case 'partial_received':  return { severity: 'warning' as const, msg: `${totalReceived} of ${totalOrdered} items received. Continue receiving to complete.` }
      case 'received':          return { severity: 'success' as const, msg: 'All items received. This PO is complete.' }
      case 'cancelled':         return { severity: 'warning' as const, msg: 'This purchase order has been cancelled.' }
      default:                  return null
    }
  })()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`${base}/purchase-orders`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-electric transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Purchase Orders
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-navy">{po.ref}</h1>
            <StatusBadge status={po.status} />
          </div>
          <p className="text-sm text-gray-500">
            Supplier: <Link href={`${base}/suppliers/${po.supplierId}`} className="text-electric hover:underline">{supplier?.name ?? 'Unknown'}</Link>
            {po.zohoPoId && (
              <> · Zoho: <span className="font-mono">{po.zohoPoId}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <PrinterIcon className="h-4 w-4" />
            Print
          </button>
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <DocumentDuplicateIcon className="h-4 w-4" />
            Duplicate
          </button>
          <POActions
            poId={id}
            status={po.status}
            lines={po.lines.map((l) => ({
              id: l.id,
              description: l.description ?? '',
              quantity: l.quantity ?? 0,
              quantityReceived: l.quantityReceived ?? 0,
            }))}
          />
        </div>
      </div>

      {/* Progress Bar (for ordered/partial) */}
      {canReceive && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Receiving Progress</h3>
            <span className="text-sm text-gray-500">{receivedPercentage}% received</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${receivedPercentage === 100 ? 'bg-green-500' : 'bg-electric'}`}
              style={{ width: `${receivedPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{totalReceived} of {totalOrdered} items received</span>
            {po.expectedDeliveryDate && <span>Expected: {new Date(po.expectedDeliveryDate).toLocaleDateString()}</span>}
          </div>
        </div>
      )}

      {/* System Guidance */}
      {poGuidance && (
        <SystemGuidance severity={poGuidance.severity} className="mb-6">
          {poGuidance.msg}
        </SystemGuidance>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-navy">Line Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Product</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Ordered</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Received</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Unit Cost</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((line) => {
                  const lineUnitCost = parseFloat(line.unitCost)
                  const lineTotal = parseFloat(line.lineTotal)
                  return (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-6 py-4">
                        {line.productId ? (
                          <Link href={`${base}/products/${line.productId}`} className="font-medium text-electric hover:underline">
                            {line.description}
                          </Link>
                        ) : (
                          <span className="font-medium text-gray-900">{line.description}</span>
                        )}
                        {line.sku && <p className="text-xs text-gray-500 font-mono">{line.sku}</p>}
                      </td>
                      <td className="px-4 py-4 text-center font-mono">{line.quantity}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-mono ${line.quantityReceived === line.quantity ? 'text-green-600' : line.quantityReceived > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {line.quantityReceived}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">${lineUnitCost.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-mono font-semibold">${lineTotal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-6 py-3 text-right text-sm text-gray-600">Subtotal</td>
                  <td className="px-6 py-3 text-right font-mono">${subtotal.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-6 py-3 text-right text-sm text-gray-600">Tax</td>
                  <td className="px-6 py-3 text-right font-mono">${taxTotal.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={4} className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-lg">${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {po.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-navy mb-3">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{po.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Timeline</h3>
            <LifecycleTimeline events={poTimeline} />
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Line Items</span>
                <span className="font-medium text-gray-900">{po.lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Units</span>
                <span className="font-medium text-gray-900">{totalOrdered}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Received</span>
                <span className="font-medium text-gray-900">{totalReceived}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="text-gray-500">Total Amount</span>
                <span className="font-bold text-gray-900">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Sync Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Zoho Integration</h3>
            {po.zohoPoId ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700">Synced</p>
                  <p className="text-xs text-green-600 font-mono">{po.zohoPoId}</p>
                </div>
              </div>
            ) : (
              <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-electric/5 text-electric text-sm font-medium rounded-lg hover:bg-electric/10 transition">
                <ArrowPathIcon className="h-4 w-4" />
                Sync to Zoho
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
