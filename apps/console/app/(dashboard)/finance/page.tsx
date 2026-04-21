/**
 * /finance — ExecutiveOS Finance hub
 *
 * Runs Internal CFO + Treasury agents over real data from
 * treasury_snapshots + runway_assumptions, and shows the most recent
 * insights side by side. Collections lives at /finance/collections.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  treasurySnapshots,
  runwayAssumptions,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  internalCfoAgent,
  treasuryAgent,
  type CfoSignal,
  type TreasurySignal,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

async function loadCfoSignal(orgId: string): Promise<CfoSignal | null> {
  const [snaps, assumptions] = await Promise.all([
    platformDb
      .select()
      .from(treasurySnapshots)
      .where(eq(treasurySnapshots.orgId, orgId))
      .orderBy(desc(treasurySnapshots.date))
      .limit(3),
    platformDb
      .select()
      .from(runwayAssumptions)
      .where(eq(runwayAssumptions.orgId, orgId))
      .limit(1),
  ])

  if (snaps.length === 0) return null
  const latest = snaps[0]!
  const a = assumptions[0]
  // Without explicit monthly burn we approximate from delta between snapshots.
  const monthlyNetBurn: number[] = []
  for (let i = 0; i < snaps.length - 1; i++) {
    const newer = Number(snaps[i]!.cashOnHand)
    const older = Number(snaps[i + 1]!.cashOnHand)
    monthlyNetBurn.unshift(Math.max(older - newer, 0))
  }
  if (monthlyNetBurn.length === 0) monthlyNetBurn.push(0)

  return {
    cashOnHand: Number(latest.cashOnHand),
    restrictedCash: Number(latest.restrictedCash),
    monthlyNetBurn,
    monthlyRevenue: a ? [Number(a.expectedMonthlyRevenue)] : [0],
    accountsReceivable: Number(latest.receivables),
    payablesDue30d: Number(latest.liabilitiesDue30d),
    discretionarySpendMonthly: a ? Number(a.discretionarySpend) : undefined,
    plannedHires: undefined,
    raiseRunwayThresholdMonths: 9,
  }
}

async function loadTreasurySignal(orgId: string): Promise<TreasurySignal | null> {
  const [latest] = await platformDb
    .select()
    .from(treasurySnapshots)
    .where(eq(treasurySnapshots.orgId, orgId))
    .orderBy(desc(treasurySnapshots.date))
    .limit(1)

  if (!latest) return null

  const cashToday = Number(latest.cashOnHand)
  // Without a real 13-week forecast yet, build a synthetic trough projection
  // from receivables in vs liabilities out, evenly distributed.
  const receivables = Number(latest.receivables)
  const liabilities30d = Number(latest.liabilitiesDue30d)
  const weeklyIn = receivables / 13
  const weeklyOutBase = liabilities30d / 4 // 4 weeks for 30-day liabilities
  const weeks = Array.from({ length: 13 }, (_, i) => ({
    weekStart: new Date(Date.now() + i * 7 * 86_400_000).toISOString().slice(0, 10),
    inflows: weeklyIn,
    outflows: i < 4 ? weeklyOutBase : weeklyOutBase * 0.5,
  }))

  return {
    cashToday,
    minimumReserve: Math.max(cashToday * 0.1, 50_000),
    weeks,
  }
}

async function lastInsights(orgId: string, agentKey: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, agentKey)))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function FinancePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function runCfo() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadCfoSignal(o)
    if (!signal) return
    await runAndPersist(internalCfoAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/finance')
    revalidatePath('/actions')
  }

  async function runTreasury() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadTreasurySignal(o)
    if (!signal) return
    await runAndPersist(treasuryAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/finance')
    revalidatePath('/actions')
  }

  const [cfo, treasury] = orgId
    ? await Promise.all([lastInsights(orgId, 'internal-cfo'), lastInsights(orgId, 'treasury')])
    : [{ run: null, insights: [] }, { run: null, insights: [] }]

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Finance</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cash, runway, burn, AR/AP. Internal CFO and Treasury agents read
            from <code className="rounded bg-slate-100 px-1">treasury_snapshots</code> and{' '}
            <code className="rounded bg-slate-100 px-1">runway_assumptions</code>.
          </p>
        </div>
        <Link
          href="/finance/collections"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Collections →
        </Link>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/finance/recon" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Recon (Controller)
        </Link>
        <Link href="/finance/fpa" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          FP&amp;A
        </Link>
        <Link href="/finance/compliance" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Tax / Compliance
        </Link>
      </nav>

      {!orgId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No executive org resolved.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <AgentColumn
          title="Internal CFO"
          subtitle="Runway, burn, raise readiness"
          run={cfo.run}
          insights={cfo.insights}
          action={runCfo}
        />
        <AgentColumn
          title="Treasury"
          subtitle="13-week cash trough & concentration"
          run={treasury.run}
          insights={treasury.insights}
          action={runTreasury}
        />
      </div>
    </main>
  )
}

function AgentColumn({
  title,
  subtitle,
  run,
  insights,
  action,
}: {
  title: string
  subtitle: string
  run: typeof executiveAgentRuns.$inferSelect | null
  insights: Array<typeof executiveAgentInsights.$inferSelect>
  action: () => Promise<void>
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <form action={action}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Run
          </button>
        </form>
      </div>
      {run ? (
        <p className="mt-2 text-xs text-slate-500">
          Last run {new Date(run.startedAt).toLocaleString('en-CA')} · {run.durationMs}ms · {run.status}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No runs yet.</p>
      )}

      <ul className="mt-4 space-y-3">
        {insights.length === 0 && run && (
          <li className="text-sm text-slate-500">No insights from last run.</li>
        )}
        {insights.map((i) => (
          <li key={i.id} className="rounded border border-slate-100 bg-slate-50/40 p-3">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>
                {i.severity}
              </span>
              <span className="text-xs text-slate-400">
                · confidence {Math.round((i.confidence ?? 0) * 100)}%
              </span>
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">{i.title}</h3>
            <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{i.body}</p>
            {i.recommendedNextStep && (
              <p className="mt-1 text-xs text-slate-600">
                <strong>Next:</strong> {i.recommendedNextStep}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
