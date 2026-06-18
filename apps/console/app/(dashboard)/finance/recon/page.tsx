/**
 * /finance/recon — Controller agent surface.
 *
 * Loads open close periods, overdue tasks, and open exceptions from
 * the close governance tables and runs the controllerAgent.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, ne, lt, desc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  closePeriods,
  closeTasks,
  closeExceptions,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  controllerAgent,
  type ControllerSignal,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'
import { createLogger } from '@nzila/os-core/telemetry'

export const dynamic = 'force-dynamic'

const logger = createLogger('console.finance.recon')

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

async function loadSignal(orgId: string): Promise<ControllerSignal> {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  let periods: Array<typeof closePeriods.$inferSelect> = []
  try {
    periods = await platformDb
      .select()
      .from(closePeriods)
      .where(and(eq(closePeriods.orgId, orgId), ne(closePeriods.status, 'closed')))
  } catch (error) {
    logger.warn('recon periods load failed; returning empty fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { openPeriods: [], overdueTasks: [], openExceptions: [] }
  }

  const openPeriods = periods.map((p) => {
    const end = new Date(p.endDate)
    const days = Math.max(0, Math.floor((today.getTime() - end.getTime()) / 86_400_000))
    return {
      periodId: p.id,
      periodLabel: p.periodLabel,
      endDate: p.endDate,
      status: p.status as 'open' | 'in_progress' | 'pending_approval',
      daysSincePeriodEnd: days,
    }
  })

  const periodIdToLabel = new Map(periods.map((p) => [p.id, p.periodLabel] as const))

  const tasks = periods.length
    ? await platformDb
        .select()
        .from(closeTasks)
        .where(
          and(
            eq(closeTasks.orgId, orgId),
            ne(closeTasks.status, 'completed'),
            lt(closeTasks.dueDate, todayIso),
          ),
        )
    : []

  const overdueTasks = tasks
    .filter((t) => t.dueDate)
    .map((t) => {
      const due = new Date(t.dueDate as string)
      const days = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000))
      return {
        taskId: t.id,
        periodLabel: periodIdToLabel.get(t.periodId) ?? '—',
        taskName: t.taskName,
        assignedTo: t.assignedTo,
        daysOverdue: days,
      }
    })

  const exceptions = periods.length
    ? await platformDb
        .select()
        .from(closeExceptions)
        .where(and(eq(closeExceptions.orgId, orgId), eq(closeExceptions.status, 'open')))
    : []

  const openExceptions = exceptions.map((e) => {
    const created = new Date(e.createdAt)
    const age = Math.max(0, Math.floor((today.getTime() - created.getTime()) / 86_400_000))
    return {
      exceptionId: e.id,
      periodLabel: periodIdToLabel.get(e.periodId) ?? '—',
      title: e.title,
      severity: e.severity as 'low' | 'medium' | 'high' | 'critical',
      ageDays: age,
    }
  })

  return { openPeriods, overdueTasks, openExceptions }
}

export default async function ReconPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function runIt() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(controllerAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/finance/recon')
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
          .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'controller')))
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
      logger.warn('recon run history load failed; returning empty fallback', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Recon · Controller</h1>
          <p className="mt-2 text-sm text-slate-600">
            Close period health, overdue tasks, open exceptions. Reads from{' '}
            <code className="rounded bg-slate-100 px-1">close_periods</code>,{' '}
            <code className="rounded bg-slate-100 px-1">close_tasks</code>,{' '}
            <code className="rounded bg-slate-100 px-1">close_exceptions</code>.
          </p>
        </div>
        <form action={runIt}>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Run now
          </button>
        </form>
      </header>

      <Link href="/finance" className="mb-4 inline-block text-xs text-slate-500 hover:underline">← Finance hub</Link>

      {!orgId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No executive org resolved.</div>
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
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>{i.severity}</span>
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">{i.title}</h3>
            <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{i.body}</p>
            {i.recommendedNextStep && (
              <p className="mt-1 text-xs text-slate-600"><strong>Next:</strong> {i.recommendedNextStep}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
