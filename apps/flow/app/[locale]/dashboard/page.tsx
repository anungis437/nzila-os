import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PlusIcon,
  ChartBarIcon,
  CubeIcon,
  TruckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { quoteRepo } from '@/lib/db'
import { getReadContext } from '@/lib/org-resolver'
import { getOrdersAction } from '@/app/actions/orders'
import { getInvoicesAction } from '@/app/actions/invoices'
import { getCustomersAction } from '@/app/actions/customers'
import { getProductsAction } from '@/app/actions/products'
import { getLowStockAction } from '@/app/actions/inventory'
import { db, commerceQuoteLines, commerceQuotes } from '@nzila/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  calculateAverageQuoteSize,
  calculateCloseRateTrend,
  calculateEstimatedMrr,
  estimateCustomerLifetimeValue,
} from '@/lib/commercial-insights'

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function fmtCompact(n: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

function relativeDate(d: string | Date) {
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

const statusStyles: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  draft:     { dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-700',    label: 'Draft' },
  revised:   { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Revised' },
  accepted:  { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Accepted' },
  sent:      { dot: 'bg-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-700',  label: 'Sent' },
  expired:   { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500',    label: 'Expired' },
  cancelled: { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500',    label: 'Cancelled' },
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { locale } = await params
  const base = `/${locale}/dashboard`

  // Parallel data fetch
  const [quotesResult, ordersResult, invoicesResult, customersResult, productsResult, lowStockResult] =
    await Promise.allSettled([
      (async () => {
        const ctx = await getReadContext()
        return quoteRepo.findAll(ctx.orgId)
      })(),
      getOrdersAction({ limit: 1000 }),
      getInvoicesAction({ limit: 1000 }),
      getCustomersAction({ limit: 1000 }),
      getProductsAction({ limit: 1000, status: 'active' }),
      getLowStockAction(),
    ])

  const [quoteOutcomeResult, topWonSkuResult] = await Promise.allSettled([
    (async () => {
      const ctx = await getReadContext()
      const [wonRow, lostRow] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(commerceQuotes)
          .where(and(eq(commerceQuotes.orgId, ctx.orgId), eq(commerceQuotes.status, 'accepted'))),
        db
          .select({ count: sql<number>`count(*)` })
          .from(commerceQuotes)
          .where(
            and(
              eq(commerceQuotes.orgId, ctx.orgId),
              inArray(commerceQuotes.status, ['declined', 'expired', 'cancelled']),
            ),
          ),
      ])

      return {
        won: Number(wonRow[0]?.count ?? 0),
        lost: Number(lostRow[0]?.count ?? 0),
      }
    })(),
    (async () => {
      const ctx = await getReadContext()
      return db
        .select({
          sku: commerceQuoteLines.sku,
          units: sql<number>`coalesce(sum(${commerceQuoteLines.quantity}), 0)`,
          lineValue: sql<number>`coalesce(sum(${commerceQuoteLines.lineTotal}), 0)`,
        })
        .from(commerceQuoteLines)
        .innerJoin(commerceQuotes, eq(commerceQuoteLines.quoteId, commerceQuotes.id))
        .where(
          and(
            eq(commerceQuotes.orgId, ctx.orgId),
            eq(commerceQuotes.status, 'accepted'),
            sql`${commerceQuoteLines.sku} is not null`,
          ),
        )
        .groupBy(commerceQuoteLines.sku)
        .orderBy(desc(sql`coalesce(sum(${commerceQuoteLines.lineTotal}), 0)`))
        .limit(5)
    })(),
  ])

  type OrderRow = Awaited<ReturnType<typeof getOrdersAction>>['rows'][number]
  type InvoiceRow = Awaited<ReturnType<typeof getInvoicesAction>>['rows'][number]
  type CustomerRow = Awaited<ReturnType<typeof getCustomersAction>>['rows'][number]
  type ProductRow = Awaited<ReturnType<typeof getProductsAction>>['rows'][number]

  const quotes = quotesResult.status === 'fulfilled' ? quotesResult.value : []
  const orders: OrderRow[] = ordersResult.status === 'fulfilled' ? ordersResult.value.rows ?? [] : []
  const invoices: InvoiceRow[] = invoicesResult.status === 'fulfilled' ? invoicesResult.value.rows ?? [] : []
  const customers: CustomerRow[] = customersResult.status === 'fulfilled' ? customersResult.value.rows ?? [] : []
  const products: ProductRow[] = productsResult.status === 'fulfilled' ? productsResult.value.rows ?? [] : []
  const lowStock = lowStockResult.status === 'fulfilled' ? (lowStockResult.value as Awaited<ReturnType<typeof getLowStockAction>>) : []

  // ── KPI Calculations ──────────────────────────────────────────────────
  const norm = (s: string) => s.toUpperCase()
  const WON = ['ACCEPTED', 'DEPOSIT_REQUIRED', 'READY_FOR_PO', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CLOSED']
  const ACTIVE_Q = ['INTERNAL_REVIEW', 'SENT_TO_CLIENT', 'REVISION_REQUESTED', 'REVISED', 'SENT', 'PRICING', 'READY']

  const activeQuotes = quotes.filter((q) => norm(q.status) === 'DRAFT' || ACTIVE_Q.includes(norm(q.status))).length
  const wonQuotes = quotes.filter((q) => WON.includes(norm(q.status))).length
  const lostQuotes = quotes.filter((q) => ['DECLINED', 'EXPIRED', 'CANCELLED'].includes(norm(q.status))).length
  const winRate = quotes.length > 0 ? Math.round((wonQuotes / quotes.length) * 100) : 0
  const quotePipeline = quotes
    .filter((q) => !['CLOSED', 'EXPIRED', 'CANCELLED'].includes(norm(q.status)))
    .reduce((s, q) => s + (q.total ?? 0), 0)

  const totalRevenue = orders.reduce((s: number, o) => s + Number(o.total ?? 0), 0)
  const activeOrders = orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length
  const totalClients = customers.length
  const totalProducts = products.length

  const invoicePaid = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((s: number, inv) => s + Number(inv.total ?? 0), 0)
  const invoiceOutstanding = invoices
    .filter((inv) => ['issued', 'sent', 'overdue', 'partial_paid'].includes(inv.status))
    .reduce((s: number, inv) => s + Number(inv.amountDue ?? inv.total ?? 0), 0)
  const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue').length

  const quotesSent = quotes.filter((q) => ['sent', 'reviewing', 'revised'].includes((q.status ?? '').toLowerCase())).length
  const ordersFromQuotes = orders.filter((o) => Boolean(o.quoteId)).length
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid').length

  const agingBuckets = {
    under7: 0,
    between8And14: 0,
    over14: 0,
  }
  for (const quote of quotes.filter((q) => ['draft', 'pricing', 'ready', 'sent', 'reviewing', 'revised'].includes((q.status ?? '').toLowerCase()))) {
    const ageDays = Math.floor((Date.now() - new Date(quote.createdAt).getTime()) / 86_400_000)
    if (ageDays <= 7) agingBuckets.under7 += 1
    else if (ageDays <= 14) agingBuckets.between8And14 += 1
    else agingBuckets.over14 += 1
  }

  // Recent quotes (last 5)
  const recentQuotes = quotes.slice(0, 5)
  const quoteOutcome = quoteOutcomeResult.status === 'fulfilled'
    ? quoteOutcomeResult.value
    : { won: wonQuotes, lost: lostQuotes }
  const topWonSkus = topWonSkuResult.status === 'fulfilled' ? topWonSkuResult.value : []

  // Order pipeline counts
  const orderStages = [
    { label: 'Created', status: 'created', color: 'bg-gray-400' },
    { label: 'Confirmed', status: 'confirmed', color: 'bg-blue-500' },
    { label: 'Fulfillment', status: 'fulfillment', color: 'bg-violet-500' },
    { label: 'Shipped', status: 'shipped', color: 'bg-cyan-500' },
    { label: 'Delivered', status: 'delivered', color: 'bg-emerald-500' },
    { label: 'Completed', status: 'completed', color: 'bg-emerald-600' },
  ]
  const orderStageCounts = orderStages.map((stage) => ({
    ...stage,
    count: orders.filter((o) => o.status === stage.status).length,
  }))
  const maxStageCount = Math.max(...orderStageCounts.map((s) => s.count), 1)

  // ── Quick Actions ─────────────────────────────────────────────────────
  const quickActions = [
    { label: 'New Quote', href: `${base}/quotes/new`, icon: PlusIcon, color: 'bg-electric text-white' },
    { label: 'Quote Request', href: `${base}/quotes/request`, icon: SparklesIcon, color: 'bg-violet-600 text-white' },
    { label: 'View Analytics', href: `${base}/analytics`, icon: ChartBarIcon, color: 'bg-emerald-600 text-white' },
    { label: 'Manage Clients', href: `${base}/clients`, icon: UserGroupIcon, color: 'bg-amber-500 text-white' },
    { label: 'Billing', href: `${base}/settings/billing`, icon: CurrencyDollarIcon, color: 'bg-gray-900 text-white' },
  ]

  const averageQuoteSize = calculateAverageQuoteSize(
    quotes.map((quote) => ({ total: Number(quote.total ?? 0), status: quote.status, createdAt: quote.createdAt })),
  )
  const estimatedMrr = calculateEstimatedMrr(
    invoices.map((invoice) => ({ total: Number(invoice.total ?? 0), status: invoice.status, issuedAt: invoice.issuedAt ?? invoice.createdAt })),
  )
  const closeTrend = calculateCloseRateTrend(
    quotes.map((quote) => ({ total: Number(quote.total ?? 0), status: quote.status, createdAt: quote.createdAt })),
  )
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0
  const ordersPerCustomer = totalClients > 0 ? orders.length / totalClients : 0
  const estimatedClv = estimateCustomerLifetimeValue({
    averageOrderValue,
    ordersPerMonth: ordersPerCustomer / 6,
    averageLifetimeMonths: 18,
  })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Overview of your quoting and commerce workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors shadow-sm hover:opacity-90 ${a.color}`}
            >
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Primary KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Quote Pipeline',
            value: fmtCompact(quotePipeline),
            sub: `${activeQuotes} active`,
            icon: DocumentTextIcon,
            accent: 'text-electric',
            bg: 'bg-electric/5',
          },
          {
            label: 'Revenue',
            value: fmtCompact(totalRevenue),
            sub: `${orders.length} orders`,
            icon: CurrencyDollarIcon,
            accent: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Win Rate',
            value: `${winRate}%`,
            sub: `${quoteOutcome.won} won • ${quoteOutcome.lost} lost`,
            icon: ArrowTrendingUpIcon,
            accent: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'Active Clients',
            value: totalClients.toString(),
            sub: `${totalProducts} products`,
            icon: UserGroupIcon,
            accent: 'text-violet-600',
            bg: 'bg-violet-50',
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:shadow-sm transition-shadow"
          >
            <div className={`rounded-lg ${k.bg} p-2.5`}>
              <k.icon className={`h-5 w-5 ${k.accent}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'MRR Estimate', value: fmtCompact(estimatedMrr), sub: 'Last 3 months paid invoices' },
          { label: 'Avg Quote Size', value: fmtCompact(averageQuoteSize), sub: `${quotes.length} quotes sampled` },
          {
            label: 'Close Trend',
            value: `${closeTrend.recentCloseRate}%`,
            sub: `${closeTrend.deltaPoints >= 0 ? '+' : ''}${closeTrend.deltaPoints} pts vs prior 30d`,
          },
          { label: 'Overdue Invoices', value: String(overdueInvoices), sub: 'Collections risk signal' },
          { label: 'CLV Estimate', value: fmtCompact(estimatedClv), sub: 'Based on order velocity' },
        ].map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">{metric.label}</p>
            <p className="mt-1 text-xl font-bold text-navy">{metric.value}</p>
            <p className="mt-0.5 text-xs text-gray-400">{metric.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid: Recent Quotes + Order Pipeline ───────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Quotes — 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-navy">Recent Quotes</h2>
            <Link
              href={`${base}/quotes`}
              className="text-xs font-medium text-electric hover:text-electric-light transition-colors"
            >
              View all →
            </Link>
          </div>
          {recentQuotes.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Ref</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentQuotes.map((q) => {
                  const s = statusStyles[q.status] ?? statusStyles.draft
                  return (
                    <tr key={q.id} className="hover:bg-electric/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`${base}/quotes/${q.id}`} className="font-semibold text-electric hover:text-electric-light transition-colors">
                          {q.reference}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-700 truncate max-w-50">{q.title || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${s.bg} ${s.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-900 tabular-nums">{fmt(q.total ?? 0)}</td>
                      <td className="px-5 py-3 text-right text-xs text-gray-500">{relativeDate(q.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">No quotes yet — create your first one above.</div>
          )}
        </div>

        {/* Order Pipeline — 1 column */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-navy">Order Pipeline</h2>
            <Link
              href={`${base}/orders`}
              className="text-xs font-medium text-electric hover:text-electric-light transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="p-5 space-y-3">
            {orders.length > 0 ? (
              orderStageCounts.map((stage) => (
                <div key={stage.status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{stage.label}</span>
                    <span className="font-bold text-navy">{stage.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${stage.color}`}
                      style={{ width: `${(stage.count / maxStageCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-gray-400">No orders yet.</div>
            )}
            {orders.length > 0 && (
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Total orders</span>
                <span className="font-bold text-navy">{orders.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Secondary Grid: Financials + Alerts ─────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Collections */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-emerald-50 p-2">
              <CurrencyDollarIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-navy">Collections</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Collected</span>
              <span className="text-sm font-bold text-emerald-600">{fmtCompact(invoicePaid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Outstanding</span>
              <span className="text-sm font-bold text-amber-600">{fmtCompact(invoiceOutstanding)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              {(invoicePaid + invoiceOutstanding) > 0 && (
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(invoicePaid / (invoicePaid + invoiceOutstanding)) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{invoices.length} invoices</span>
              <span>{Math.round((invoicePaid / Math.max(invoicePaid + invoiceOutstanding, 1)) * 100)}% collected</span>
            </div>
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-blue-50 p-2">
              <ShoppingCartIcon className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-navy">Active Orders</h3>
          </div>
          <p className="text-3xl font-bold text-navy">{activeOrders}</p>
          <p className="text-xs text-gray-400 mt-1">of {orders.length} total</p>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <TruckIcon className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-gray-600">{orders.filter((o) => o.status === 'shipped').length} shipping</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CubeIcon className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-gray-600">{orders.filter((o) => o.status === 'fulfillment').length} producing</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-red-50 p-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
            </div>
            <h3 className="text-sm font-semibold text-navy">Alerts</h3>
          </div>
          <div className="space-y-2.5">
            {overdueInvoices > 0 && (
              <Link href={`${base}/invoices`} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
                <ClockIcon className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-xs text-red-700 font-medium">{overdueInvoices} overdue invoice{overdueInvoices > 1 ? 's' : ''}</span>
              </Link>
            )}
            {lowStock.length > 0 && (
              <Link href={`${base}/inventory`} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
                <CubeIcon className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-xs text-amber-700 font-medium">{lowStock.length} low stock item{lowStock.length > 1 ? 's' : ''}</span>
              </Link>
            )}
            {overdueInvoices === 0 && lowStock.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400">No alerts — everything looks good.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Funnel + Aging ──────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-navy">Quote-to-Cash Funnel</h3>
          <p className="text-xs text-gray-500 mt-0.5">Current conversion across quote, order, and invoice stages</p>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Quotes Created', value: quotes.length },
              { label: 'Quotes Sent', value: quotesSent },
              { label: 'Quotes Won', value: quoteOutcome.won },
              { label: 'Orders Created', value: ordersFromQuotes },
              { label: 'Invoices Paid', value: paidInvoices },
            ].map((stage, index, all) => {
              const baseCount = all[0]?.value || 1
              const width = Math.max(6, Math.round((stage.value / baseCount) * 100))
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">{stage.label}</span>
                    <span className="font-semibold text-navy">{stage.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${index < 2 ? 'bg-electric' : index < 4 ? 'bg-violet-500' : 'bg-emerald-500'}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-navy">Quote Aging</h3>
          <p className="text-xs text-gray-500 mt-0.5">Open quote workload by age bucket</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-[11px] text-gray-500">0-7 days</p>
              <p className="text-xl font-bold text-navy mt-1">{agingBuckets.under7}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-[11px] text-amber-700">8-14 days</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{agingBuckets.between8And14}</p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <p className="text-[11px] text-red-700">15+ days</p>
              <p className="text-xl font-bold text-red-700 mt-1">{agingBuckets.over14}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {agingBuckets.over14 > 0 ? 'Prioritize >14 day quotes to reduce leakage.' : 'No stale quotes currently in pipeline.'}
          </p>
        </div>
      </div>

      {/* ── SKU Insights ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-navy">Top Won SKUs</h3>
            <p className="text-xs text-gray-500 mt-0.5">Based on accepted quote lines</p>
          </div>
          <Link href={`${base}/products`} className="text-xs font-medium text-electric hover:text-electric-light transition-colors">
            View catalog →
          </Link>
        </div>

        {topWonSkus.length > 0 ? (
          <div className="space-y-2.5">
            {topWonSkus.map((row, index) => (
              <div key={`${row.sku}-${index}`} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-navy">{row.sku}</p>
                  <p className="text-xs text-gray-500">{Number(row.units ?? 0)} units quoted</p>
                </div>
                <p className="text-sm font-bold text-emerald-600">{fmt(Number(row.lineValue ?? 0))}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-3">No accepted quote SKUs yet.</p>
        )}
      </div>
    </div>
  )
}
