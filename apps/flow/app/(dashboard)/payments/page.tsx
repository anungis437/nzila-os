import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
  CurrencyDollarIcon,
  BanknotesIcon,
  CreditCardIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { getPaymentsAction } from '@/app/actions/payments'
import { getInvoicesAction } from '@/app/actions/invoices'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

const methodIcons: Record<string, typeof BanknotesIcon> = {
  bank_transfer: BanknotesIcon,
  credit_card: CreditCardIcon,
  cash: CurrencyDollarIcon,
  cheque: BanknotesIcon,
  other: ArrowPathIcon,
}

const methodLabels: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  credit_card: 'Credit Card',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
  eft: 'EFT',
  wire: 'Wire',
}

export default async function PaymentsPage() {
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  const [paymentsResult, invoicesResult] = await Promise.all([
    getPaymentsAction({ limit: 100 }),
    getInvoicesAction({ limit: 1000 }),
  ])

  const payments = paymentsResult.rows
  const invoicesData = invoicesResult.rows ?? []

  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0)
  const outstanding = invoicesData
    .filter((inv) => ['issued', 'sent', 'overdue', 'partial_paid'].includes(inv.status))
    .reduce((s: number, inv) => s + Number(inv.amountDue ?? 0), 0)
  const overdueCount = invoicesData.filter((inv) => inv.status === 'overdue').length

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Payment history and collection tracking.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="bg-emerald-50 rounded-lg p-2">
              <CurrencyDollarIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Total Collected</span>
          </div>
          <p className="text-2xl font-bold text-navy">{fmt(totalCollected)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="bg-amber-50 rounded-lg p-2">
              <BanknotesIcon className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-navy">{fmt(outstanding)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Across open invoices</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`rounded-lg p-2 ${overdueCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <ArrowPathIcon className={`h-4 w-4 ${overdueCount > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </div>
            <span className="text-xs font-medium text-gray-500">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-navy">{overdueCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">{overdueCount === 0 ? 'All payments on time' : 'Need follow-up'}</p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-navy">Payment History</h2>
        </div>
        {payments.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((p) => {
                const Icon = methodIcons[p.method] ?? CurrencyDollarIcon
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 text-gray-600">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-CA') : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <Link href={`${base}/invoices/${p.invoiceId}`} className="font-semibold text-electric hover:text-electric-light transition-colors">
                        {p.invoiceRef}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{p.customerName ?? '—'}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <Icon className="h-3.5 w-3.5" />
                        {methodLabels[p.method] ?? p.method}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-500">{p.reference ?? '—'}</td>
                    <td className="px-6 py-3 text-right font-mono font-semibold text-gray-900 tabular-nums">
                      {fmt(Number(p.amount))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <CurrencyDollarIcon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No payments recorded yet.</p>
            <p className="text-xs text-gray-400 mt-1">Payments are recorded against invoices.</p>
          </div>
        )}
      </div>
    </div>
  )
}
