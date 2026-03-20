import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import {
  ArrowLeftIcon,
  UserIcon,
  MapPinIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline'
import { getOrderAction, getOrderLinesAction } from '@/app/actions/orders'
import { getCustomerAction } from '@/app/actions/customers'
import { OrderActions } from './order-actions'
import { StatusBadge, ProgressStepper, LifecycleTimeline, SystemGuidance } from '@/app/(dashboard)/components'
import type { Step, TimelineEvent } from '@/app/(dashboard)/components'

const ORDER_STEPS: Step[] = [
  { key: 'created',     label: 'Created' },
  { key: 'confirmed',   label: 'Confirmed' },
  { key: 'fulfillment', label: 'Fulfillment' },
  { key: 'shipped',     label: 'Shipped' },
  { key: 'delivered',   label: 'Delivered' },
  { key: 'completed',   label: 'Completed' },
]

// ── Page Component ──────────────────────────────────────────────────────────

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  const order = await getOrderAction(id)
  if (!order) {
    notFound()
  }

  // Fetch related data
  const [linesResult, customer] = await Promise.all([
    getOrderLinesAction(id),
    getCustomerAction(order.customerId),
  ])

  const lines = linesResult

  // Parse numeric fields
  const total = parseFloat(order.total)

  // Parse shipping address from JSONB
  const shippingAddress = order.shippingAddress as { 
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string 
  } | null

  // Calculate totals
  const totalQuantity = lines.reduce((acc, line) => acc + line.quantity, 0)
  const currentStepIndex = ORDER_STEPS.findIndex((s) => s.key === order.status)

  // Build sidebar timeline events
  const timelineEvents: TimelineEvent[] = [
    { label: 'Created', description: 'Order created', timestamp: order.createdAt },
  ]
  if (order.orderLockedAt) {
    timelineEvents.push({ label: 'Locked', description: 'Order confirmed and locked', timestamp: order.orderLockedAt })
  }

  // Guidance message based on current status
  const guidance = (() => {
    switch (order.status) {
      case 'created':    return { severity: 'info' as const, msg: 'Review line items and confirm this order to begin procurement.' }
      case 'confirmed':  return { severity: 'info' as const, msg: 'Order is confirmed. Create purchase orders or check production readiness.' }
      case 'fulfillment': return { severity: 'tip' as const, msg: 'All materials received. Mark as shipped once packaging is complete.' }
      case 'shipped':    return { severity: 'info' as const, msg: 'Shipment is in transit. Mark delivered once the customer confirms receipt.' }
      case 'delivered':  return { severity: 'success' as const, msg: 'Customer has received the order. Complete to close.' }
      case 'cancelled':  return { severity: 'warning' as const, msg: 'This order has been cancelled.' }
      default:           return null
    }
  })()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`${base}/orders`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-electric transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Orders
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-navy">{order.ref}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-gray-500">
            Customer: <Link href={`${base}/clients/${order.customerId}`} className="text-electric hover:underline">{customer?.name ?? 'Unknown'}</Link>
            · Created: <span className="font-medium text-gray-700">{new Date(order.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <PrinterIcon className="h-4 w-4" />
            Print
          </button>
          <OrderActions orderId={id} status={order.status} />
        </div>
      </div>

      {/* Status Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Order Progress</h3>
        <ProgressStepper steps={ORDER_STEPS} currentIndex={currentStepIndex >= 0 ? currentStepIndex : 0} />
      </div>

      {/* System Guidance */}
      {guidance && (
        <SystemGuidance severity={guidance.severity} className="mb-6">
          {guidance.msg}
        </SystemGuidance>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-navy">Order Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Product</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Unit Price</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const lineUnitPrice = parseFloat(line.unitPrice)
                  const lineTotal = parseFloat(line.lineTotal)
                  return (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">
                          {line.description}
                        </span>
                        {line.sku && <p className="text-xs text-gray-500 font-mono">{line.sku}</p>}
                      </td>
                      <td className="px-4 py-4 text-center font-mono">{line.quantity}</td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">${lineUnitPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-mono font-semibold">${lineTotal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Order Total</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-lg">${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-navy mb-3">Order Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Customer</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 bg-electric/10 rounded-lg flex items-center justify-center shrink-0">
                  <UserIcon className="h-5 w-5 text-electric" />
                </div>
                <div>
                  <Link href={`${base}/clients/${order.customerId}`} className="text-sm font-medium text-electric hover:underline">
                    {customer?.name ?? 'Unknown'}
                  </Link>
                  <p className="text-xs text-gray-500">{customer?.email ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {shippingAddress && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Ship To</h3>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <MapPinIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-900">
                    {shippingAddress.street && <>{shippingAddress.street}<br /></>}
                    {shippingAddress.city && <>{shippingAddress.city}, </>}
                    {shippingAddress.state && <>{shippingAddress.state} </>}
                    {shippingAddress.postalCode && <>{shippingAddress.postalCode}<br /></>}
                    {shippingAddress.country}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Timeline</h3>
            <LifecycleTimeline events={timelineEvents} />
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Line Items</span>
                <span className="font-medium text-gray-900">{lines.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Units</span>
                <span className="font-medium text-gray-900">{totalQuantity}</span>
              </div>
              <div className="flex justify-between text-sm pt-3 border-t border-gray-100">
                <span className="text-gray-500">Order Total</span>
                <span className="font-bold text-gray-900">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
