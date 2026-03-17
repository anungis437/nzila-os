import Link from 'next/link'
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ClockIcon,
  TruckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { getOrdersAction } from '@/app/actions/orders'
import { getCustomersAction } from '@/app/actions/customers'

/** Order status badge colours. */
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function OrdersListPage() {
  // Fetch orders and customers from database
  const [ordersResult, customersResult] = await Promise.all([
    getOrdersAction(),
    getCustomersAction(),
  ])

  const orders = ordersResult.rows
  const customers = new Map(customersResult.rows.map((c) => [c.id, c]))

  // Summary stats
  const pendingAllocation = orders.filter((o) =>
    ['created', 'confirmed'].includes(o.status)
  ).length
  const inProduction = orders.filter((o) =>
    ['fulfillment'].includes(o.status)
  ).length
  const awaitingShipment = orders.filter((o) => o.status === 'fulfillment').length
  
  // Calculate fulfillment rate
  const completedOrders = orders.filter((o) => ['shipped', 'delivered'].includes(o.status)).length
  const fulfillmentRate = orders.length > 0 ? Math.round((completedOrders / orders.length) * 100) : 0
  const ordersWithIssues = orders.filter((o) => o.status === 'needs_attention').length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders & Fulfillment</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track production orders through allocation, picking, and shipping.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
        >
          Production Dashboard
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <ClockIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending Alloc.</p>
            <p className="text-xl font-bold text-amber-600">{pendingAllocation}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <ShoppingCartIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">In Production</p>
            <p className="text-xl font-bold text-purple-600">{inProduction}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="h-10 w-10 bg-cyan-100 rounded-lg flex items-center justify-center">
            <TruckIcon className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Ready to Ship</p>
            <p className="text-xl font-bold text-cyan-600">{awaitingShipment}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Fulfillment</p>
            <p className="text-xl font-bold text-green-600">{fulfillmentRate}%</p>
          </div>
        </div>
        {ordersWithIssues > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-red-600">Issues</p>
              <p className="text-xl font-bold text-red-600">{ordersWithIssues}</p>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order #, customer..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="allocated">Allocated</option>
          <option value="picking">Picking</option>
          <option value="packed">Packed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
        </select>
        <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
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
                Order
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Customer
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Status
              </th>
              <th className="text-center px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Priority
              </th>
              <th className="text-center px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Items
              </th>
              <th className="text-center px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Allocated
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Total
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Due Date
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const customer = customers.get(order.customerId)
              const needsAttention = order.status === 'needs_attention'
              return (
                <tr
                  key={order.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer ${needsAttention ? 'bg-red-50/50' : ''}`}
                >
                  <td className="px-5 py-4">
                    <Link href={`/orders/${order.id}`} className="flex items-center gap-2">
                      <span className="font-semibold text-purple-600 hover:underline">
                        {order.ref}
                      </span>
                      {needsAttention && (
                        <ExclamationCircleIcon className="h-4 w-4 text-red-500" title="Needs attention" />
                      )}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-gray-900">{customer?.name ?? 'Unknown'}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${statusColors[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-xs text-gray-500">—</span>
                  </td>
                  <td className="px-5 py-4 text-center text-gray-600">—</td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-xs text-gray-500">—</span>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-900 font-mono font-semibold">
                    ${Number(order.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <ShoppingCartIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 mb-3">No orders found.</p>
            <Link href="/quotes" className="text-purple-600 font-semibold hover:underline">
              Create orders from quotes →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
