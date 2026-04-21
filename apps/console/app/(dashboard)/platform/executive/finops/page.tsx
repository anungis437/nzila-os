/**
 * /platform/executive/finops — FinOps agent surface.
 *
 * Aggregates MTD cost by category from platform_cost_rollups and compares
 * with same-day-of-month last month. Breaches from platform_cost_budget_breaches.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, gte, lte } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  platformCostRollups,
  platformCostBudgetBreaches,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  finopsAgent,
  type FinopsSignal,
  type CostCategoryTotal,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function loadSignal(orgId: string): Promise<FinopsSignal> {
  const today = new Date()
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const lastMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  const lastMonthSameDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, today.getUTCDate()))

  const mtdRows = await platformDb
    .select()
    .from(platformCostRollups)
    .where(
      and(
        eq(platformCostRollups.orgId, orgId),
        gte(platformCostRollups.day, isoDay(monthStart)),
        lte(platformCostRollups.day, isoDay(today)),
      ),
    )

  const lastMonthRows = await platformDb
    .select()
    .from(platformCostRollups)
    .where(
      and(
        eq(platformCostRollups.orgId, orgId),
        gte(platformCostRollups.day, isoDay(lastMonthStart)),
        lte(platformCostRollups.day, isoDay(lastMonthSameDay)),
      ),
    )

  const mtdMap = new Map<string, number>()
  for (const r of mtdRows) {
    mtdMap.set(r.category, (mtdMap.get(r.category) ?? 0) + (r.totalEstCostUsd ?? 0))
  }
  const lastMap = new Map<string, number>()
  for (const r of lastMonthRows) {
    lastMap.set(r.category, (lastMap.get(r.category) ?? 0) + (r.totalEstCostUsd ?? 0))
  }

  const categories: CostCategoryTotal[] = Array.from(
    new Set([...mtdMap.keys(), ...lastMap.keys()]),
  ).map((category) => ({
    category,
    mtdUsd: mtdMap.get(category) ?? 0,
    lastMonthSameDayUsd: lastMap.get(category),
  }))

  const breachRows = await platformDb
    .select()
    .from(platformCostBudgetBreaches)
    .where(eq(platformCostBudgetBreaches.orgId, orgId))
    .orderBy(desc(platformCostBudgetBreaches.recordedAt))
    .limit(5)

  return {
    categories,
    breaches: breachRows.map((b) => ({
      recordedAt: new Date(b.recordedAt).toISOString(),
      state: b.state,
      dailySpendUsd: b.dailySpendUsd ?? 0,
      monthlySpendUsd: b.monthlySpendUsd ?? 0,
      categoryBreaches: Array.isArray(b.categoryBreaches)
        ? (b.categoryBreaches as FinopsSignal['breaches'][number]['categoryBreaches'])
        : undefined,
    })),
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'finops')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function FinopsPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(finopsAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/platform/executive/finops')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">FinOps</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cloud / LLM / infra cost hygiene. Live vs <code>platform_cost_rollups</code> + <code>platform_cost_budget_breaches</code>.
        </p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/platform/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Platform</Link>
        <Link href="/platform/executive/reliability" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Reliability</Link>
        <Link href="/platform/executive/release-guard" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Release Guard</Link>
        <Link href="/platform/executive/security" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Security</Link>
      </nav>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">FinOps agent</h2>
            <p className="text-xs text-slate-500">Catch runaway cost before the invoice.</p>
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
