/**
 * Nzila OS — CEO Daily Pulse
 *
 * Zone 1: TODAY — The founder's first view every morning.
 * Answers: What is the cash position? What ships this week?
 *          What pilots are closest to close? What needs a decision now?
 *
 * Data sources:
 *   - platformCostRollups → burn estimate
 *   - pilotDefinitions    → active pilots
 *   - commerceQuotes      → pipeline value
 *   - auditEvents         → governance freshness
 *   - product-catalog.json → venture priority list
 *   - business/approvals  → pending approvals queue
 *
 * Conservative: all queries wrapped in try/catch — page always renders.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentUser, auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  pilotDefinitions,
  commerceQuotes,
  auditEvents,
  approvals,
  platformCostRollups,
} from '@nzila/db/schema'
import { count, sum, gte, eq, desc } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BoltIcon,
  ClipboardDocumentCheckIcon,
  BuildingOffice2Icon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { getTodayExecutiveSummary, getTopExecutionActions } from '@/lib/executive-intelligence'

export const dynamic = 'force-dynamic'

// ── Types ────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  name: string
  commercial_priority: number
  status: string
  code_presence: string
  evidence_status: string
  value_prop: string
}

interface ProductCatalog {
  products: CatalogProduct[]
}

interface PulseData {
  userName: string | null
  dateLabel: string
  weekNumber: number
  // Capital
  burnLast30Usd: number
  burnDataAvailable: boolean
  // Pipeline
  openQuotesCount: number
  openQuotesValueCad: number
  pipelineAvailable: boolean
  // Pilots
  activePilotsCount: number
  pilotsAvailable: boolean
  // Governance
  pendingApprovalsCount: number
  approvalsAvailable: boolean
  lastAuditEventAt: string | null
  // Venture priorities (from catalog)
  topVentures: CatalogProduct[]
  // Alerts
  alerts: Alert[]
}

interface Alert {
  level: 'critical' | 'warning' | 'info'
  message: string
  href: string
}

// ── Data loader ───────────────────────────────────────────────────────────────

function getDateLabel(): { label: string; week: number } {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  const day = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return { label: day, week }
}

function loadProductCatalog(): CatalogProduct[] {
  try {
    const catalogPath = path.join(process.cwd(), '../../governance/portfolio/product-catalog.json')
    const raw = fs.readFileSync(catalogPath, 'utf-8')
    const catalog = JSON.parse(raw) as ProductCatalog
    return catalog.products
      .filter((p) => (p.commercial_priority ?? 99) <= 4)
      .sort((a, b) => (a.commercial_priority ?? 99) - (b.commercial_priority ?? 99))
      .slice(0, 6)
  } catch {
    return []
  }
}

async function loadPulseData(userName: string | null): Promise<PulseData> {
  const { label, week } = getDateLabel()
  const topVentures = loadProductCatalog()

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 30)
  const burnWindowStart = windowStart.toISOString().slice(0, 10)

  // Run all DB queries in parallel, all wrapped in conservative catches
  const [burnResult, quotesResult, pilotsResult, approvalsResult, auditResult] =
    await Promise.allSettled([
      // 30-day burn
      platformDb
        .select({ total: sum(platformCostRollups.totalEstCostUsd).as('total') })
        .from(platformCostRollups)
        .where(gte(platformCostRollups.day, burnWindowStart))
        .then((r) => Number(r[0]?.total ?? 0)),
      // Open quotes value
      platformDb
        .select({
          cnt: count().as('cnt'),
          val: sum(commerceQuotes.total).as('val'),
        })
        .from(commerceQuotes)
        .where(eq(commerceQuotes.status, 'draft'))
        .then((r) => ({ cnt: Number(r[0]?.cnt ?? 0), val: Number(r[0]?.val ?? 0) })),
      // Active pilots
      platformDb
        .select({ cnt: count().as('cnt') })
        .from(pilotDefinitions)
        .where(eq(pilotDefinitions.status, 'active'))
        .then((r) => Number(r[0]?.cnt ?? 0)),
      // Pending approvals
      platformDb
        .select({ cnt: count().as('cnt') })
        .from(approvals)
        .where(eq(approvals.status, 'pending'))
        .then((r) => Number(r[0]?.cnt ?? 0)),
      // Last audit event
      platformDb
        .select({ createdAt: auditEvents.createdAt })
        .from(auditEvents)
        .orderBy(desc(auditEvents.createdAt))
        .limit(1)
        .then((r) => r[0]?.createdAt?.toISOString() ?? null),
    ])

  const burnLast30Usd = burnResult.status === 'fulfilled' ? burnResult.value : 0
  const burnDataAvailable = burnResult.status === 'fulfilled'
  const quotesData = quotesResult.status === 'fulfilled' ? quotesResult.value : { cnt: 0, val: 0 }
  const pipelineAvailable = quotesResult.status === 'fulfilled'
  const activePilotsCount = pilotsResult.status === 'fulfilled' ? pilotsResult.value : 0
  const pilotsAvailable = pilotsResult.status === 'fulfilled'
  const pendingApprovalsCount = approvalsResult.status === 'fulfilled' ? approvalsResult.value : 0
  const approvalsAvailable = approvalsResult.status === 'fulfilled'
  const lastAuditEventAt = auditResult.status === 'fulfilled' ? auditResult.value : null

  // Build alerts
  const alerts: Alert[] = []
  if (approvalsAvailable && pendingApprovalsCount > 0) {
    alerts.push({
      level: 'warning',
      message: `${pendingApprovalsCount} approval${pendingApprovalsCount === 1 ? '' : 's'} awaiting your sign-off`,
      href: '/business/approvals',
    })
  }
  if (burnDataAvailable && burnLast30Usd > 3000) {
    alerts.push({
      level: 'warning',
      message: `30-day platform spend: $${burnLast30Usd.toFixed(0)} USD — review cost allocation`,
      href: '/capital',
    })
  }
  if (pilotsAvailable && activePilotsCount === 0) {
    alerts.push({
      level: 'warning',
      message: 'No active pilots detected — revenue risk. Update pilot status or close.',
      href: '/revenue',
    })
  }
  if (lastAuditEventAt) {
    const daysAgo = Math.floor((Date.now() - new Date(lastAuditEventAt).getTime()) / 86400000)
    if (daysAgo > 14) {
      alerts.push({
        level: 'info',
        message: `Last governance audit event was ${daysAgo} days ago — check compliance.`,
        href: '/governance',
      })
    }
  }

  return {
    userName,
    dateLabel: label,
    weekNumber: week,
    burnLast30Usd,
    burnDataAvailable,
    openQuotesCount: quotesData.cnt,
    openQuotesValueCad: quotesData.val,
    pipelineAvailable,
    activePilotsCount,
    pilotsAvailable,
    pendingApprovalsCount,
    approvalsAvailable,
    lastAuditEventAt,
    topVentures,
    alerts,
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function alertBg(level: Alert['level']) {
  if (level === 'critical') return 'bg-red-50 border-red-300 text-red-800'
  if (level === 'warning') return 'bg-amber-50 border-amber-300 text-amber-800'
  return 'bg-blue-50 border-blue-300 text-blue-700'
}

function alertIcon(level: Alert['level']) {
  if (level === 'critical') return <ExclamationTriangleIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
  if (level === 'warning') return <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
  return <CheckCircleIcon className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
}

function ventureBadge(p: CatalogProduct) {
  if (p.status === 'pilot') return { label: 'SELL NOW', color: 'bg-emerald-100 text-emerald-700' }
  if (p.commercial_priority <= 3) return { label: 'BUILD NEXT', color: 'bg-blue-100 text-blue-700' }
  return { label: 'HOLD', color: 'bg-gray-100 text-gray-500' }
}

function codeColor(s: string) {
  if (s === 'full') return 'text-emerald-600'
  if (s === 'partial') return 'text-amber-600'
  return 'text-gray-400'
}

function evidenceColor(s: string) {
  if (s === 'complete') return 'text-emerald-600'
  if (s === 'partial') return 'text-amber-600'
  return 'text-red-500'
}

// ── Render ────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const firstName = user?.firstName ?? null
  const [data, executiveSummary, topActions] = await Promise.all([
    loadPulseData(firstName),
    getTodayExecutiveSummary(),
    getTopExecutionActions(5),
  ])

  const freshnessStatus = !data.burnDataAvailable || !data.pipelineAvailable || !data.pilotsAvailable
    ? 'manual'
    : data.lastAuditEventAt
      ? 'live'
      : 'weekly sync'

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {firstName ? `${firstName}'s Command Center` : 'Command Center'}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {data.dateLabel} &mdash; Week {data.weekNumber}
          </p>
        </div>
        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
          Nzila Ventures · CEO View
        </span>
        <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full ml-2">
          freshness: {freshnessStatus}
        </span>
      </div>

      <div className="rounded-2xl bg-gray-900 text-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold">This Week</p>
        <p className="text-2xl font-semibold mt-3 leading-tight">{executiveSummary.summarySentence}</p>
      </div>

      {/* ── Alerts Banner ── */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <Link
              key={i}
              href={alert.href}
              className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm font-medium hover:opacity-80 transition ${alertBg(alert.level)}`}
            >
              {alertIcon(alert.level)}
              <span>{alert.message}</span>
              <ArrowRightIcon className="h-4 w-4 ml-auto shrink-0 mt-0.5 opacity-50" />
            </Link>
          ))}
        </div>
      )}

      {/* ── Metric Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Burn */}
        <Link href="/capital" className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 hover:shadow-sm transition">
          <div className="flex items-center gap-2 mb-3">
            <BanknotesIcon className="h-5 w-5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">30d Burn</span>
          </div>
          {data.burnDataAvailable ? (
            <>
              <p className="text-2xl font-bold text-gray-900">${data.burnLast30Usd.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">USD · platform infra</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data yet</p>
          )}
        </Link>

        {/* Pipeline */}
        <Link href="/revenue" className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 hover:shadow-sm transition">
          <div className="flex items-center gap-2 mb-3">
            <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pipeline</span>
          </div>
          {data.pipelineAvailable ? (
            <>
              <p className="text-2xl font-bold text-gray-900">{data.openQuotesCount}</p>
              <p className="text-xs text-gray-400 mt-1">open quotes
                {data.openQuotesValueCad > 0 && ` · $${(data.openQuotesValueCad / 1000).toFixed(0)}k`}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data yet</p>
          )}
        </Link>

        {/* Active Pilots */}
        <Link href="/revenue" className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 hover:shadow-sm transition">
          <div className="flex items-center gap-2 mb-3">
            <BoltIcon className="h-5 w-5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active Pilots</span>
          </div>
          {data.pilotsAvailable ? (
            <>
              <p className={`text-2xl font-bold ${data.activePilotsCount > 0 ? 'text-gray-900' : 'text-red-500'}`}>
                {data.activePilotsCount}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.activePilotsCount > 0 ? 'orgs in live pilot' : 'no active pilots — revenue risk'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data yet</p>
          )}
        </Link>

        {/* Pending Approvals */}
        <Link href="/business/approvals" className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 hover:shadow-sm transition">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Approvals</span>
          </div>
          {data.approvalsAvailable ? (
            <>
              <p className={`text-2xl font-bold ${data.pendingApprovalsCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {data.pendingApprovalsCount}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.pendingApprovalsCount > 0 ? 'pending your sign-off' : 'queue is clear'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data yet</p>
          )}
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr_1fr_1fr] gap-4">
        <Link href="/runway" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 transition">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Runway</p>
          <p className={`text-2xl font-bold ${executiveSummary.runway.level === 'critical' ? 'text-red-600' : executiveSummary.runway.level === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {executiveSummary.runway.months.toFixed(1)} mo
          </p>
          <p className="text-xs text-gray-400 mt-1">Base case</p>
        </Link>
        <Link href="/focus" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 transition">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Founder Focus</p>
          <p className="text-sm font-semibold text-gray-900 line-clamp-3">
            {executiveSummary.focusWarning ?? 'Focus allocation is stable this week.'}
          </p>
        </Link>
        <Link href="/briefing" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 transition">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Top Decisions</p>
          <div className="space-y-1.5">
            {executiveSummary.weeklyDecisions.slice(0, 2).map((decision) => (
              <p key={decision} className="text-sm text-gray-700 line-clamp-2">{decision}</p>
            ))}
          </div>
        </Link>
        <Link href="/portfolio" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 transition">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ranking Shifts</p>
          <div className="space-y-1.5">
            {executiveSummary.rankingShifts.slice(0, 2).map((item) => (
              <p key={item} className="text-sm text-gray-700 line-clamp-2">{item}</p>
            ))}
          </div>
        </Link>
      </div>

      {/* ── Bottom Split: Ventures + Focus ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Venture Rank */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Venture Priorities</h2>
            </div>
            <Link href="/portfolio" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Full portfolio <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>

          {data.topVentures.length > 0 ? (
            <div className="space-y-3">
              {data.topVentures.map((v, i) => {
                const badge = ventureBadge(v)
                return (
                  <div key={v.name} className="flex items-start gap-3">
                    <span className="text-xs font-mono text-gray-300 w-4 mt-1 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800 text-sm capitalize">{v.name.replace(/-/g, ' ')}</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        <span className={`text-xs ${codeColor(v.code_presence)}`}>code: {v.code_presence}</span>
                        <span className={`text-xs ${evidenceColor(v.evidence_status)}`}>evidence: {v.evidence_status}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Product catalog not loaded.</p>
          )}
        </div>

        {/* This Week's Focus */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BoltIcon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">This Week&apos;s Top 5 Actions</h2>
            </div>
            <Link href="/execution" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              All initiatives <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>

          <ol className="space-y-3">
            {topActions.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${item.urgent ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{item.action}</p>
                  <span className="text-xs text-gray-400">{item.zone}</span>
                </div>
              </li>
            ))}
          </ol>

          {topActions.length === 0 && (
            <p className="text-sm text-gray-400 italic">No urgent initiatives for this week yet.</p>
          )}

          <p className="text-xs text-gray-300 mt-4 italic">Update weekly priorities in Execution.</p>
        </div>
      </div>

      {/* ── Quick Navigate ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Portfolio', href: '/portfolio', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
          { label: 'Revenue', href: '/revenue', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
          { label: 'Capital', href: '/capital', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
          { label: 'Execution', href: '/execution', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
          { label: 'Risk', href: '/risk', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
          { label: 'Governance', href: '/governance', color: 'text-gray-600 bg-gray-100 hover:bg-gray-200' },
        ].map((z) => (
          <Link
            key={z.label}
            href={z.href}
            className={`text-center py-3 px-2 rounded-xl text-sm font-semibold transition ${z.color}`}
          >
            {z.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
