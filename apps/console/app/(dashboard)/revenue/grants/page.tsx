/**
 * /revenue/grants — Grants agent surface.
 *
 * Live vs `grants` + `grant_reports` (new schema). We derive days-until
 * fields here so the agent stays pure and testable.
 *
 * Heuristics (explicit, conservative):
 *  - underdrawn = stage in {awarded, reporting} AND drawnDownAmount < 50%
 *    of awarded amount. If no drawdown tracking yet, the signal is skipped.
 *  - missed application = stage=drafting AND applicationDeadline < today
 *  - upcoming application = stage=drafting AND 0 ≤ daysUntilAppDue ≤ 45
 *  - late report = stage=reporting AND reportDueDate < today
 *    (either from grants.report_due_date or from earliest pending grant_reports row)
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, asc, inArray, isNull } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  executiveAgentRuns,
  executiveAgentInsights,
  grants as grantsTable,
  grantReports,
} from '@nzila/db/schema'
import { grantsAgent, type GrantsSignal, type Grant, type GrantStage } from '@nzila/executive-os'
import { CommandPageShell } from '@/components/command-page-shell'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

const VALID_STAGES: GrantStage[] = [
  'prospecting',
  'drafting',
  'submitted',
  'awarded',
  'reporting',
  'closed',
  'rejected',
]

function coerceStage(s: string): GrantStage {
  return (VALID_STAGES as string[]).includes(s) ? (s as GrantStage) : 'prospecting'
}

async function loadSignal(orgId: string): Promise<{ signal: GrantsSignal; total: number }> {
  const rows = await platformDb
    .select()
    .from(grantsTable)
    .where(eq(grantsTable.organizationId, orgId))
    .orderBy(asc(grantsTable.applicationDeadline))
    .limit(500)

  // Earliest pending report per grant (status != submitted/accepted).
  const grantIds = rows.map((g) => g.id)
  const pendingReports =
    grantIds.length > 0
      ? await platformDb
          .select()
          .from(grantReports)
          .where(
            and(
              inArray(grantReports.grantId, grantIds),
              isNull(grantReports.submittedAt),
            ),
          )
      : []

  const nextReportByGrant = new Map<string, Date>()
  for (const r of pendingReports) {
    const due = new Date(r.dueDate)
    const cur = nextReportByGrant.get(r.grantId)
    if (!cur || due < cur) nextReportByGrant.set(r.grantId, due)
  }

  const now = Date.now()
  const items: Grant[] = rows.map((g) => {
    const stage = coerceStage(g.status)
    const awarded = g.amountAwarded === null ? null : Number(g.amountAwarded)
    const requested = g.amountRequested === null ? null : Number(g.amountRequested)
    const amount = awarded ?? requested ?? 0
    const drawn = g.amountDrawnDown === null ? undefined : Number(g.amountDrawnDown)
    const appDue = g.applicationDeadline ? new Date(g.applicationDeadline) : undefined
    const daysUntilAppDue = appDue ? Math.floor((appDue.getTime() - now) / 86_400_000) : undefined
    const rowReportDue = g.reportDueDate ? new Date(g.reportDueDate) : undefined
    const nextChildReportDue = nextReportByGrant.get(g.id)
    const effectiveReportDue =
      rowReportDue && nextChildReportDue
        ? rowReportDue < nextChildReportDue
          ? rowReportDue
          : nextChildReportDue
        : (rowReportDue ?? nextChildReportDue)
    const daysUntilReportDue = effectiveReportDue
      ? Math.floor((effectiveReportDue.getTime() - now) / 86_400_000)
      : undefined

    return {
      grantId: g.id,
      program: g.programName,
      stage,
      amount,
      currency: g.currency ?? undefined,
      applicationDueDate: g.applicationDeadline ?? undefined,
      daysUntilAppDue,
      reportDueDate: effectiveReportDue ? effectiveReportDue.toISOString().slice(0, 10) : undefined,
      daysUntilReportDue,
      awardedAt: g.decisionDate ?? undefined,
      drawnDownAmount: drawn,
      owner: g.owner,
    }
  })

  return { signal: { grants: items }, total: rows.length }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'grants')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function GrantsPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()
  const loaded = orgId ? await loadSignal(orgId) : { signal: { grants: [] } as GrantsSignal, total: 0 }

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const { signal } = await loadSignal(o)
    await runAndPersist(grantsAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/revenue/grants')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  const drafting = loaded.signal.grants.filter((g) => g.stage === 'drafting').length
  const awarded = loaded.signal.grants.filter((g) => g.stage === 'awarded' || g.stage === 'reporting').length
  const lateApps = loaded.signal.grants.filter(
    (g) => g.stage === 'drafting' && g.daysUntilAppDue !== undefined && g.daysUntilAppDue < 0,
  ).length

  return (
    <CommandPageShell className="space-y-6">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Grants</h1>
        <p className="mt-2 text-sm text-slate-600">
          Non-dilutive capital pipeline. Watches deadlines and reporting hygiene.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/revenue/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          ← RevOps
        </Link>
        <Link href="/revenue/renewals" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Renewals &amp; CS
        </Link>
        <Link href="/revenue/partnerships" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Partnerships
        </Link>
      </nav>

      <section className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Pipeline</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{loaded.total}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Drafting</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{drafting}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Awarded / reporting</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{awarded}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Missed apps</div>
          <div className={`mt-1 text-2xl font-semibold ${lateApps > 0 ? 'text-red-700' : 'text-slate-900'}`}>{lateApps}</div>
        </div>
      </section>

      {loaded.total === 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No <code>grants</code> rows for this org. Expected columns:{' '}
          <code>program_name, status, amount_requested, amount_awarded, application_deadline,
          report_due_date, owner</code>. Add child <code>grant_reports</code> for per-report due dates.
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Grants</h2>
            <p className="text-xs text-slate-500">Never miss a deadline; draw down what we have been awarded.</p>
          </div>
          <form action={run}>
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
    </CommandPageShell>
  )
}
