import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeftIcon,
  PencilIcon,
  ArrowPathIcon,
  PrinterIcon,
  EnvelopeIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'
import { getInvoiceAction, getInvoiceLinesAction } from '@/app/actions/invoices'
import { getCustomerAction } from '@/app/actions/customers'
import { getOrderAction } from '@/app/actions/orders'

/** Invoice status badge colours. */
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-indigo-100 text-indigo-700',
  partially_paid: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  void: 'bg-gray-100 text-gray-400',
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoiceAction(params.id)
  if (!invoice) {
    notFound()
  }

  // Fetch related data
  const [lines, customer, order] = await Promise.all([
    getInvoiceLinesAction(params.id),
    getCustomerAction(invoice.customerId),
    invoice.orderId ? getOrderAction(invoice.orderId) : Promise.resolve(null),
  ])

  // Parse numeric fields
  const subtotal = parseFloat(invoice.subtotal)
  const taxTotal = parseFloat(invoice.taxTotal)
  const total = parseFloat(invoice.total)
  const amountPaid = parseFloat(invoice.amountPaid)
  const amountDue = parseFloat(invoice.amountDue)

  // Calculate status
  const isOverdue = invoice.status === 'overdue' || (
    invoice.dueDate && 
    new Date(invoice.dueDate) < new Date() && 
    amountDue > 0 &&
    invoice.status !== 'paid'
  )
  const canRecordPayment = ['issued', 'sent', 'viewed', 'partially_paid', 'overdue'].includes(invoice.status)
  const canEdit = invoice.status === 'draft'

  const paidPercentage = total > 0 
    ? Math.round((amountPaid / total) * 100) 
    : 0

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Invoices
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.ref}</h1>
            <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${statusColors[invoice.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {invoice.status.replace(/_/g, ' ')}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                Overdue
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Customer: <Link href={`/clients/${invoice.customerId}`} className="text-purple-600 hover:underline">{customer?.name ?? 'Unknown'}</Link>
            {order && (
              <> · Order: <Link href={`/orders/${invoice.orderId}`} className="text-purple-600 hover:underline">{order.ref}</Link></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <PrinterIcon className="h-4 w-4" />
            Print
          </button>
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <EnvelopeIcon className="h-4 w-4" />
            Send
          </button>
          {canEdit && (
            <Link
              href={`/invoices/${params.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </Link>
          )}
          {canRecordPayment && (
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition shadow-sm">
              <CurrencyDollarIcon className="h-4 w-4" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Overdue Warning */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-700">Payment Overdue</p>
            <p className="text-sm text-red-600">
              This invoice was due on {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}. Outstanding balance: ${amountDue.toFixed(2)}
            </p>
          </div>
          <button className="px-4 py-2 bg-white text-red-700 text-sm font-semibold rounded-lg border border-red-200 hover:bg-red-50 transition">
            Send Reminder
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Invoice Preview Card */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Invoice Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-bold text-purple-600">Shop Quoter</h2>
                  <p className="text-xs text-gray-500 mt-1">NzilaOS Commerce</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">INVOICE</p>
                  <p className="text-lg font-bold text-gray-900">{invoice.ref}</p>
                </div>
              </div>
            </div>

            {/* Bill To / Invoice Info */}
            <div className="p-6 grid grid-cols-2 gap-6 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Bill To</p>
                <p className="font-semibold text-gray-900">{customer?.name ?? 'Unknown'}</p>
                <p className="text-sm text-gray-600">{customer?.email ?? '—'}</p>
              </div>
              <div className="text-right">
                <div className="space-y-1">
                  <p className="text-sm"><span className="text-gray-500">Issue Date:</span> <span className="font-medium">{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '—'}</span></p>
                  <p className="text-sm"><span className="text-gray-500">Due Date:</span> <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</span></p>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Unit Price</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const lineUnitPrice = parseFloat(line.unitPrice)
                  const lineTotal = parseFloat(line.lineTotal)
                  return (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-6 py-4 text-gray-900">{line.description}</td>
                      <td className="px-4 py-4 text-center font-mono">{line.quantity}</td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">${lineUnitPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-mono font-semibold">${lineTotal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-600">Subtotal</td>
                  <td className="px-6 py-3 text-right font-mono">${subtotal.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-600">Tax</td>
                  <td className="px-6 py-3 text-right font-mono">${taxTotal.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-lg">${total.toFixed(2)}</td>
                </tr>
                {amountPaid > 0 && (
                  <>
                    <tr className="bg-green-50">
                      <td colSpan={3} className="px-6 py-3 text-right text-sm text-green-600">Paid</td>
                      <td className="px-6 py-3 text-right font-mono text-green-600">-${amountPaid.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Balance Due</td>
                      <td className={`px-6 py-3 text-right font-mono font-bold text-lg ${amountDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ${amountDue.toFixed(2)}
                      </td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>

            {/* Notes */}
            {invoice.notes && (
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Payment History section removed - would need payments table */}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Payment Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Paid</span>
                  <span className="font-medium text-gray-900">{paidPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${paidPercentage === 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${paidPercentage}%` }}
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium text-gray-900">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paid</span>
                  <span className="font-medium text-green-600">${amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                  <span className="font-medium text-gray-700">Balance</span>
                  <span className={`font-bold ${amountDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${amountDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                <div className="text-sm">
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 text-gray-900">{new Date(invoice.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {invoice.issuedAt && (
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="h-4 w-4 text-blue-500 shrink-0" />
                  <div className="text-sm">
                    <span className="text-gray-500">Issued:</span>
                    <span className="ml-2 text-gray-900">{new Date(invoice.issuedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
              {invoice.dueDate && (
                <div className="flex items-center gap-3">
                  <ClockIcon className={`h-4 w-4 shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
                  <div className="text-sm">
                    <span className="text-gray-500">Due:</span>
                    <span className={`ml-2 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>{new Date(invoice.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="text-sm">
                    <span className="text-gray-500">Paid:</span>
                    <span className="ml-2 text-gray-900">{new Date(invoice.paidAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Zoho Integration */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Zoho Books</h3>
            <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100 transition">
              <ArrowPathIcon className="h-4 w-4" />
              Sync to Zoho
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Actions</h3>
            <div className="space-y-2">
              <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <DocumentDuplicateIcon className="h-4 w-4" />
                Duplicate Invoice
              </button>
              {invoice.orderId && (
                <Link
                  href={`/orders/${invoice.orderId}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                >
                  View Related Order
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
