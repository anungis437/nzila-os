/**
 * Nzila OS — Revenue Cockpit
 *
 * Zone 3: REVENUE — Sales command center.
 * Answers: What is in the pipeline? Which pilots are live?
 *          Which deals are closest to close? What is the CAD revenue run rate?
 *
 * Data sources:
 *   - commerceQuotes     → open quote pipeline
 *   - pilotDefinitions   → active, completed, prospect pilots
 *   - pilotMetricEvents  → pilot health scores
 *   - zongaRevenueEvents → actual revenue events
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  commerceQuotes,
  pilotDefinitions,
  pilotHealthScores,
  zongaRevenueEvents,
} from '@nzila/db/schema'
import { count, sum, eq, desc, gte, and, sql } from 'drizzle-orm'
import {
  ArrowTrendingUpIcon,
  BoltIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PipelineQuote {
  id: string
  ref: string | null
  status: string
  total: string | null
  currency: string | null
  createdAt: Date | null
}

interface PilotRow {
  id: string
  pilotName: string
  appScope: string
  status: string
  pilotType: string
  startedAt: Date | null
  targetEndAt: Date | null
}

interface RevenueData {
  // Quotes
  openQuotes: PipelineQuote[]
  openQuotesValue: number
  sentQuotes: PipelineQuote[]
  sentQuotesValue: number
  // Pilots
  activePilots: PilotRow[]
  completedPilots: PilotRow[]
  prospectPilots: PilotRow[]
  // Actual revenue
  revenueEvents30dCount: number
  revenueEvents30dSum: number
  revenueAvailable: boolean
  // Errors
  quotesAvailable: boolean
  pilotsAvailable: boolean
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function loadRevenueData(): Promise<RevenueData> {
  const window30 = new Date()
  window30.setDate(window30.getDate() - 30)

  const [quotesRes, pilotsRes, revenueRes] = await Promise.allSettled([
    platformDb
      .select({
        id: commerceQuotes.id,
        ref: commerceQuotes.ref,
        status: commerceQuotes.status,
        total: commerceQuotes.total,
        currency: commerceQuotes.currency,
        createdAt: commerceQuotes.createdAt,
      })
      .from(commerceQuotes)
      .where(sql`${commerceQuotes.status} IN ('draft', 'sent', 'accepted')`)
      .orderBy(desc(commerceQuotes.createdAt))
      .limit(30),
    platformDb
      .select({
        id: pilotDefinitions.id,
        pilotName: pilotDefinitions.pilotName,
        appScope: pilotDefinitions.appScope,
        status: pilotDefinitions.status,
        pilotType: pilotDefinitions.pilotType,
        startedAt: pilotDefinitions.startedAt,
        targetEndAt: pilotDefinitions.targetEndAt,
      })
      .from(pilotDefinitions)
      .orderBy(desc(pilotDefinitions.startedAt))
      .limit(50),
    platformDb
      .select({
        cnt: count().as('cnt'),
        total: sum(zongaRevenueEvents.amount).as('total'),
      })
      .from(zongaRevenueEvents)
      .where(gte(zongaRevenueEvents.createdAt, window30)),
  ])

  const quotes = quotesRes.status === 'fulfilled' ? (quotesRes.value as PipelineQuote[]) : []
  const quotesAvailable = quotesRes.status === 'fulfilled'

  const pilots = pilotsRes.status === 'fulfilled' ? (pilotsRes.value as PilotRow[]) : []
  const pilotsAvailable = pilotsRes.status === 'fulfilled'

  const openQuotes = quotes.filter((q) => q.status === 'draft')
  const sentQuotes = quotes.filter((q) => q.status === 'sent')
  const openQuotesValue = openQuotes.reduce((a, q) => a + Number(q.total ?? 0), 0)
  const sentQuotesValue = sentQuotes.reduce((a, q) => a + Number(q.total ?? 0), 0)

  const activePilots = pilots.filter((p) => p.status === 'active')
  const completedPilots = pilots.filter((p) => p.status === 'completed').slice(0, 5)
  const prospectPilots = pilots.filter((p) => p.status === 'prospect').slice(0, 5)

  const revenueRow = revenueRes.status === 'fulfilled' ? revenueRes.value[0] : null
  const revenueAvailable = revenueRes.status === 'fulfilled'
  const revenueEvents30dCount = Number(revenueRow?.cnt ?? 0)
  const revenueEvents30dSum = Number(revenueRow?.total ?? 0)

  return {
    openQuotes,
    openQuotesValue,
    sentQuotes,
    sentQuotesValue,
    activePilots,
    completedPilots,
    prospectPilots,
    revenueEvents30dCount,
    revenueEvents30dSum,
    revenueAvailable,
    quotesAvailable,
    pilotsAvailable,
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function statusBadge(s: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    prospect: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-500',
    draft: 'bg-gray-100 text-gray-500',
    sent: 'bg-purple-100 text-purple-700',
    accepted: 'bg-emerald-100 text-emerald-700',
  }
  return map[s] ?? 'bg-gray-100 text-gray-500'
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' })
}

function daysUntil(d: Date | null): string {
  if (!d) return ''
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'today'
  return `${diff}d left`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RevenuePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await loadRevenueData()
  const totalPipelineValue = data.openQuotesValue + data.sentQuotesValue
  const freshnessStatus = !data.quotesAvailable || !data.pilotsAvailable
    ? 'manual'
    : data.revenueAvailable
      ? 'live'
      : 'daily sync'

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <ArrowTrendingUpIcon className="h-8 w-8 text-gray-300" />
            Revenue
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Pipeline · Pilots · Actual revenue events
          </p>
        </div>
        <Link href="/pilot/export" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          Export pilot data <ArrowRightIcon className="h-3 w-3" />
        </Link>
        <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
          freshness: {freshnessStatus}
        </span>
      </div>

      {/* Revenue Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Open Quotes</p>
          <p className="text-2xl font-bold text-gray-900">{data.openQuotes.length}</p>
          {data.quotesAvailable && <p className="text-xs text-gray-400 mt-1">${data.openQuotesValue.toFixed(0)} total</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sent / Pending</p>
          <p className="text-2xl font-bold text-purple-700">{data.sentQuotes.length}</p>
          {data.quotesAvailable && <p className="text-xs text-gray-400 mt-1">${data.sentQuotesValue.toFixed(0)} at risk</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Active Pilots</p>
          <p className={`text-2xl font-bold ${data.activePilots.length > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {data.activePilots.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">{data.pilotsAvailable ? 'live orgs' : 'no data'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">30d Revenue Events</p>
          {data.revenueAvailable ? (
            <>
              <p className="text-2xl font-bold text-gray-900">{data.revenueEvents30dCount}</p>
              {data.revenueEvents30dSum > 0 && (
                <p className="text-xs text-gray-400 mt-1">${data.revenueEvents30dSum.toFixed(0)} total</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data</p>
          )}
        </div>
      </div>

      {/* Active Pilots — highest urgency */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold text-gray-900">Active Pilots</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${data.activePilots.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {data.activePilots.length}
            </span>
          </div>
          {!data.pilotsAvailable && (
            <span className="text-xs text-gray-400 italic">DB unavailable</span>
          )}
        </div>
        {data.activePilots.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase text-left">
                <th className="px-4 py-3">Pilot</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Target End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.activePilots.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.pilotName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.appScope}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{p.pilotType}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(p.startedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${p.targetEndAt && new Date(p.targetEndAt) < new Date() ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      {formatDate(p.targetEndAt)}
                      {p.targetEndAt && <span className="ml-1 text-gray-300">({daysUntil(p.targetEndAt)})</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 flex items-center gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-medium text-gray-700">No active pilots</p>
              <p className="text-sm text-gray-400">Revenue risk. Activate a pilot or update pilot status in the DB.</p>
            </div>
          </div>
        )}
      </div>

      {/* Prospect Pilots */}
      {data.prospectPilots.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-amber-400" />
            <h2 className="font-semibold text-gray-900">Prospect Pilots</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-1">{data.prospectPilots.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase text-left">
                <th className="px-4 py-3">Pilot</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Target Start</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.prospectPilots.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.pilotName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.appScope}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{p.pilotType}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(p.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quote Pipeline */}
      {(data.openQuotes.length > 0 || data.sentQuotes.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold text-gray-900">Quote Pipeline</h2>
            <span className="text-xs text-gray-400 ml-1">${totalPipelineValue.toFixed(0)} total value</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase text-left">
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...data.sentQuotes, ...data.openQuotes].slice(0, 15).map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{q.ref ?? q.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(q.status)}`}>{q.status}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {q.total ? `$${Number(q.total).toFixed(0)} ${q.currency ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(q.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No data state */}
      {data.quotesAvailable && data.openQuotes.length === 0 && data.sentQuotes.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="font-semibold text-blue-800">No quotes in pipeline</p>
          <p className="text-sm text-blue-600 mt-1">
            Create quotes in Flow or log deals manually to populate the revenue pipeline.
          </p>
        </div>
      )}

      {/* Playbooks */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-700 mb-3">Revenue Playbooks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-gray-800 mb-1">UnionEyes (Priority #1)</p>
            <ul className="text-gray-500 text-xs space-y-1 list-disc list-inside">
              <li>ICP: CUPE locals, unions with 200–5,000 members</li>
              <li>Close trigger: 3 pilot orgs in active use → paid conversion</li>
              <li>Price hypothesis: $3–8/member/month or $15k–60k/year</li>
              <li>Next action: CUPE pilot proposal review this week</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Flow (Priority #2)</p>
            <ul className="text-gray-500 text-xs space-y-1 list-disc list-inside">
              <li>ICP: SMBs needing quotes/invoices/inventory/payments</li>
              <li>Close trigger: 2 paid demos → conversion</li>
              <li>Price hypothesis: $49–149/month SaaS</li>
              <li>Next action: Schedule 2 demo calls this week</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Nav away */}
      <div className="flex gap-3">
        <Link href="/portfolio" className="text-sm text-gray-500 hover:text-gray-900">← Portfolio</Link>
        <Link href="/capital" className="text-sm text-blue-600 hover:text-blue-800">Capital →</Link>
      </div>
    </div>
  )
}
