/**
 * /ops/coo — COO agent surface.
 *
 * Loads: execution_initiatives + itsm_tickets (open, non-closed) +
 * customer_onboarding_milestones (pending, with due-date heuristic).
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, notInArray } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  executionInitiatives,
  itsmTickets,
  customerOnboardingMilestones,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  cooAgent,
  type CooSignal,
  type InitiativeStatus,
  type CooTicket,
  type CooMilestone,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

// itsm_priority (p1_critical..p4_low) → COO priority (p0..p3)
const PRIO_MAP: Record<string, CooTicket['priority']> = {
  p1_critical: 'p0',
  p2_high: 'p1',
  p3_medium: 'p2',
  p4_low: 'p3',
}

// itsm_ticket_status → CooTicket status bucket
function bucketStatus(s: string): CooTicket['status'] {
  if (s === 'resolved') return 'resolved'
  if (s === 'closed') return 'closed'
  if (s === 'in_progress' || s === 'waiting_user' || s === 'waiting_vendor') return 'in_progress'
  return 'open' // new | triage | assigned | reopened
}

async function loadSignal(orgId: string): Promise<CooSignal> {
  const now = new Date()
  const [inits, tickets, milestoneRows] = await Promise.all([
    platformDb.select().from(executionInitiatives).where(eq(executionInitiatives.orgId, orgId)),
    platformDb
      .select()
      .from(itsmTickets)
      .where(
        and(
          eq(itsmTickets.orgId, orgId),
          notInArray(itsmTickets.status, ['resolved', 'closed']),
        ),
      )
      .limit(500),
    platformDb
      .select()
      .from(customerOnboardingMilestones)
      .where(eq(customerOnboardingMilestones.organizationId, orgId))
      .limit(500),
  ])

  // Milestones: schema has no dueDate column. Use 14-day onboarding SLA from
  // created_at as the implied due date; daysLate accumulates beyond that for
  // non-completed rows.
  const ONBOARDING_SLA_DAYS = 14
  const milestones: CooMilestone[] = milestoneRows.map((m) => {
    const createdAt = m.createdAt ? new Date(m.createdAt) : now
    const due = new Date(createdAt.getTime() + ONBOARDING_SLA_DAYS * 86_400_000)
    const completed = m.completedAt ? new Date(m.completedAt) : null
    const daysLate =
      completed || m.status === 'completed' || m.status === 'skipped'
        ? 0
        : Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000))
    return {
      id: m.id,
      label: m.milestone,
      dueDate: due.toISOString(),
      completedAt: completed ? completed.toISOString() : null,
      daysLate,
    }
  })

  return {
    initiatives: inits.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as InitiativeStatus,
      dueDate: r.dueDate,
      owner: r.owner,
      ageDays: Math.max(0, Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86_400_000)),
    })),
    openTickets: tickets.map((t) => ({
      id: t.id,
      title: t.title,
      priority: PRIO_MAP[t.priority] ?? 'p2',
      status: bucketStatus(t.status),
      ageDays: Math.max(0, Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 86_400_000)),
      breachedSla: t.slaBreached,
    })),
    milestones,
    stalledInitiativeDays: 21,
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'coo')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function CooPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(cooAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/ops/coo')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">COO</h1>
        <p className="mt-2 text-sm text-slate-600">Cross-functional operating health. Live vs <code>execution_initiatives</code> + <code>itsm_tickets</code> + <code>customer_onboarding_milestones</code>.</p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/ops" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Ops</Link>
        <Link href="/portfolio/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Portfolio</Link>
        <Link href="/chief-of-staff/synthesis" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Chief of Staff v2</Link>
      </nav>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">COO agent</h2>
            <p className="text-xs text-slate-500">Execution flowing. No stalled initiatives, no SLA breaches.</p>
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
