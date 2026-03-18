import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { getCustomersAction } from '@/app/actions/customers'
import { getOrdersAction } from '@/app/actions/orders'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function relativeDate(d: string | Date) {
  const date = new Date(d)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

const statusBadge: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-500',
  prospect: 'bg-blue-50 text-blue-600',
}

export default async function ClientsPage() {
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  let clients: Awaited<ReturnType<typeof getCustomersAction>>['rows'] = []
  let orders: Awaited<ReturnType<typeof getOrdersAction>>['rows'] = []
  try {
    const [customersResult, ordersResult] = await Promise.all([
      getCustomersAction(),
      getOrdersAction(),
    ])
    clients = customersResult.rows
    orders = ordersResult.rows
  } catch { /* DB not seeded */ }

  // Build per-client stats
  const ordersByClient = new Map<string, number>()
  const revenueByClient = new Map<string, number>()
  for (const o of orders) {
    ordersByClient.set(o.customerId, (ordersByClient.get(o.customerId) ?? 0) + 1)
    revenueByClient.set(o.customerId, (revenueByClient.get(o.customerId) ?? 0) + Number(o.total))
  }

  const total = clients.length
  const active = clients.filter((c) => ((c.metadata as Record<string, string> | null)?.status ?? 'active') === 'active').length
  const withOrders = clients.filter((c) => ordersByClient.has(c.id)).length
  const totalRevenue = Array.from(revenueByClient.values()).reduce((s, v) => s + v, 0)

  const kpis = [
    { label: 'Total Clients', value: total.toString(), icon: UserGroupIcon, accent: 'text-electric' },
    { label: 'Active', value: active.toString(), icon: BuildingOffice2Icon, accent: 'text-emerald-600' },
    { label: 'With Orders', value: withOrders.toString(), icon: DocumentTextIcon, accent: 'text-violet-600' },
    { label: 'Total Revenue', value: fmt(totalRevenue), icon: CurrencyDollarIcon, accent: 'text-amber-600' },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your client directory, track orders, and view revenue.
          </p>
        </div>
        <Link
          href={`${base}/clients/new`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition-colors shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      {/* KPI Cards */}
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, company..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric transition"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['All', 'Active', 'With Orders'] as const).map((tab) => (
            <span
              key={tab}
              className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                tab === 'All'
                  ? 'bg-navy text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
              {tab === 'All' && <span className="ml-1.5 text-white/70">{total}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      {clients.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Client</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Contact</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Orders</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Revenue</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((c) => {
                const st = ((c.metadata as Record<string, string> | null)?.status ?? 'active').toLowerCase()
                return (
                  <tr key={c.id} className="group hover:bg-electric/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        href={`${base}/clients/${c.id}`}
                        className="font-semibold text-electric hover:text-electric-light transition-colors"
                      >
                        {c.name}
                      </Link>
                      {c.company && <p className="text-xs text-gray-400 mt-0.5">{c.company}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm">
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <EnvelopeIcon className="h-3.5 w-3.5 text-gray-400" />
                            {c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                            <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />
                            {c.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[st] ?? statusBadge.active}`}>
                        {st}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-navy tabular-nums">
                      {ordersByClient.get(c.id) ?? 0}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-navy tabular-nums">
                      {fmt(revenueByClient.get(c.id) ?? 0)}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-500 text-xs">
                      {relativeDate(c.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="rounded-2xl bg-electric/5 p-5 mb-5">
            <UserGroupIcon className="h-10 w-10 text-electric" />
          </div>
          <h2 className="text-lg font-semibold text-navy mb-1">No clients yet</h2>
          <p className="text-sm text-gray-500 max-w-md mb-6">
            Add your first client to start building proposals and tracking orders.
          </p>
          <Link
            href={`${base}/clients/new`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Add First Client
          </Link>
        </div>
      )}
    </div>
  )
}
