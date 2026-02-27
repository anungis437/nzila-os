import Link from 'next/link'
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { getInvoicesAction } from '@/app/actions/invoices'
import { getCustomersAction } from '@/app/actions/customers'

/** Invoice status badge colours. */
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-indigo-100 text-indigo-700',
  partial_paid: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  disputed: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  refunded: 'bg-gray-100 text-gray-500',
}

/** Aging bracket colours. */
const agingColors: Record<string, string> = {
  current: 'text-green-600',
  '1-30': 'text-amber-500',
  '31-60': 'text-orange-500',
  '61-90': 'text-red-500',
  '90+': 'text-red-700',
}

/** Calculate aging bracket from days overdue */
function getAgingBracket(dueDate: Date | string | null, status: string): string {
  if (!dueDate || status === 'paid' || status === 'draft') return 'current'
  const due = new Date(dueDate)
  const today = new Date()
  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function InvoicesListPage() {
  // Fetch invoices and customers from database
  const [invoicesResult, customersResult] = await Promise.all([
    getInvoicesAction(),
    getCustomersAction(),
  ])

  const invoices = invoicesResult.rows.map((inv) => ({
    ...inv,
    agingBracket: getAgingBracket(inv.dueDate, inv.status),
  }))
  const customers = new Map(customersResult.rows.map((c) => [c.id, c]))

  // Summary stats
  const totalOutstanding = invoices
    .filter((inv) => !['paid', 'refunded', 'draft'].includes(inv.status))
    .reduce((acc, inv) => acc + (Number(inv.total) - Number(inv.amountPaid)), 0)

  const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length
  const overdueAmount = invoices
    .filter((inv) => inv.status === 'overdue')
    .reduce((acc, inv) => acc + (Number(inv.total) - Number(inv.amountPaid)), 0)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const paidThisMonth = invoices
    .filter(
      (inv) =>
        inv.status === 'paid' &&
        inv.paidAt &&
        new Date(inv.paidAt).toISOString().slice(0, 7) === thisMonth
    )
    .reduce((acc, inv) => acc + Number(inv.amountPaid), 0)

  const draftCount = invoices.filter((inv) => inv.status === 'draft').length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices & Payments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage invoices, track payments, and monitor accounts receivable.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <ArrowPathIcon className="h-4 w-4" />
            Sync with Zoho
          </button>
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BanknotesIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Outstanding</p>
              <p className="text-xl font-bold text-blue-600">
                ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border p-4 ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${overdueCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <ExclamationTriangleIcon className={`h-5 w-5 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className={`text-xs ${overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>Overdue ({overdueCount})</p>
              <p className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                ${overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DocumentTextIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Paid This Month</p>
              <p className="text-xl font-bold text-green-600">
                ${paidThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Draft Invoices</p>
              <p className="text-xl font-bold text-gray-600">{draftCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="bg-linear-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-purple-700 font-medium mb-2">Accounts Receivable Aging</p>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-gray-500">Current</span>
                <p className={`text-lg font-bold ${agingColors.current}`}>
                  ${invoices.filter(i => i.agingBracket === 'current' && i.status !== 'paid').reduce((a, i) => a + (Number(i.total) - Number(i.amountPaid)), 0).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">1-30 Days</span>
                <p className={`text-lg font-bold ${agingColors['1-30']}`}>
                  ${invoices.filter(i => i.agingBracket === '1-30').reduce((a, i) => a + (Number(i.total) - Number(i.amountPaid)), 0).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">31-60 Days</span>
                <p className={`text-lg font-bold ${agingColors['31-60']}`}>
                  ${invoices.filter(i => i.agingBracket === '31-60').reduce((a, i) => a + (Number(i.total) - Number(i.amountPaid)), 0).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">61-90 Days</span>
                <p className={`text-lg font-bold ${agingColors['61-90']}`}>
                  ${invoices.filter(i => i.agingBracket === '61-90').reduce((a, i) => a + (Number(i.total) - Number(i.amountPaid)), 0).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">90+ Days</span>
                <p className={`text-lg font-bold ${agingColors['90+']}`}>
                  ${invoices.filter(i => i.agingBracket === '90+').reduce((a, i) => a + (Number(i.total) - Number(i.amountPaid)), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/invoices/reports"
            className="text-sm text-purple-600 font-medium hover:underline"
          >
            View Full Report →
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice #, customer..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="partial">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
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
                Invoice
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Customer
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Status
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Amount
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Paid
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Balance
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Due Date
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const customer = customers.get(inv.customerId)
              const balance = Number(inv.total) - Number(inv.amountPaid)
              const isOverdue = inv.status === 'overdue'
              return (
                <tr
                  key={inv.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer ${isOverdue ? 'bg-red-50/50' : ''}`}
                >
                  <td className="px-5 py-4">
                    <Link href={`/invoices/${inv.id}`} className="flex items-center gap-2">
                      <span className="font-semibold text-purple-600 hover:underline">
                        {inv.ref}
                      </span>
                      {isOverdue && (
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500" title="Overdue" />
                      )}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-gray-900">{customer?.name ?? 'Unknown'}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${statusColors[inv.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {inv.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-900 font-mono">
                    ${Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 text-right text-green-600 font-mono">
                    {Number(inv.amountPaid) > 0
                      ? `$${Number(inv.amountPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-mono font-semibold ${balance > 0 ? agingColors[inv.agingBracket] ?? 'text-gray-600' : 'text-gray-400'}`}
                  >
                    {balance > 0
                      ? `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className={`px-5 py-4 text-right ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {invoices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <DocumentTextIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 mb-3">No invoices found.</p>
            <Link href="/invoices/new" className="text-purple-600 font-semibold hover:underline">
              Create your first invoice →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
