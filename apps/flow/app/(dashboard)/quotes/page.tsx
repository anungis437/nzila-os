import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
  PlusIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { quoteRepo, customerRepo } from '@/lib/db'
import { getReadContext } from '@/lib/clerk-org-resolver'
import { ConversionBadge } from './conversion-badge'
import { QuotesToolbar } from './quotes-toolbar'

// ── Status configuration ────────────────────────────────────────────────────

const statusConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  DRAFT:              { dot: 'bg-gray-400',   bg: 'bg-gray-50',    text: 'text-gray-700',   label: 'Draft' },
  INTERNAL_REVIEW:    { dot: 'bg-blue-400',   bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'In Review' },
  SENT_TO_CLIENT:     { dot: 'bg-violet-400', bg: 'bg-violet-50',  text: 'text-violet-700', label: 'Sent' },
  REVISION_REQUESTED: { dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Revision' },
  ACCEPTED:           { dot: 'bg-emerald-500',bg: 'bg-emerald-50', text: 'text-emerald-700',label: 'Accepted' },
  DEPOSIT_REQUIRED:   { dot: 'bg-orange-400', bg: 'bg-orange-50',  text: 'text-orange-700', label: 'Deposit Req.' },
  READY_FOR_PO:       { dot: 'bg-indigo-400', bg: 'bg-indigo-50',  text: 'text-indigo-700', label: 'Ready for PO' },
  IN_PRODUCTION:      { dot: 'bg-cyan-400',   bg: 'bg-cyan-50',    text: 'text-cyan-700',   label: 'Producing' },
  SHIPPED:            { dot: 'bg-teal-400',   bg: 'bg-teal-50',    text: 'text-teal-700',   label: 'Shipped' },
  DELIVERED:          { dot: 'bg-emerald-500',bg: 'bg-emerald-50', text: 'text-emerald-700',label: 'Delivered' },
  CLOSED:             { dot: 'bg-gray-400',   bg: 'bg-gray-50',    text: 'text-gray-600',   label: 'Closed' },
  EXPIRED:            { dot: 'bg-gray-300',   bg: 'bg-gray-50',    text: 'text-gray-500',   label: 'Expired' },
  CANCELLED:          { dot: 'bg-gray-300',   bg: 'bg-gray-50',    text: 'text-gray-500',   label: 'Cancelled' },
  // Legacy
  PRICING:            { dot: 'bg-blue-400',   bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Pricing' },
  READY:              { dot: 'bg-indigo-400', bg: 'bg-indigo-50',  text: 'text-indigo-700', label: 'Ready' },
  SENT:               { dot: 'bg-violet-400', bg: 'bg-violet-50',  text: 'text-violet-700', label: 'Sent' },
  REVIEWING:          { dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Reviewing' },
  DECLINED:           { dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-700',    label: 'Declined' },
}

const tierBadge: Record<string, string> = {
  BUDGET:   'bg-gray-100 text-gray-600',
  STANDARD: 'bg-blue-50 text-blue-600',
  PREMIUM:  'bg-amber-50 text-amber-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
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

// ── Page Component ──────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ filter?: string; q?: string }>
}

export default async function QuotesListPage({ searchParams }: PageProps) {
  const locale = await getLocale()
  const base = `/${locale}/dashboard`
  const { filter, q } = await searchParams

  // Real data fetch — falls back to empty array
  let quotes: Awaited<ReturnType<typeof quoteRepo.findAll>> = []
  try {
    const ctx = await getReadContext()
    quotes = await quoteRepo.findAll(ctx.orgId)
  } catch {
    // DB not seeded yet — render empty state
  }

  // Resolve customer names
  const customerMap = new Map<string, string>()
  for (const q of quotes) {
    if (q.customerId && !customerMap.has(q.customerId)) {
      try {
        const c = await customerRepo.findById(q.customerId)
        if (c) customerMap.set(q.customerId, c.name)
      } catch { /* skip */ }
    }
  }

  // Normalize statuses to uppercase for consistent comparison
  const norm = (s: string) => s.toUpperCase()

  // KPI calculations
  const total = quotes.length
  const ACTIVE_STATUSES = ['INTERNAL_REVIEW', 'SENT_TO_CLIENT', 'REVISION_REQUESTED', 'REVISED']
  const WON_STATUSES = ['ACCEPTED', 'DEPOSIT_REQUIRED', 'READY_FOR_PO', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CLOSED']

  const drafts = quotes.filter((q) => norm(q.status) === 'DRAFT').length
  const active = quotes.filter((q) => ACTIVE_STATUSES.includes(norm(q.status))).length
  const won = quotes.filter((q) => WON_STATUSES.includes(norm(q.status))).length
  const pipeline = quotes.reduce((s, q) => s + (q.total ?? 0), 0)
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0

  const kpis = [
    { label: 'Total Quotes', value: total.toString(), icon: DocumentTextIcon, accent: 'text-electric' },
    { label: 'Active Pipeline', value: fmt(pipeline), icon: CurrencyDollarIcon, accent: 'text-emerald-600' },
    { label: 'In Progress', value: active.toString(), icon: PaperAirplaneIcon, accent: 'text-violet-600' },
    { label: 'Win Rate', value: `${winRate}%`, icon: ArrowTrendingUpIcon, accent: 'text-amber-600' },
  ]

  // ── Filter quotes based on searchParams ────────────────────────────────
  let filtered = quotes
  if (filter === 'Draft') {
    filtered = quotes.filter((q) => norm(q.status) === 'DRAFT')
  } else if (filter === 'Active') {
    filtered = quotes.filter((q) => ACTIVE_STATUSES.includes(norm(q.status)))
  } else if (filter === 'Accepted') {
    filtered = quotes.filter((q) => WON_STATUSES.includes(norm(q.status)))
  } else if (filter === 'Closed') {
    filtered = quotes.filter((q) => ['CLOSED', 'EXPIRED', 'CANCELLED'].includes(norm(q.status)))
  }

  if (q) {
    const term = q.toLowerCase()
    filtered = filtered.filter((quote) => {
      const ref = (quote.reference ?? '').toLowerCase()
      const title = (quote.title ?? '').toLowerCase()
      const client = (quote.customerId ? customerMap.get(quote.customerId) ?? '' : '').toLowerCase()
      return ref.includes(term) || title.includes(term) || client.includes(term)
    })
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage proposals, track lifecycle, and convert to orders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`${base}/quotes/request`}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-electric text-electric text-sm font-semibold rounded-lg hover:bg-electric/5 transition-colors"
          >
            <DocumentTextIcon className="h-4 w-4" />
            Quote Request
          </Link>
          <Link
            href={`${base}/quotes/new`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            New Quote
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
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

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <QuotesToolbar counts={{ total, drafts, active, won }} />

      {/* ── Table ──────────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Reference
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Client
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Tier
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Total
                </th>
                <th className="text-center px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  AI Score
                </th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((q) => {
                const s = statusConfig[(q.status ?? 'DRAFT').toUpperCase()] ?? statusConfig.DRAFT
                const tier = (q.tier ?? 'STANDARD').toUpperCase()
                return (
                  <tr
                    key={q.id}
                    className="group hover:bg-electric/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`${base}/quotes/${q.id}`}
                        className="font-semibold text-electric hover:text-electric-light transition-colors"
                      >
                        {q.reference}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                        {q.title}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">
                        {(q.customerId && customerMap.get(q.customerId)) ?? '—'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${tierBadge[tier] ?? tierBadge.STANDARD}`}>
                        {tier.charAt(0) + tier.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${s.bg} ${s.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-gray-900 tabular-nums">
                      {fmt(q.total ?? 0)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <ConversionBadge quoteId={q.id} />
                    </td>
                    <td className="px-5 py-4 text-right text-gray-500 text-xs">
                      {relativeDate(q.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Empty state ─────────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="rounded-2xl bg-electric/5 p-5 mb-5">
            <DocumentTextIcon className="h-10 w-10 text-electric" />
          </div>
          <h2 className="text-lg font-semibold text-navy mb-1">No quotes yet</h2>
          <p className="text-sm text-gray-500 max-w-md mb-6">
            Create your first gift box proposal. Quotes flow through review,
            client approval, payment, and production — all tracked in one place.
          </p>
          <Link
            href={`${base}/quotes/new`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Create First Quote
          </Link>
        </div>
      )}
    </div>
  )
}
