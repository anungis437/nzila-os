import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import {
  ArrowLeftIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserIcon,
  CubeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { quoteRepo, customerRepo } from '@/lib/db'
import { analyzeQuoteProfitabilityAction } from '@/app/actions/profitability'
import { getAvailableQuoteTransitions } from '@/lib/workflows/quote-state-machine'
import { approvalRepo, revisionRepo, timelineRepo } from '@/lib/repositories/workflow-repository'
import { paymentRequirementRepo, paymentStatusRepo } from '@/lib/repositories/workflow-repository'
import { findShareLinksForQuote } from '@/lib/services/share-link-service'
import { predictConversion } from '@/lib/ai-actions'
import type { QuoteWorkflowStatus } from '@/lib/schemas/workflow-schemas'
import { QuoteDetailActions } from './quote-detail-actions'
import { StatusBadge, LifecycleTimeline, SystemGuidance, ProgressStepper } from '../../../(dashboard)/components'
import type { Step, TimelineEvent } from '../../../(dashboard)/components'

// Lifecycle phases for progress bar
const QUOTE_STEPS: Step[] = [
  { key: 'DRAFT', label: 'Draft', icon: DocumentTextIcon },
  { key: 'REVIEW', label: 'Review', icon: ClockIcon },
  { key: 'CLIENT', label: 'Client', icon: UserIcon },
  { key: 'ACCEPTED', label: 'Accepted', icon: CheckCircleIcon },
  { key: 'PAYMENT', label: 'Payment', icon: CurrencyDollarIcon },
  { key: 'PRODUCTION', label: 'Production', icon: CubeIcon },
  { key: 'DELIVERY', label: 'Delivery' },
  { key: 'CLOSED', label: 'Closed' },
]

function phaseIndex(status: string): number {
  const map: Record<string, number> = {
    DRAFT: 0,
    INTERNAL_REVIEW: 1,
    SENT_TO_CLIENT: 2,
    REVISION_REQUESTED: 2,
    ACCEPTED: 3,
    DEPOSIT_REQUIRED: 4,
    READY_FOR_PO: 4,
    IN_PRODUCTION: 5,
    SHIPPED: 6,
    DELIVERED: 6,
    CLOSED: 7,
  }
  return map[status] ?? 0
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  const quote = await quoteRepo.findById(id)
  if (!quote) notFound()

  const customer = quote.customerId
    ? await customerRepo.findById(quote.customerId)
    : null

  const status = (quote.status ?? 'draft').toUpperCase()
  const currentPhase = phaseIndex(status)

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

  // AI conversion prediction
  let conversionPrediction: Awaited<ReturnType<typeof predictConversion>> = null
  try {
    conversionPrediction = await predictConversion(id)
  } catch { /* AI service unavailable — skip */ }

  // Profitability analysis
  let profitabilityData: Awaited<ReturnType<typeof analyzeQuoteProfitabilityAction>>['profitability'] | null = null
  try {
    const profResult = await analyzeQuoteProfitabilityAction(id)
    if (profResult.ok && profResult.profitability) {
      profitabilityData = profResult.profitability
    }
  } catch { /* skip if unavailable */ }

  // Build timeline events for shared component
  const quoteTimeline: TimelineEvent[] = [
    { label: 'Created', description: 'Quote created', timestamp: quote.createdAt, actor: quote.createdBy ?? undefined },
    ...timeline.map((e) => ({
      label: e.event.replace(/_/g, ' '),
      description: e.description,
      timestamp: e.timestamp,
      actor: e.actor ?? undefined,
    })),
  ]

  // Status-specific guidance
  const guidanceMap: Record<string, { severity: 'info' | 'success' | 'warning' | 'error' | 'tip'; message: string }> = {
    DRAFT:              { severity: 'info',    message: 'This quote is in draft — complete the details and submit for internal review.' },
    INTERNAL_REVIEW:    { severity: 'info',    message: 'Awaiting internal review. Once approved, it can be sent to the client.' },
    SENT_TO_CLIENT:     { severity: 'tip',     message: 'Quote sent to client — waiting for their response.' },
    REVISION_REQUESTED: { severity: 'warning', message: 'The client has requested changes — review their feedback and update the quote.' },
    ACCEPTED:           { severity: 'success', message: 'Client accepted! Set up payment requirements or proceed to production.' },
    DEPOSIT_REQUIRED:   { severity: 'warning', message: 'Deposit required before production can begin.' },
    READY_FOR_PO:       { severity: 'info',    message: 'Ready for purchase order — create POs for the required materials.' },
    IN_PRODUCTION:      { severity: 'info',    message: 'Production is underway.' },
    SHIPPED:            { severity: 'info',    message: 'Order has been shipped — awaiting delivery confirmation.' },
    DELIVERED:          { severity: 'success', message: 'Delivered to client. Review and close when ready.' },
    CLOSED:             { severity: 'info',    message: 'This quote is closed.' },
    EXPIRED:            { severity: 'warning', message: 'This quote has expired. Create a new version if the client is still interested.' },
    CANCELLED:          { severity: 'error',   message: 'This quote was cancelled.' },
  }
  const guidance = guidanceMap[status]

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href={`${base}/quotes`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Quotes
      </Link>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy">{quote.reference}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{quote.title}</p>
        </div>
        <QuoteDetailActions quoteId={id} status={status} basePath={base} />
      </div>

      {/* ── Lifecycle Progress ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <ProgressStepper steps={QUOTE_STEPS} currentIndex={currentPhase} />
      </div>

      {/* ── Guidance ───────────────────────────────────────────────── */}
      {guidance && (
        <SystemGuidance severity={guidance.severity}>{guidance.message}</SystemGuidance>
      )}

      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client info */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-lg bg-electric/5 p-1.5">
                <UserIcon className="h-4 w-4 text-electric" />
              </div>
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Client</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Company</p>
                <p className="font-medium text-navy">{customer?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Email</p>
                <p className="font-medium text-navy">{customer?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                <p className="font-medium text-navy">{customer?.phone ?? '—'}</p>
              </div>
            </div>
          </section>

          {/* Line items */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className="rounded-lg bg-electric/5 p-1.5">
                <CubeIcon className="h-4 w-4 text-electric" />
              </div>
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Line Items</h2>
              <span className="text-xs text-gray-400 ml-auto">{quote.lines.length} item{quote.lines.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/40">
                  <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                  <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">SKU</th>
                  <th className="text-right px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                  <th className="text-right px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit Cost</th>
                  <th className="text-right px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quote.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-electric/[0.02] transition-colors">
                    <td className="px-6 py-3.5 text-navy font-medium">{line.description}</td>
                    <td className="px-6 py-3.5 text-gray-500 font-mono text-xs">{line.sku}</td>
                    <td className="px-6 py-3.5 text-right text-navy tabular-nums">{line.quantity}</td>
                    <td className="px-6 py-3.5 text-right text-navy font-mono tabular-nums">{fmt(line.unitCost)}</td>
                    <td className="px-6 py-3.5 text-right text-navy font-mono tabular-nums font-medium">
                      {fmt(line.quantity * line.unitCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="px-6 py-5 bg-gray-50/60 border-t border-gray-100">
              <div className="max-w-xs ml-auto space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{fmt(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST (5%)</span>
                  <span className="font-mono tabular-nums">{fmt(quote.gst)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>QST (9.975%)</span>
                  <span className="font-mono tabular-nums">{fmt(quote.qst)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between text-base font-bold text-navy">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{fmt(quote.total)}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right sidebar (1/3) ────────────────────────────────── */}
        <div className="space-y-6">
          {/* Details */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4">Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Tier</dt>
                <dd className="font-medium text-navy">{quote.tier}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Box Count</dt>
                <dd className="font-medium text-navy">{quote.boxCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Theme</dt>
                <dd className="font-medium text-navy">{quote.theme ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Valid Until</dt>
                <dd className="font-medium text-navy">{quote.validUntilDays} days</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-navy">
                  {new Date(quote.createdAt).toLocaleDateString('en-CA')}
                </dd>
              </div>
            </dl>
          </section>

          {/* Profitability Analysis */}
          {profitabilityData && (
            <section className={`rounded-xl border p-6 ${
              profitabilityData.overallStatus === 'loss'
                ? 'bg-red-50 border-red-200'
                : profitabilityData.overallStatus === 'critical'
                  ? 'bg-orange-50 border-orange-200'
                  : profitabilityData.overallStatus === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`rounded-lg p-1.5 ${
                  profitabilityData.overallStatus === 'healthy' ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  <CurrencyDollarIcon className={`h-4 w-4 ${
                    profitabilityData.overallStatus === 'healthy' ? 'text-emerald-600' : 'text-amber-600'
                  }`} />
                </div>
                <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Profitability</h2>
              </div>

              <div className="text-center mb-4">
                <span className={`text-3xl font-bold ${
                  profitabilityData.overallStatus === 'healthy' ? 'text-emerald-600'
                    : profitabilityData.overallStatus === 'warning' ? 'text-amber-600'
                    : 'text-red-600'
                }`}>
                  {profitabilityData.totalMarginPercent.toFixed(1)}%
                </span>
                <p className="text-xs text-gray-600 mt-0.5">Margin · {fmt(profitabilityData.totalMarginDollars)}</p>
              </div>

              <dl className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Revenue</dt>
                  <dd className="font-mono font-medium text-gray-800">{fmt(profitabilityData.totalRevenue)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Cost</dt>
                  <dd className="font-mono font-medium text-gray-800">{fmt(profitabilityData.totalCost)}</dd>
                </div>
              </dl>

              {/* Alerts */}
              {profitabilityData.alerts.length > 0 && (
                <div className="space-y-2">
                  {profitabilityData.alerts.map((alert, idx) => (
                    <div key={idx} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Workflow transitions */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4">Workflow</h2>
            {availableTransitions.length > 0 ? (
              <div className="space-y-2">
                {availableTransitions.map((t) => (
                    <div
                      key={`${t.from}-${t.to}`}
                      className="flex items-center gap-2 text-sm px-3 py-2.5 bg-gray-50 rounded-lg"
                    >
                      <span className="text-gray-600 flex-1">{t.label}</span>
                      <StatusBadge status={t.to} />
                    </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No transitions available</p>
            )}
          </section>

          {/* AI Conversion Prediction */}
          {conversionPrediction && (
            <section className="bg-gradient-to-br from-electric/[0.03] to-violet-50/30 rounded-xl border border-electric/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-lg bg-electric/10 p-1.5">
                  <ArrowTrendingUpIcon className="h-4 w-4 text-electric" />
                </div>
                <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">AI Conversion Score</h2>
              </div>
              <div className="text-center mb-4">
                <span className={`text-3xl font-bold ${
                  conversionPrediction.probability >= 0.7
                    ? 'text-emerald-600'
                    : conversionPrediction.probability >= 0.4
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}>
                  {Math.round(conversionPrediction.probability * 100)}%
                </span>
                <p className="text-xs text-gray-500 mt-0.5">Likelihood to convert</p>
              </div>
              {/* Factor bars */}
              <div className="space-y-2 mb-4">
                {conversionPrediction.factors.slice(0, 4).map((f) => (
                  <div key={f.name} className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      f.impact === 'positive' ? 'bg-emerald-500' : 'bg-red-400'
                    }`} />
                    <span className="text-gray-600 flex-1 truncate">{f.name}</span>
                    <span className="text-gray-400 font-mono">{(f.weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              {/* Recommendation */}
              <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-gray-600 leading-relaxed">
                <span className="font-medium text-navy">Recommendation:</span>{' '}
                {conversionPrediction.recommendation}
              </div>
            </section>
          )}

          {/* Payment / Deposit */}
          {(paymentReq || paymentStatus) && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CurrencyDollarIcon className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Payment</h2>
              </div>
              <dl className="space-y-3 text-sm">
                {paymentReq && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Deposit Required</dt>
                      <dd className="font-medium text-navy">
                        {paymentReq.depositRequired ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    {paymentReq.depositPercent != null && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Deposit %</dt>
                        <dd className="font-medium text-navy">{paymentReq.depositPercent}%</dd>
                      </div>
                    )}
                    {paymentReq.depositAmount != null && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Deposit Amount</dt>
                        <dd className="font-medium text-navy font-mono tabular-nums">
                          {fmt(paymentReq.depositAmount)}
                        </dd>
                      </div>
                    )}
                  </>
                )}
                {paymentStatus && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status</dt>
                      <dd>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                          paymentStatus.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700'
                            : paymentStatus.status === 'OVERDUE'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}>
                          {paymentStatus.status.replace(/_/g, ' ')}
                        </span>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Due</dt>
                      <dd className="font-medium text-navy font-mono tabular-nums">
                        {fmt(paymentStatus.amountDue)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Paid</dt>
                      <dd className="font-medium text-navy font-mono tabular-nums">
                        {fmt(paymentStatus.amountPaid)}
                      </dd>
                    </div>
                    {/* Progress bar */}
                    <div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${paymentStatus.amountDue > 0
                              ? Math.min(100, (paymentStatus.amountPaid / paymentStatus.amountDue) * 100)
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </dl>
            </section>
          )}

          {/* Client Responses */}
          {approvals.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4">
                Client Responses
              </h2>
              <div className="space-y-4">
                {approvals.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      {a.action === 'ACCEPT' ? (
                        <div className="rounded-full bg-emerald-100 p-1">
                          <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                      ) : (
                        <div className="rounded-full bg-amber-100 p-1">
                          <ClockIcon className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                      )}
                      <span className="font-medium text-navy">
                        {a.action === 'ACCEPT' ? 'Accepted' : 'Revision Requested'}
                      </span>
                    </div>
                    <p className="text-gray-600 ml-7 mt-0.5">by {a.customerName}</p>
                    {a.message && (
                      <p className="text-gray-500 ml-7 mt-1 italic text-xs bg-gray-50 rounded-lg px-3 py-2">
                        &ldquo;{a.message}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-gray-400 ml-7 mt-1">
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
              <div className="flex items-center gap-2 mb-4">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider">
                  Open Revisions
                </h2>
              </div>
              <div className="space-y-3">
                {revisions.filter((r) => r.status === 'OPEN').map((r) => (
                  <div key={r.id} className="text-sm">
                    <p className="text-amber-900 font-medium">{r.requestedBy}</p>
                    <p className="text-amber-800 mt-1 text-xs">{r.requestMessage}</p>
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
              <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">Notes</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{quote.notes}</p>
            </section>
          )}

          {/* Timeline */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4">Timeline</h2>
            <LifecycleTimeline events={quoteTimeline} />
          </section>
        </div>
      </div>
    </div>
  )
}
