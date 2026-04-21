/**
 * /revenue/executive — ExecutiveOS RevOps surface
 *
 * Runs the RevOps agent over real commerce_opportunities data.
 * Links to /revenue/renewals, /revenue/partnerships, /revenue/grants.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, gte, lte, ne, desc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  commerceOpportunities,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import { revopsAgent, type RevOpsSignal, type RevOpsStage } from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

function quarterStart(now: Date): Date {
  const q = Math.floor(now.getUTCMonth() / 3)
  return new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1))
}

async function loadRevOpsSignal(orgId: string): Promise<RevOpsSignal> {
  const now = new Date()
  const qStart = quarterStart(now)

  const open = await platformDb
    .select()
    .from(commerceOpportunities)
    .where(and(eq(commerceOpportunities.orgId, orgId), ne(commerceOpportunities.status, 'closed_won')))

  const closedThisQuarter = await platformDb
    .select()
    .from(commerceOpportunities)
    .where(
      and(
        eq(commerceOpportunities.orgId, orgId),
        eq(commerceOpportunities.status, 'closed_won'),
        gte(commerceOpportunities.closedAt, qStart),
        lte(commerceOpportunities.closedAt, now),
      ),
    )

  const closedWonThisQuarter = closedThisQuarter.reduce(
    (s, o) => s + Number(o.estimatedValue ?? 0),
    0,
  )

  const openOpportunities = open.map((o) => {
    const days = Math.max(
      0,
      Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / 86_400_000),
    )
    return {
      opportunityId: o.id,
      title: o.title,
      estimatedValue: Number(o.estimatedValue ?? 0),
      stage: o.status as RevOpsStage,
      daysInStage: days,
      owner: null,
    }
  })

  const quarterlyTarget = Math.max(250_000, closedWonThisQuarter * 2)
  return { quarterlyTarget, closedWonThisQuarter, openOpportunities }
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

export default async function RevenueExecutivePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function runRevOps() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadRevOpsSignal(o)
    await runAndPersist(revopsAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/revenue/executive')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId, 'revops') : { run: null, insights: [] }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Revenue · ExecutiveOS</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pipeline coverage, stalled deals, renewals, partner activation, and
          grants. RevOps reads from{' '}
          <code className="rounded bg-slate-100 px-1">commerce_opportunities</code>.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/revenue" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          ← Cockpit
        </Link>
        <Link href="/revenue/renewals" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Renewals &amp; CS
        </Link>
        <Link href="/revenue/partnerships" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Partnerships
        </Link>
        <Link href="/revenue/grants" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Grants
        </Link>
      </nav>

      {!orgId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No executive org resolved.
        </div>
      )}

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Quarterly target is a heuristic (2× YTQ closed-won, floor $250k) until a{' '}
        <code>revenue_targets</code> table is wired.
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">RevOps</h2>
            <p className="text-xs text-slate-500">Pipeline coverage, stalled deals, stage mix.</p>
          </div>
          <form action={runRevOps}>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Run
            </button>
          </form>
        </div>
        {data.run ? (
          <p className="mt-2 text-xs text-slate-500">
            Last run {new Date(data.run.startedAt).toLocaleString('en-CA')} · {data.run.durationMs}ms · {data.run.status}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No runs yet.</p>
        )}
        <ul className="mt-4 space-y-3">
          {data.insights.length === 0 && data.run && (
            <li className="text-sm text-slate-500">No insights from last run.</li>
          )}
          {data.insights.map((i) => (
            <li key={i.id} className="rounded border border-slate-100 bg-slate-50/40 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>
                  {i.severity}
                </span>
                <span className="text-xs text-slate-400">
                  · confidence {Math.round((i.confidence ?? 0) * 100)}%
                </span>
              </div>
              <h3 className="mt-1 text-sm font-medium text-slate-900">{i.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{i.body}</p>
              {i.recommendedNextStep && (
                <p className="mt-2 text-xs text-slate-500">
                  <span className="font-medium">Next:</span> {i.recommendedNextStep}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
