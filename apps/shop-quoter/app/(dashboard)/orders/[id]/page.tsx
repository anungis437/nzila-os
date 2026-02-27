import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeftIcon,
  TruckIcon,
  ClockIcon,
  CheckCircleIcon,
  CubeIcon,
  UserIcon,
  MapPinIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline'
import { getOrderAction, getOrderLinesAction } from '@/app/actions/orders'
import { getCustomerAction } from '@/app/actions/customers'

/** Order status badge colours. */
const statusColors: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  fulfillment: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  return_requested: 'bg-amber-100 text-amber-700',
  needs_attention: 'bg-orange-100 text-orange-700',
}

const statusSteps = ['created', 'confirmed', 'fulfillment', 'shipped', 'delivered', 'completed'] as const

// ── Page Component ──────────────────────────────────────────────────────────

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await getOrderAction(params.id)
  if (!order) {
    notFound()
  }

  // Fetch related data
  const [linesResult, customer] = await Promise.all([
    getOrderLinesAction(params.id),
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
  const currentStepIndex = statusSteps.indexOf(order.status)

  const getNextAction = () => {
    switch (order.status) {
      case 'created': return { label: 'Confirm Order', action: 'confirm' }
      case 'confirmed': return { label: 'Start Fulfillment', action: 'fulfill' }
      case 'fulfillment': return { label: 'Ship Order', action: 'ship' }
      case 'shipped': return { label: 'Mark Delivered', action: 'deliver' }
      case 'delivered': return { label: 'Complete Order', action: 'complete' }
      default: return null
    }
  }

  const nextAction = getNextAction()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Orders
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{order.ref}</h1>
            <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${statusColors[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Customer: <Link href={`/clients/${order.customerId}`} className="text-purple-600 hover:underline">{customer?.name ?? 'Unknown'}</Link>
            · Created: <span className="font-medium text-gray-700">{new Date(order.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <PrinterIcon className="h-4 w-4" />
            Print
          </button>
          {nextAction && (
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm">
              {order.status === 'fulfillment' && <CubeIcon className="h-4 w-4" />}
              {order.status === 'shipped' && <TruckIcon className="h-4 w-4" />}
              {order.status === 'delivered' && <CheckCircleIcon className="h-4 w-4" />}
              {nextAction.label}
            </button>
          )}
        </div>
      </div>

      {/* Status Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Order Progress</h3>
        <div className="flex items-center justify-between">
          {statusSteps.map((step, index) => {
            const isComplete = index < currentStepIndex
            const isCurrent = index === currentStepIndex
            const _isPending = index > currentStepIndex
            
            return (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isComplete ? 'bg-green-500' : isCurrent ? 'bg-purple-500' : 'bg-gray-200'}`}>
                    {isComplete ? (
                      <CheckCircleIcon className="h-5 w-5 text-white" />
                    ) : (
                      <span className={`text-xs font-semibold ${isCurrent ? 'text-white' : 'text-gray-500'}`}>{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs mt-1 capitalize ${isCurrent ? 'text-purple-600 font-semibold' : isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                    {step}
                  </span>
                </div>
                {index < statusSteps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Allocation Warning - removed for now as allocation data comes from separate table */}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Order Notes</h2>
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
                <div className="h-9 w-9 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                  <UserIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <Link href={`/clients/${order.customerId}`} className="text-sm font-medium text-purple-600 hover:underline">
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
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ClockIcon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="text-sm">
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {order.orderLockedAt && (
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="text-sm">
                    <span className="text-gray-500">Locked:</span>
                    <span className="ml-2 text-gray-900">{new Date(order.orderLockedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
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
