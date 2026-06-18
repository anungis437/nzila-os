/**
 * /finance/fpa — FP&A agent surface.
 *
 * Live signal: budget_lines (exec-data bridge). Each row carries planned +
 * actual for a given period/category; rows are grouped by category into
 * FpaLine histories before running fpaAgent.
 *
 * Heuristic notes (explicit and conservative):
 *  - Variance = (actual - planned) / |planned|; zero planned + non-zero
 *    actual is treated as 100% over.
 *  - "Persistent variance" = same category over threshold for N consecutive
 *    periods (default N=3). Period ordering is by period_key ascending.
 *  - Missing actuals are surfaced by omission from the signal; a separate
 *    route-level banner flags categories with active periods but no actual.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, asc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { executiveAgentRuns, executiveAgentInsights, budgetLines } from '@nzila/db/schema'
import { fpaAgent, type FpaSignal } from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'
import { createLogger } from '@nzila/os-core/telemetry'

export const dynamic = 'force-dynamic'

const logger = createLogger('console.finance.fpa')

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

async function loadSignal(orgId: string): Promise<{ signal: FpaSignal; rowCount: number; missingActuals: number }> {
  let rows: Array<typeof budgetLines.$inferSelect> = []
  try {
    rows = await platformDb
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.organizationId, orgId))
      .orderBy(asc(budgetLines.category), asc(budgetLines.periodKey))
  } catch (error) {
    logger.warn('fpa signal load failed; returning empty fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { signal: { lines: [] }, rowCount: 0, missingActuals: 0 }
  }

  if (rows.length === 0) return { signal: { lines: [] }, rowCount: 0, missingActuals: 0 }

  // Group by (category, budgetType, subcategory, productKey) to form a line with period history.
  const grouped = new Map<
    string,
    { label: string; category: 'revenue' | 'expense' | 'other'; entries: Array<{ period: string; budget: number; actual: number }> }
  >()
  let missingActuals = 0
  for (const r of rows) {
    const key = `${r.budgetType}::${r.category}::${r.subcategory ?? ''}::${r.productKey ?? ''}`
    const category: 'revenue' | 'expense' | 'other' =
      r.budgetType === 'revenue' ? 'revenue' : r.budgetType === 'opex' || r.budgetType === 'capex' ? 'expense' : 'other'
    const label = [r.category, r.subcategory].filter(Boolean).join(' / ')
    const actualNum = r.actualAmount === null ? null : Number(r.actualAmount)
    if (actualNum === null) missingActuals += 1
    const existing = grouped.get(key)
    const entry = { period: r.periodKey, budget: Number(r.plannedAmount), actual: actualNum ?? 0 }
    if (existing) existing.entries.push(entry)
    else grouped.set(key, { label, category, entries: [entry] })
  }

  const lines = Array.from(grouped.entries()).map(([lineId, g]) => ({
    lineId,
    label: g.label,
    category: g.category,
    history: g.entries,
  }))

  return { signal: { lines }, rowCount: rows.length, missingActuals }
}

export default async function FpaPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()
  const loaded = orgId ? await loadSignal(orgId) : { signal: { lines: [] } as FpaSignal, rowCount: 0, missingActuals: 0 }

  async function runIt() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const { signal } = await loadSignal(o)
    await runAndPersist(fpaAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/finance/fpa')
    revalidatePath('/actions')
  }

  let lastRun: typeof executiveAgentRuns.$inferSelect | undefined
  let insights: Array<typeof executiveAgentInsights.$inferSelect> = []
  if (orgId) {
    try {
      lastRun = (
        await platformDb
          .select()
          .from(executiveAgentRuns)
          .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'fpa')))
          .orderBy(desc(executiveAgentRuns.startedAt))
          .limit(1)
      )[0]

      if (lastRun) {
        insights = await platformDb
          .select()
          .from(executiveAgentInsights)
          .where(eq(executiveAgentInsights.runId, lastRun.id))
      }
    } catch (error) {
      logger.warn('fpa run history load failed; returning empty fallback', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">FP&amp;A</h1>
          <p className="mt-2 text-sm text-slate-600">
            Budget vs actual variance with persistence detection.
          </p>
        </div>
        <form action={runIt}>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Run now
          </button>
        </form>
      </header>

      <Link href="/finance" className="mb-4 inline-block text-xs text-slate-500 hover:underline">← Finance hub</Link>

      <section className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Budget rows</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{loaded.rowCount}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Grouped lines</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{loaded.signal.lines.length}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Rows missing actuals</div>
          <div className={`mt-1 text-2xl font-semibold ${loaded.missingActuals > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {loaded.missingActuals}
          </div>
        </div>
      </section>

      {loaded.rowCount === 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No <code>budget_lines</code> rows for this org yet. Seed via your planning process or
          import. Expected columns: <code>fiscal_year, period_key, budget_type, category,
          planned_amount, actual_amount</code>.
        </div>
      )}

      {lastRun && (
        <p className="mb-4 text-xs text-slate-500">
          Last run {new Date(lastRun.startedAt).toLocaleString('en-CA')} · {lastRun.summary ?? '—'}
        </p>
      )}

      <ul className="space-y-3">
        {insights.length === 0 && lastRun && <li className="text-sm text-slate-500">No insights from last run.</li>}
        {insights.map((i) => (
          <li key={i.id} className="rounded border border-slate-200 bg-white p-4">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>{i.severity}</span>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">{i.title}</h3>
            <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{i.body}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
