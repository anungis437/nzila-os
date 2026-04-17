/**
 * Nzila OS — Capital Allocator
 *
 * Zone 4: CAPITAL — Burn, runway, and cost intelligence.
 * Answers: How much are we spending? On what? Can we survive the next 90 days?
 *          Where should we cut or double down?
 *
 * Data sources:
 *   - platformCostRollups       → 30d spend by app/category
 *   - platformCostBudgetBreaches → any active breaches
 *   - getCostDashboardData()    → existing aggregated dashboard (from lib/server-data)
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  platformCostRollups,
  platformCostBudgetBreaches,
} from '@nzila/db/schema'
import { sum, count, desc, gte, sql } from 'drizzle-orm'
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  FireIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppSpend {
  appId: string
  totalEstCostUsd: number
}

interface CategorySpend {
  category: string
  totalEstCostUsd: number
}

interface BreachRow {
  id: string
  orgId: string
  state: string
  dailySpendUsd: number
  monthlySpendUsd: number
  recordedAt: Date | null
}

interface CapitalData {
  total30dUsd: number
  dailyAvgUsd: number
  projected30dUsd: number
  byApp: AppSpend[]
  byCategory: CategorySpend[]
  breaches: BreachRow[]
  dataAvailable: boolean
  breachesAvailable: boolean
}

// ── Data ─────────────────────────────────────────────────────────────────────

function dayOffset(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

async function loadCapitalData(): Promise<CapitalData> {
  const since30 = dayOffset(30)

  const [rollupRes, breachRes] = await Promise.allSettled([
    Promise.all([
      // Total 30d
      platformDb
        .select({ total: sum(platformCostRollups.totalEstCostUsd).as('total') })
        .from(platformCostRollups)
        .where(gte(platformCostRollups.day, since30)),
      // By app
      platformDb
        .select({
          appId: platformCostRollups.appId,
          totalEstCostUsd: sum(platformCostRollups.totalEstCostUsd).as('total'),
        })
        .from(platformCostRollups)
        .where(gte(platformCostRollups.day, since30))
        .groupBy(platformCostRollups.appId)
        .orderBy(sql`sum(${platformCostRollups.totalEstCostUsd}) DESC`)
        .limit(10),
      // By category
      platformDb
        .select({
          category: platformCostRollups.category,
          totalEstCostUsd: sum(platformCostRollups.totalEstCostUsd).as('total'),
        })
        .from(platformCostRollups)
        .where(gte(platformCostRollups.day, since30))
        .groupBy(platformCostRollups.category)
        .orderBy(sql`sum(${platformCostRollups.totalEstCostUsd}) DESC`),
    ]),
    // Budget breaches — most recent 5
    platformDb
      .select({
        id: platformCostBudgetBreaches.id,
        orgId: platformCostBudgetBreaches.orgId,
        state: platformCostBudgetBreaches.state,
        dailySpendUsd: platformCostBudgetBreaches.dailySpendUsd,
        monthlySpendUsd: platformCostBudgetBreaches.monthlySpendUsd,
        recordedAt: platformCostBudgetBreaches.recordedAt,
      })
      .from(platformCostBudgetBreaches)
      .orderBy(desc(platformCostBudgetBreaches.recordedAt))
      .limit(5),
  ])

  const dataAvailable = rollupRes.status === 'fulfilled'
  const breachesAvailable = breachRes.status === 'fulfilled'

  const [totalRes, byAppRes, byCatRes] = dataAvailable
    ? rollupRes.value
    : [null, null, null]

  const total30dUsd = Number((totalRes as { total: string | null }[] | null)?.[0]?.total ?? 0)
  const dailyAvgUsd = total30dUsd / 30
  const projected30dUsd = dailyAvgUsd * 30

  const byApp: AppSpend[] = ((byAppRes as { appId: string; totalEstCostUsd: string | null }[] | null) ?? []).map(
    (r) => ({ appId: r.appId, totalEstCostUsd: Number(r.totalEstCostUsd ?? 0) }),
  )
  const byCategory: CategorySpend[] = ((byCatRes as { category: string; totalEstCostUsd: string | null }[] | null) ?? []).map(
    (r) => ({ category: r.category, totalEstCostUsd: Number(r.totalEstCostUsd ?? 0) }),
  )

  const breaches: BreachRow[] = breachesAvailable ? (breachRes.value as BreachRow[]) : []

  return {
    total30dUsd,
    dailyAvgUsd,
    projected30dUsd,
    byApp,
    byCategory,
    breaches,
    dataAvailable,
    breachesAvailable,
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function pct(val: number, total: number): string {
  if (total === 0) return '0%'
  return `${((val / total) * 100).toFixed(0)}%`
}

function barWidth(val: number, max: number): string {
  if (max === 0) return '0%'
  const w = Math.min(100, (val / max) * 100)
  return `${w}%`
}

function stateColor(state: string) {
  if (state === 'hard_block') return 'bg-red-100 text-red-700'
  if (state === 'soft_warn') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-500'
}

function categoryLabel(c: string) {
  const map: Record<string, string> = {
    compute_ms: 'Compute (ms)',
    db_query_ms: 'DB Queries (ms)',
    egress_kb: 'Egress (KB)',
    integration_call: 'Integration Calls',
    ai_token: 'AI Tokens',
  }
  return map[c] ?? c
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CapitalPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await loadCapitalData()
  const maxAppSpend = data.byApp[0]?.totalEstCostUsd ?? 0
  const maxCatSpend = data.byCategory[0]?.totalEstCostUsd ?? 0
  const freshnessStatus = !data.dataAvailable
    ? 'manual'
    : data.breachesAvailable
      ? 'live'
      : 'daily sync'

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <BanknotesIcon className="h-8 w-8 text-gray-300" />
            Capital
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Platform burn · Cost allocation · Budget health
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/cost" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Cost dashboard <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link href="/platform-economics" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Economics <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
            freshness: {freshnessStatus}
          </span>
        </div>
      </div>

      {/* Budget Breach Alert */}
      {data.breachesAvailable && data.breaches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <FireIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">
              {data.breaches.length} budget breach{data.breaches.length > 1 ? 'es' : ''} recorded
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              Latest: <strong>{data.breaches[0]!.state.replace('_', ' ')}</strong> — ${data.breaches[0]!.dailySpendUsd.toFixed(2)}/day · {formatDate(data.breaches[0]!.recordedAt)}
            </p>
          </div>
          <Link href="/cost" className="ml-auto text-xs text-red-500 hover:underline shrink-0">
            Review →
          </Link>
        </div>
      )}

      {/* Key Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">30d Total Spend</p>
          {data.dataAvailable ? (
            <>
              <p className="text-2xl font-bold text-gray-900">${data.total30dUsd.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">USD · platform infra</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Daily Average</p>
          {data.dataAvailable ? (
            <>
              <p className="text-2xl font-bold text-gray-900">${data.dailyAvgUsd.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">USD/day · 30d window</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Projected 30d</p>
          {data.dataAvailable ? (
            <>
              <p className="text-2xl font-bold text-gray-900">${data.projected30dUsd.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">USD · at current rate</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Budget Breaches</p>
          {data.breachesAvailable ? (
            <>
              <p className={`text-2xl font-bold ${data.breaches.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.breaches.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.breaches.length > 0 ? 'active breaches' : 'all clear'}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">No data</p>
          )}
        </div>
      </div>

      {/* Spend by App */}
      {data.byApp.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Spend by App (30 days)</h2>
          <div className="space-y-3">
            {data.byApp.map((a) => (
              <div key={a.appId} className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-600 w-28 shrink-0 truncate">{a.appId}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-blue-500 rounded-full"
                    style={{ width: barWidth(a.totalEstCostUsd, maxAppSpend) }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-20 text-right shrink-0">
                  ${a.totalEstCostUsd.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                  {pct(a.totalEstCostUsd, data.total30dUsd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : data.dataAvailable ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="font-semibold text-blue-800">No cost data in the last 30 days</p>
          <p className="text-sm text-blue-600 mt-1">Cost events are recorded as platform usage accumulates.</p>
        </div>
      ) : null}

      {/* Spend by Category */}
      {data.byCategory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Spend by Category (30 days)</h2>
          <div className="space-y-3">
            {data.byCategory.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-40 shrink-0 truncate">{categoryLabel(c.category)}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-emerald-500 rounded-full"
                    style={{ width: barWidth(c.totalEstCostUsd, maxCatSpend) }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-20 text-right shrink-0">
                  ${c.totalEstCostUsd.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                  {pct(c.totalEstCostUsd, data.total30dUsd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breach History */}
      {data.breachesAvailable && data.breaches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Budget Breaches</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase text-left">
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Daily Spend</th>
                <th className="px-4 py-3">Monthly Spend</th>
                <th className="px-4 py-3">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.breaches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateColor(b.state)}`}>
                      {b.state.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">${b.dailySpendUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">${b.monthlySpendUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(b.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Runway Heuristic */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-700 mb-3">Capital Decision Framework</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-semibold text-gray-800 mb-1">Burn Signal</p>
            <p className="text-gray-500 text-xs">
              {data.dataAvailable && data.dailyAvgUsd > 0
                ? `$${data.dailyAvgUsd.toFixed(2)}/day = $${(data.dailyAvgUsd * 30).toFixed(0)}/mo platform cost. Update manually with staff/contractors.`
                : 'No cost events recorded yet. Deploy and run the platform to accumulate burn data.'}
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Cut Signal</p>
            <p className="text-gray-500 text-xs">
              Any venture with no revenue and &gt;3mo of non-zero burn should be frozen or cut. Check Portfolio → HOLD ventures.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Double Down Signal</p>
            <p className="text-gray-500 text-xs">
              SELL NOW ventures (Union Eyes, Flow) with active pilots warrant increased infra investment. Budget separately.
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-3">
        <Link href="/revenue" className="text-sm text-gray-500 hover:text-gray-900">← Revenue</Link>
        <Link href="/execution" className="text-sm text-blue-600 hover:text-blue-800">Execution →</Link>
      </div>
    </div>
  )
}
