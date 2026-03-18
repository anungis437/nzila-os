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
  TruckIcon,
  FlagIcon,
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

// ── Status configuration ────────────────────────────────────────────────────

const statusConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  DRAFT:              { dot: 'bg-gray-400',   bg: 'bg-gray-50',    text: 'text-gray-700',   label: 'Draft' },
  INTERNAL_REVIEW:    { dot: 'bg-blue-400',   bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Internal Review' },
  SENT_TO_CLIENT:     { dot: 'bg-violet-400', bg: 'bg-violet-50',  text: 'text-violet-700', label: 'Sent to Client' },
  REVISION_REQUESTED: { dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Revision Requested' },
  ACCEPTED:           { dot: 'bg-emerald-500',bg: 'bg-emerald-50', text: 'text-emerald-700',label: 'Accepted' },
  DEPOSIT_REQUIRED:   { dot: 'bg-orange-400', bg: 'bg-orange-50',  text: 'text-orange-700', label: 'Deposit Required' },
  READY_FOR_PO:       { dot: 'bg-indigo-400', bg: 'bg-indigo-50',  text: 'text-indigo-700', label: 'Ready for PO' },
  IN_PRODUCTION:      { dot: 'bg-cyan-400',   bg: 'bg-cyan-50',    text: 'text-cyan-700',   label: 'In Production' },
  SHIPPED:            { dot: 'bg-teal-400',   bg: 'bg-teal-50',    text: 'text-teal-700',   label: 'Shipped' },
  DELIVERED:          { dot: 'bg-emerald-500',bg: 'bg-emerald-50', text: 'text-emerald-700',label: 'Delivered' },
  CLOSED:             { dot: 'bg-gray-400',   bg: 'bg-gray-50',    text: 'text-gray-600',   label: 'Closed' },
  EXPIRED:            { dot: 'bg-gray-300',   bg: 'bg-gray-50',    text: 'text-gray-500',   label: 'Expired' },
  CANCELLED:          { dot: 'bg-gray-300',   bg: 'bg-gray-50',    text: 'text-gray-500',   label: 'Cancelled' },
  PRICING:            { dot: 'bg-blue-400',   bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Pricing' },
  READY:              { dot: 'bg-indigo-400', bg: 'bg-indigo-50',  text: 'text-indigo-700', label: 'Ready' },
  SENT:               { dot: 'bg-violet-400', bg: 'bg-violet-50',  text: 'text-violet-700', label: 'Sent' },
  REVIEWING:          { dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Reviewing' },
  DECLINED:           { dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-700',    label: 'Declined' },
}

// Lifecycle phases for progress bar
const LIFECYCLE_PHASES = [
  { key: 'DRAFT', label: 'Draft', icon: DocumentTextIcon },
  { key: 'REVIEW', label: 'Review', icon: ClockIcon },
  { key: 'CLIENT', label: 'Client', icon: UserIcon },
  { key: 'ACCEPTED', label: 'Accepted', icon: CheckCircleIcon },
  { key: 'PAYMENT', label: 'Payment', icon: CurrencyDollarIcon },
  { key: 'PRODUCTION', label: 'Production', icon: CubeIcon },
  { key: 'DELIVERY', label: 'Delivery', icon: TruckIcon },
  { key: 'CLOSED', label: 'Closed', icon: FlagIcon },
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

// Timeline event icon mapping
function timelineIcon(event: string) {
  const e = event.toLowerCase()
  if (e.includes('accepted') || e.includes('approved')) return { icon: CheckCircleIcon, color: 'bg-emerald-400' }
  if (e.includes('sent') || e.includes('send')) return { icon: TruckIcon, color: 'bg-violet-400' }
  if (e.includes('revision') || e.includes('request')) return { icon: ExclamationTriangleIcon, color: 'bg-amber-400' }
  if (e.includes('payment') || e.includes('deposit')) return { icon: CurrencyDollarIcon, color: 'bg-orange-400' }
  if (e.includes('production')) return { icon: CubeIcon, color: 'bg-cyan-400' }
  if (e.includes('shipped') || e.includes('delivered')) return { icon: TruckIcon, color: 'bg-teal-400' }
  if (e.includes('closed')) return { icon: FlagIcon, color: 'bg-gray-400' }
  return { icon: ClockIcon, color: 'bg-electric' }
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
  const cfg = statusConfig[status] ?? statusConfig.DRAFT
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
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{quote.title}</p>
        </div>
        <QuoteDetailActions quoteId={id} status={status} />
      </div>

      {/* ── Lifecycle Progress ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          {LIFECYCLE_PHASES.map((phase, i) => {
            const isComplete = i < currentPhase
            const isCurrent = i === currentPhase
            const Icon = phase.icon
            return (
              <div key={phase.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
                    isComplete
                      ? 'bg-electric text-white'
                      : isCurrent
                        ? 'bg-electric/10 text-electric ring-2 ring-electric/30'
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isComplete ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium ${
                    isCurrent ? 'text-electric' : isComplete ? 'text-navy' : 'text-gray-400'
                  }`}>
                    {phase.label}
                  </span>
                </div>
                {i < LIFECYCLE_PHASES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-14px] rounded-full ${
                    i < currentPhase ? 'bg-electric' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

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
                {availableTransitions.map((t) => {
                  const targetCfg = statusConfig[t.to] ?? statusConfig.DRAFT
                  return (
                    <div
                      key={`${t.from}-${t.to}`}
                      className="flex items-center gap-2 text-sm px-3 py-2.5 bg-gray-50 rounded-lg"
                    >
                      <span className={`h-2 w-2 rounded-full ${targetCfg.dot}`} />
                      <span className="text-gray-600">{t.label}</span>
                      <span className="ml-auto text-xs font-medium text-gray-500">{targetCfg.label}</span>
                    </div>
                  )
                })}
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
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />

              <div className="space-y-4">
                {/* Created event */}
                <div className="flex items-start gap-3 relative">
                  <div className="mt-0.5 h-[18px] w-[18px] rounded-full bg-electric flex items-center justify-center shrink-0 z-10">
                    <DocumentTextIcon className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">Created</p>
                    <p className="text-xs text-gray-500">Quote created</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(quote.createdAt).toLocaleString('en-CA')}
                      {quote.createdBy ? ` · ${quote.createdBy}` : ''}
                    </p>
                  </div>
                </div>

                {timeline.map((event) => {
                  const ti = timelineIcon(event.event)
                  const Icon = ti.icon
                  return (
                    <div key={event.id} className="flex items-start gap-3 relative">
                      <div className={`mt-0.5 h-[18px] w-[18px] rounded-full ${ti.color} flex items-center justify-center shrink-0 z-10`}>
                        <Icon className="h-2.5 w-2.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy">{event.event.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500">{event.description}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(event.timestamp).toLocaleString('en-CA')}
                          {event.actor ? ` · ${event.actor}` : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
