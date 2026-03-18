import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import {
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { getCustomerAction } from '@/app/actions/customers'
import { getOrdersAction } from '@/app/actions/orders'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  const customer = await getCustomerAction(id)
  if (!customer) notFound()

  // Get client orders
  let orders: Awaited<ReturnType<typeof getOrdersAction>>['rows'] = []
  try {
    const result = await getOrdersAction({ customerId: id })
    orders = result.rows
  } catch { /* skip */ }

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0)
  const address = customer.address as Record<string, string> | null

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Link
        href={`${base}/clients`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{customer.name}</h1>
          {customer.company && (
            <p className="text-sm text-gray-500 mt-0.5">{customer.company}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${base}/quotes/new?client=${id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            New Quote
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Card */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-lg bg-electric/5 p-1.5">
                <UserIcon className="h-4 w-4 text-electric" />
              </div>
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Contact</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                <span className="text-navy">{customer.email ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneIcon className="h-4 w-4 text-gray-400" />
                <span className="text-navy">{customer.phone ?? '—'}</span>
              </div>
            </div>
            {address && (
              <div className="flex items-start gap-2 mt-4 text-sm">
                <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                <span className="text-navy">
                  {[address.street, address.city, address.province, address.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </section>

          {/* Orders */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className="rounded-lg bg-electric/5 p-1.5">
                <ShoppingCartIcon className="h-4 w-4 text-electric" />
              </div>
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Orders</h2>
              <span className="text-xs text-gray-400 ml-auto">
                {orders.length} order{orders.length !== 1 ? 's' : ''}
              </span>
            </div>
            {orders.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/40">
                    <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Reference</th>
                    <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Total</th>
                    <th className="text-right px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-electric/[0.02] transition-colors">
                      <td className="px-6 py-3.5">
                        <Link href={`${base}/orders/${o.id}`} className="font-semibold text-electric hover:text-electric-light transition-colors">
                          {o.ref}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 capitalize">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-navy tabular-nums">
                        {fmt(Number(o.total))}
                      </td>
                      <td className="px-6 py-3.5 text-right text-gray-500 text-xs">
                        {new Date(o.createdAt).toLocaleDateString('en-CA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400">No orders yet for this client</p>
              </div>
            )}
          </section>
        </div>

        {/* Right sidebar 1/3 */}
        <div className="space-y-6">
          {/* Stats */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4">Summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 capitalize">
                    {(customer.metadata as Record<string, string> | null)?.status ?? 'active'}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Orders</dt>
                <dd className="font-medium text-navy">{orders.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Revenue</dt>
                <dd className="font-medium text-navy font-mono tabular-nums">{fmt(totalRevenue)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Client Since</dt>
                <dd className="font-medium text-navy">
                  {new Date(customer.createdAt).toLocaleDateString('en-CA')}
                </dd>
              </div>
            </dl>
          </section>

          {/* Notes */}
          {customer.notes && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Notes</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{customer.notes}</p>
            </section>
          )}

          {/* Quick Actions */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4">Actions</h2>
            <div className="space-y-2">
              <Link
                href={`${base}/quotes/new?client=${id}`}
                className="flex items-center gap-2 px-3 py-2.5 bg-electric/5 text-electric text-sm font-medium rounded-lg hover:bg-electric/10 transition-colors w-full"
              >
                <CurrencyDollarIcon className="h-4 w-4" />
                Create Quote
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
