/**
 * /chief-of-staff — Chief of Staff Agent surface
 *
 * Triggers an on-demand run of the Chief of Staff agent (Phase 1
 * reference implementation), shows the resulting insights, and links
 * to /actions for any draft actions awaiting approval.
 *
 * Inputs are read live from existing executive tables
 * (executionInitiatives, executiveDecisions, treasurySnapshots).
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, desc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  executionInitiatives,
  executiveDecisions,
  treasurySnapshots,
  founderTimeLogs,
  weeklyFocusTargets,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import { chiefOfStaffAgent, type ChiefOfStaffSignal } from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

async function loadSignal(orgId: string): Promise<ChiefOfStaffSignal> {
  const [initiatives, decisions, treasuries, weeklyLogsAgg, weeklyTargets] = await Promise.all([
    platformDb
      .select({
        id: executionInitiatives.id,
        title: executionInitiatives.title,
        status: executionInitiatives.status,
        urgent: executionInitiatives.urgent,
        dueDate: executionInitiatives.dueDate,
        owner: executionInitiatives.owner,
      })
      .from(executionInitiatives)
      .where(eq(executionInitiatives.orgId, orgId))
      .limit(50),
    platformDb
      .select({
        id: executiveDecisions.id,
        title: executiveDecisions.title,
        priority: executiveDecisions.priority,
        dueDate: executiveDecisions.dueDate,
      })
      .from(executiveDecisions)
      .where(and(eq(executiveDecisions.orgId, orgId), eq(executiveDecisions.status, 'proposed')))
      .orderBy(desc(executiveDecisions.createdAt))
      .limit(20),
    platformDb
      .select({
        cashOnHand: treasurySnapshots.cashOnHand,
      })
      .from(treasurySnapshots)
      .where(eq(treasurySnapshots.orgId, orgId))
      .orderBy(desc(treasurySnapshots.date))
      .limit(1),
    platformDb
      .select({ hours: founderTimeLogs.hours })
      .from(founderTimeLogs)
      .where(eq(founderTimeLogs.orgId, orgId))
      .limit(50),
    platformDb
      .select({ targetHours: weeklyFocusTargets.targetHours })
      .from(weeklyFocusTargets)
      .where(eq(weeklyFocusTargets.orgId, orgId))
      .limit(50),
  ])

  const weeklyHoursLogged = weeklyLogsAgg.reduce((s, r) => s + Number(r.hours ?? 0), 0)
  const weeklyHoursTarget = weeklyTargets.reduce((s, r) => s + Number(r.targetHours ?? 0), 0)
  const cashOnHand = treasuries[0] ? Number(treasuries[0].cashOnHand) : undefined

  return {
    initiatives: initiatives.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      urgent: i.urgent,
      dueDate: i.dueDate,
      owner: i.owner,
    })),
    decisionsAwaiting: decisions.map((d) => ({
      id: d.id,
      title: d.title,
      priority: d.priority,
      dueDate: d.dueDate,
    })),
    cashOnHand,
    weeklyHoursLogged: weeklyHoursLogged > 0 ? weeklyHoursLogged : undefined,
    weeklyHoursTarget: weeklyHoursTarget > 0 ? weeklyHoursTarget : undefined,
  }
}

export default async function ChiefOfStaffPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function handleRun() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(chiefOfStaffAgent, {
      orgId: o,
      actorId: u.id,
      triggeredBy: 'manual',
      input: signal,
    })
    revalidatePath('/chief-of-staff')
    revalidatePath('/actions')
  }

  // Most recent run + insights
  const lastRun = orgId
    ? (
        await platformDb
          .select()
          .from(executiveAgentRuns)
          .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'chief-of-staff')))
          .orderBy(desc(executiveAgentRuns.startedAt))
          .limit(1)
      )[0]
    : undefined

  const insights = lastRun
    ? await platformDb
        .select()
        .from(executiveAgentInsights)
        .where(eq(executiveAgentInsights.runId, lastRun.id))
        .orderBy(desc(executiveAgentInsights.severity))
    : []

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Chief of Staff</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Coordinates leadership priorities. Surfaces today's decisive next steps from
            initiatives, decisions, treasury, and founder time signals.
          </p>
        </div>
        <form action={handleRun}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Run now
          </button>
        </form>
      </header>

      {!orgId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No executive org resolved.
        </div>
      )}

      {orgId && !lastRun && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No runs yet. Click <strong>Run now</strong> to surface today's priorities.
        </div>
      )}

      {lastRun && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>
            <strong>Last run:</strong>{' '}
            {new Date(lastRun.startedAt).toLocaleString('en-CA')} ·{' '}
            <span className="text-slate-500">{lastRun.durationMs}ms · {lastRun.status}</span>
          </p>
          {lastRun.summary && <p className="mt-1 text-slate-600">{lastRun.summary}</p>}
        </section>
      )}

      <ul className="space-y-3">
        {insights.map((i) => (
          <li key={i.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>
                {i.severity}
              </span>
              <span className="text-xs text-slate-500">{i.domain}</span>
              <span className="text-xs text-slate-400">
                · confidence {Math.round((i.confidence ?? 0) * 100)}%
              </span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900">{i.title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{i.body}</p>
            {i.recommendedNextStep && (
              <p className="mt-2 text-xs text-slate-600">
                <strong>Next step:</strong> {i.recommendedNextStep}
              </p>
            )}
            {i.consequenceIfIgnored && (
              <p className="mt-1 text-xs text-rose-700">
                <strong>If ignored:</strong> {i.consequenceIfIgnored}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-slate-500">
        Pending draft actions appear in{' '}
        <a className="underline" href="/actions">
          /actions
        </a>{' '}
        for approval.
      </p>
    </main>
  )
}
