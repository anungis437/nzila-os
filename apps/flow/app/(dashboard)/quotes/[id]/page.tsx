import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { quoteRepo, customerRepo } from '@/lib/db'
import { getAvailableQuoteTransitions } from '@/lib/workflows/quote-state-machine'
import { approvalRepo, revisionRepo, timelineRepo } from '@/lib/repositories/workflow-repository'
import { paymentRequirementRepo, paymentStatusRepo } from '@/lib/repositories/workflow-repository'
import { findShareLinksForQuote } from '@/lib/services/share-link-service'
import type { QuoteWorkflowStatus } from '@/lib/schemas/workflow-schemas'
import { QuoteDetailActions } from './quote-detail-actions'

const statusConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
  INTERNAL_REVIEW: { color: 'bg-blue-100 text-blue-700', label: 'Internal Review' },
  SENT_TO_CLIENT: { color: 'bg-purple-100 text-purple-700', label: 'Sent to Client' },
  REVISION_REQUESTED: { color: 'bg-amber-100 text-amber-700', label: 'Revision Requested' },
  ACCEPTED: { color: 'bg-green-100 text-green-700', label: 'Accepted' },
  DEPOSIT_REQUIRED: { color: 'bg-orange-100 text-orange-700', label: 'Deposit Required' },
  READY_FOR_PO: { color: 'bg-indigo-100 text-indigo-700', label: 'Ready for PO' },
  IN_PRODUCTION: { color: 'bg-cyan-100 text-cyan-700', label: 'In Production' },
  SHIPPED: { color: 'bg-teal-100 text-teal-700', label: 'Shipped' },
  DELIVERED: { color: 'bg-emerald-100 text-emerald-700', label: 'Delivered' },
  CLOSED: { color: 'bg-gray-100 text-gray-600', label: 'Closed' },
  EXPIRED: { color: 'bg-gray-100 text-gray-500', label: 'Expired' },
  CANCELLED: { color: 'bg-gray-100 text-gray-500', label: 'Cancelled' },
  // Legacy statuses for backward compatibility
  PRICING: { color: 'bg-blue-100 text-blue-700', label: 'Pricing' },
  READY: { color: 'bg-indigo-100 text-indigo-700', label: 'Ready' },
  SENT: { color: 'bg-purple-100 text-purple-700', label: 'Sent' },
  REVIEWING: { color: 'bg-amber-100 text-amber-700', label: 'Reviewing' },
  DECLINED: { color: 'bg-red-100 text-red-700', label: 'Declined' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const quote = await quoteRepo.findById(id)
  if (!quote) notFound()

  // Resolve customer details
  const customer = quote.customerId
    ? await customerRepo.findById(quote.customerId)
    : null

  const status = (quote.status ?? 'draft').toUpperCase()
  const cfg = statusConfig[status] ?? statusConfig.DRAFT

  // Load workflow data
  const approvals = await approvalRepo.findByQuoteId(id)
  const revisions = await revisionRepo.findByQuoteId(id)
  const _shareLinks = await findShareLinksForQuote(id)
  const paymentReq = await paymentRequirementRepo.findByQuoteId(id)
  const paymentStatus = await paymentStatusRepo.findByQuoteId(id)
  const timeline = await timelineRepo.findByQuoteId(id)
  const availableTransitions = getAvailableQuoteTransitions(
    status as QuoteWorkflowStatus,
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back + header */}
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Quotes
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{quote.reference}</h1>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{quote.title}</p>
        </div>

        <QuoteDetailActions quoteId={id} status={status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client info */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Client
            </h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Company</p>
                <p className="font-medium text-gray-900">{customer?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{customer?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{customer?.phone ?? '—'}</p>
              </div>
            </div>
          </section>

          {/* Line items */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Line Items
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-2 font-medium text-gray-500">Product</th>
                  <th className="text-left px-6 py-2 font-medium text-gray-500">SKU</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500">Qty</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500">Unit Cost</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-50">
                    <td className="px-6 py-3 text-gray-900">{line.description}</td>
                    <td className="px-6 py-3 text-gray-500 font-mono text-xs">{line.sku}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{line.quantity}</td>
                    <td className="px-6 py-3 text-right text-gray-900 font-mono">{fmt(line.unitCost)}</td>
                    <td className="px-6 py-3 text-right text-gray-900 font-mono">
                      {fmt(line.quantity * line.unitCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="max-w-xs ml-auto space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-mono">{fmt(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST (5%)</span>
                  <span className="font-mono">{fmt(quote.gst)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>QST (9.975%)</span>
                  <span className="font-mono">{fmt(quote.qst)}</span>
                </div>
                <div className="border-t border-gray-300 pt-1 flex justify-between font-bold text-gray-900">
                  <span>Total</span>
                  <span className="font-mono">{fmt(quote.total)}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Details
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Tier</dt>
                <dd className="font-medium text-gray-900">{quote.tier}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Box Count</dt>
                <dd className="font-medium text-gray-900">{quote.boxCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Theme</dt>
                <dd className="font-medium text-gray-900">{quote.theme ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Valid Until</dt>
                <dd className="font-medium text-gray-900">{quote.validUntilDays} days</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(quote.createdAt).toLocaleDateString('en-CA')}
                </dd>
              </div>
            </dl>
          </section>

          {/* Status transitions */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Workflow
            </h2>
            <div className="space-y-2">
              {availableTransitions.map((t) => (
                <div
                  key={`${t.from}-${t.to}`}
                  className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-lg"
                >
                  {t.label} → <span className="font-medium">{t.to}</span>
                </div>
              ))}
              {availableTransitions.length === 0 && (
                <p className="text-sm text-gray-500">No transitions available</p>
              )}
            </div>
          </section>

          {/* Payment / Deposit info */}
          {(paymentReq || paymentStatus) && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                <CurrencyDollarIcon className="inline h-4 w-4 mr-1" />
                Payment / Deposit
              </h2>
              <dl className="space-y-2 text-sm">
                {paymentReq && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Deposit Required</dt>
                      <dd className="font-medium text-gray-900">
                        {paymentReq.depositRequired ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    {paymentReq.depositPercent != null && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Deposit %</dt>
                        <dd className="font-medium text-gray-900">{paymentReq.depositPercent}%</dd>
                      </div>
                    )}
                    {paymentReq.depositAmount != null && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Deposit Amount</dt>
                        <dd className="font-medium text-gray-900 font-mono">
                          {fmt(paymentReq.depositAmount)}
                        </dd>
                      </div>
                    )}
                  </>
                )}
                {paymentStatus && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Payment Status</dt>
                      <dd className="font-medium text-gray-900">{paymentStatus.status}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Amount Due</dt>
                      <dd className="font-medium text-gray-900 font-mono">
                        {fmt(paymentStatus.amountDue)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Amount Paid</dt>
                      <dd className="font-medium text-gray-900 font-mono">
                        {fmt(paymentStatus.amountPaid)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </section>
          )}

          {/* Recent Approvals */}
          {approvals.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Client Responses
              </h2>
              <div className="space-y-3">
                {approvals.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      {a.action === 'ACCEPT' ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <ClockIcon className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium text-gray-900">{a.action === 'ACCEPT' ? 'Accepted' : 'Revision Requested'}</span>
                    </div>
                    <p className="text-gray-600 ml-6">by {a.customerName}</p>
                    {a.message && <p className="text-gray-500 ml-6 mt-1 italic">{a.message}</p>}
                    <p className="text-xs text-gray-400 ml-6 mt-1">
                      {new Date(a.createdAt).toLocaleString('en-CA')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Open Revisions */}
          {revisions.filter((r) => r.status === 'OPEN').length > 0 && (
            <section className="bg-amber-50 rounded-xl border border-amber-200 p-6">
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3">
                Open Revision Requests
              </h2>
              <div className="space-y-3">
                {revisions.filter((r) => r.status === 'OPEN').map((r) => (
                  <div key={r.id} className="text-sm">
                    <p className="text-amber-900 font-medium">{r.requestedBy}</p>
                    <p className="text-amber-800 mt-1">{r.requestMessage}</p>
                    <p className="text-xs text-amber-600 mt-1">
                      {new Date(r.createdAt).toLocaleString('en-CA')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          {quote.notes && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Notes
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">{quote.notes}</p>
            </section>
          )}

          {/* Lifecycle Timeline */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Timeline
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-purple-400 shrink-0" />
                <div>
                  <p className="text-sm text-gray-900 font-medium">CREATED</p>
                  <p className="text-xs text-gray-500">Quote created</p>
                  <p className="text-xs text-gray-400">
                    {new Date(quote.createdAt).toLocaleString('en-CA')} · {quote.createdBy}
                  </p>
                </div>
              </div>
              {timeline.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-purple-400 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-900 font-medium">{event.event.toUpperCase()}</p>
                    <p className="text-xs text-gray-500">{event.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleString('en-CA')}
                      {event.actor ? ` · ${event.actor}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
