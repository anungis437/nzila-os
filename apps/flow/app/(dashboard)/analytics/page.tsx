import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { getOrdersAction } from '@/app/actions/orders'
import { getCustomersAction } from '@/app/actions/customers'
import { getInvoicesAction } from '@/app/actions/invoices'

export const metadata = { title: 'Analytics — Flow' }

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function AnalyticsPage() {
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  type OrderRow = Awaited<ReturnType<typeof getOrdersAction>>['rows'][number]
  type CustomerRow = Awaited<ReturnType<typeof getCustomersAction>>['rows'][number]
  type InvoiceRow = Awaited<ReturnType<typeof getInvoicesAction>>['rows'][number]

  let orders: OrderRow[] = []
  let customers: CustomerRow[] = []
  let invoices: InvoiceRow[] = []

  try {
    const [ordersRes, customersRes, invoicesRes] = await Promise.all([
      getOrdersAction({ limit: 1000 }),
      getCustomersAction({ limit: 1000 }),
      getInvoicesAction({ limit: 1000 }),
    ])
    orders = ordersRes.rows ?? []
    customers = customersRes.rows ?? []
    invoices = invoicesRes.rows ?? []
  } catch {
    // DB not available
  }

  // ── KPI calculations ────────────────────────────────────────────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const ordersThisMonth = orders.filter(
    (o) => o.createdAt && new Date(o.createdAt) >= monthStart,
  )
  const revenueMTD = ordersThisMonth.reduce(
    (s: number, o) => s + Number(o.total ?? 0),
    0,
  )
  const totalRevenue = orders.reduce(
    (s: number, o) => s + Number(o.total ?? 0),
    0,
  )
  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const totalCollected = paidInvoices.reduce(
    (s: number, i) => s + Number(i.total ?? 0),
    0,
  )

  const avgOrderValue =
    orders.length > 0 ? totalRevenue / orders.length : 0

  const kpis = [
    { label: 'Revenue (MTD)', value: fmt(revenueMTD), icon: CurrencyDollarIcon, accent: 'text-emerald-600' },
    { label: 'Total Orders', value: orders.length.toString(), icon: ShoppingCartIcon, accent: 'text-electric' },
    { label: 'Active Clients', value: customers.length.toString(), icon: UserGroupIcon, accent: 'text-violet-600' },
    { label: 'Avg. Order Value', value: fmt(avgOrderValue), icon: ArrowTrendingUpIcon, accent: 'text-amber-600' },
  ]

  // ── Order status pipeline ───────────────────────────────────────
  const statusCounts = new Map<string, { count: number; value: number }>()
  for (const o of orders) {
    const s = (o.status ?? 'unknown').toLowerCase()
    const entry = statusCounts.get(s) ?? { count: 0, value: 0 }
    entry.count++
    entry.value += Number(o.total ?? 0)
    statusCounts.set(s, entry)
  }
  const pipelineStages = [
    { stage: 'Draft', key: 'draft', color: 'bg-gray-200' },
    { stage: 'Confirmed', key: 'confirmed', color: 'bg-blue-200' },
    { stage: 'In Production', key: 'in_production', color: 'bg-electric/20' },
    { stage: 'Shipped', key: 'shipped', color: 'bg-violet-200' },
    { stage: 'Delivered', key: 'delivered', color: 'bg-emerald-200' },
    { stage: 'Cancelled', key: 'cancelled', color: 'bg-red-200' },
  ].map((s) => ({
    ...s,
    count: statusCounts.get(s.key)?.count ?? 0,
    value: fmt(statusCounts.get(s.key)?.value ?? 0),
  }))

  // ── Top clients by revenue ──────────────────────────────────────
  const clientRevenue = new Map<string, { name: string; orders: number; revenue: number }>()
  for (const o of orders) {
    const cid = o.customerId ?? 'unknown'
    const entry = clientRevenue.get(cid) ?? { name: '', orders: 0, revenue: 0 }
    entry.orders++
    entry.revenue += Number(o.total ?? 0)
    clientRevenue.set(cid, entry)
  }
  // Resolve names
  const customerMap = new Map(customers.map((c) => [c.id, c.name ?? c.company ?? 'Unknown']))
  const topClients = [...clientRevenue.entries()]
    .map(([id, data]) => ({
      name: customerMap.get(id) ?? id.slice(0, 8),
      orders: data.orders,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // ── Monthly trend (last 6 months) ──────────────────────────────
  const months: { month: string; orders: number; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('en-CA', { month: 'short' })
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const monthOrders = orders.filter(
      (o) => o.createdAt && new Date(o.createdAt) >= d && new Date(o.createdAt) < nextMonth,
    )
    months.push({
      month: label,
      orders: monthOrders.length,
      revenue: monthOrders.reduce((s: number, o) => s + Number(o.total ?? 0), 0),
    })
  }
  const maxMonthOrders = Math.max(...months.map((m) => m.orders), 1)

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sales performance, revenue trends, and client insights.
          </p>
        </div>
        <Link
          href={`${base}/analytics/profitability`}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-electric text-electric text-sm font-semibold rounded-lg hover:bg-electric/5 transition-colors"
        >
          <ChartBarIcon className="h-4 w-4" />
          Profitability Report
        </Link>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:shadow-sm transition-shadow"
          >
            <div className="rounded-lg bg-gray-50 p-2.5">
              <k.icon className={`h-5 w-5 ${k.accent}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Pipeline ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Order Pipeline
          </h2>
          <div className="space-y-3">
            {pipelineStages.map((stage) => {
              const maxCount = Math.max(...pipelineStages.map((s) => s.count), 1)
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24">{stage.stage}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-full flex items-center px-2 text-xs font-semibold text-gray-700 transition-all`}
                      style={{ width: stage.count > 0 ? `${Math.max(15, (stage.count / maxCount) * 100)}%` : '0%' }}
                    >
                      {stage.count > 0 ? stage.count : ''}
                    </div>
                  </div>
                  <span className="text-sm font-mono text-gray-500 w-20 text-right tabular-nums">
                    {stage.value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Top Clients ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Top Clients
          </h2>
          {topClients.length > 0 ? (
            <div className="space-y-3">
              {topClients.map((client, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-navy">{client.name}</p>
                    <p className="text-xs text-gray-500">{client.orders} orders</p>
                  </div>
                  <span className="text-sm font-mono text-navy tabular-nums">{fmt(client.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No client data yet</p>
          )}
        </div>
      </div>

      {/* ── Monthly Trend ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Monthly Trend
        </h2>
        <div className="grid grid-cols-6 gap-3">
          {months.map((m) => (
            <div key={m.month} className="text-center">
              <div className="bg-gray-50 rounded-lg h-32 flex items-end justify-center pb-2 mb-2">
                <div
                  className="bg-electric/60 rounded w-8 transition-all"
                  style={{
                    height: m.orders > 0 ? `${Math.max(10, (m.orders / maxMonthOrders) * 90)}%` : '4px',
                  }}
                />
              </div>
              <p className="text-xs font-semibold text-navy">{m.month}</p>
              <p className="text-xs text-gray-400">{m.orders} orders</p>
              <p className="text-xs text-gray-400 font-mono tabular-nums">
                {fmt(m.revenue)}
              </p>
            </div>
          ))}
        </div>
        {orders.length === 0 && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            Data will populate as orders are created and completed.
          </p>
        )}
      </div>

      {/* ── Collection Summary ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-navy">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Collected (Paid Invoices)</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Outstanding</p>
          <p className="text-xl font-bold text-amber-600">{fmt(totalRevenue - totalCollected)}</p>
        </div>
      </div>
    </div>
  )
}
