/**
 * /platform/executive/reliability — Reliability agent surface.
 *
 * Loads open itsm_tickets + itsm_problems + aggregated route health from
 * platform_request_metrics (last 24h window, default SLOs: 1% error budget,
 * 1000ms p95 latency — override per-route later when an SLO table lands).
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, ne, inArray, gte, sql } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  itsmTickets,
  itsmProblems,
  platformRequestMetrics,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import { reliabilityAgent, type ReliabilitySignal, type RouteHealth } from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

// Default SLOs (applied to every route until a per-route SLO table exists)
const DEFAULT_ERROR_BUDGET_TARGET = 0.01 // 1% error rate
const DEFAULT_LATENCY_SLO_MS = 1000 // p95 1s
const METRICS_WINDOW_HOURS = 24
const MIN_REQUESTS_FOR_SLO = 20 // suppress noise from cold routes

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

type TicketPriority = 'p1_critical' | 'p2_high' | 'p3_medium' | 'p4_low'

async function loadRouteHealth(orgId: string): Promise<RouteHealth[]> {
  const since = new Date(Date.now() - METRICS_WINDOW_HOURS * 3600 * 1000)
  const rows = await platformDb
    .select({
      route: platformRequestMetrics.route,
      requestCount: sql<number>`count(*)::int`,
      errorCount: sql<number>`sum(case when ${platformRequestMetrics.statusCode} >= 500 then 1 else 0 end)::int`,
      p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${platformRequestMetrics.latencyMs}), 0)::int`,
    })
    .from(platformRequestMetrics)
    .where(
      and(
        eq(platformRequestMetrics.orgId, orgId),
        gte(platformRequestMetrics.recordedAt, since),
      ),
    )
    .groupBy(platformRequestMetrics.route)
    .having(sql`count(*) >= ${MIN_REQUESTS_FOR_SLO}`)

  return rows.map((r) => ({
    route: r.route,
    requestCount: Number(r.requestCount),
    errorRate: Number(r.requestCount) > 0 ? Number(r.errorCount) / Number(r.requestCount) : 0,
    p95LatencyMs: Number(r.p95LatencyMs),
    errorBudgetTarget: DEFAULT_ERROR_BUDGET_TARGET,
    latencySloMs: DEFAULT_LATENCY_SLO_MS,
  }))
}

async function loadSignal(orgId: string): Promise<ReliabilitySignal> {
  const now = new Date()

  const [tickets, openProblems, routes] = await Promise.all([
    platformDb
      .select()
      .from(itsmTickets)
      .where(
        and(
          eq(itsmTickets.orgId, orgId),
          ne(itsmTickets.status, 'resolved'),
          ne(itsmTickets.status, 'closed'),
        ),
      ),
    platformDb
      .select()
      .from(itsmProblems)
      .where(
        and(
          eq(itsmProblems.orgId, orgId),
          inArray(itsmProblems.status, [
            'open',
            'under_investigation',
            'known_error',
            'remediation_in_progress',
          ]),
        ),
      ),
    loadRouteHealth(orgId),
  ])

  const incidents = tickets.map((t) => ({
    ticketId: t.id,
    ticketNumber: t.ticketNumber,
    priority: t.priority as TicketPriority,
    status: t.status,
    ageHours: Math.max(0, Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 3_600_000)),
    slaBreached: t.slaBreached,
    title: t.title,
  }))

  const problemAges = openProblems
    .map((p) => Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / 86_400_000))
    .sort((a, b) => a - b)
  const p95 = problemAges.length
    ? problemAges[Math.min(problemAges.length - 1, Math.floor(problemAges.length * 0.95))]
    : undefined

  return {
    routes,
    incidents,
    openProblemsCount: openProblems.length,
    openProblemsAgeDaysP95: p95,
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'reliability')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function ReliabilityPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(reliabilityAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/platform/executive/reliability')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }
  const signal = orgId ? await loadSignal(orgId) : null
  const burningRoutes = signal?.routes.filter(
    (r) => r.errorBudgetTarget !== undefined && r.errorRate > r.errorBudgetTarget,
  ) ?? []
  const slowRoutes = signal?.routes.filter(
    (r) => r.latencySloMs !== undefined && r.p95LatencyMs > r.latencySloMs,
  ) ?? []

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Reliability</h1>
        <p className="mt-2 text-sm text-slate-600">
          SLO burn, incident load, root-cause debt. Live vs <code>itsm_tickets</code> + <code>itsm_problems</code>.
        </p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/platform/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Platform</Link>
        <Link href="/platform/executive/release-guard" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Release Guard</Link>
        <Link href="/platform/executive/finops" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">FinOps</Link>
        <Link href="/platform/executive/security" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Security</Link>
      </nav>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
        Route SLOs applied uniformly: <code>{(DEFAULT_ERROR_BUDGET_TARGET * 100).toFixed(1)}%</code> error budget, <code>{DEFAULT_LATENCY_SLO_MS}ms</code> p95. Window: last {METRICS_WINDOW_HOURS}h, min {MIN_REQUESTS_FOR_SLO} requests/route.
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Routes tracked</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{signal?.routes.length ?? 0}</p>
        </div>
        <div className={`rounded-lg border p-4 ${burningRoutes.length > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs uppercase tracking-wide text-slate-500">Burning budget</p>
          <p className={`mt-1 text-2xl font-semibold ${burningRoutes.length > 0 ? 'text-red-800' : 'text-slate-900'}`}>{burningRoutes.length}</p>
        </div>
        <div className={`rounded-lg border p-4 ${slowRoutes.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs uppercase tracking-wide text-slate-500">p95 over SLO</p>
          <p className={`mt-1 text-2xl font-semibold ${slowRoutes.length > 0 ? 'text-amber-800' : 'text-slate-900'}`}>{slowRoutes.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Open incidents</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{signal?.incidents.length ?? 0}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reliability agent</h2>
            <p className="text-xs text-slate-500">Protect the SLO; catch burn before users feel it.</p>
          </div>
          <form action={run}>
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">Run</button>
          </form>
        </div>
        {data.run ? (
          <p className="mt-2 text-xs text-slate-500">Last run {new Date(data.run.startedAt).toLocaleString('en-CA')} · {data.run.durationMs}ms · {data.run.status}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No runs yet.</p>
        )}
        <ul className="mt-4 space-y-3">
          {data.insights.length === 0 && data.run && <li className="text-sm text-slate-500">No insights from last run.</li>}
          {data.insights.map((i) => (
            <li key={i.id} className="rounded border border-slate-100 bg-slate-50/40 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>{i.severity}</span>
                <span className="text-xs text-slate-400">· confidence {Math.round((i.confidence ?? 0) * 100)}%</span>
              </div>
              <h3 className="mt-1 text-sm font-medium text-slate-900">{i.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{i.body}</p>
              {i.recommendedNextStep && <p className="mt-2 text-xs text-slate-500"><span className="font-medium">Next:</span> {i.recommendedNextStep}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
