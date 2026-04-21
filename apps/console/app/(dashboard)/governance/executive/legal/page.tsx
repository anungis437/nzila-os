/**
 * /governance/executive/legal — Legal agent surface.
 *
 * Live over filings + compliance_tasks + governance_actions.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  filings,
  complianceTasks,
  governanceActions,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  legalAgent,
  type LegalSignal,
  type FilingStatus,
  type FilingKind,
  type ComplianceTaskStatus,
  type ComplianceTaskKind,
  type GovernanceActionStatus,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

function daysFromToday(iso: string): number {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.round((new Date(iso).getTime() - today.getTime()) / 86_400_000)
}

async function loadSignal(orgId: string): Promise<LegalSignal> {
  const [filingRows, taskRows, actionRows] = await Promise.all([
    platformDb.select().from(filings).where(eq(filings.orgId, orgId)),
    platformDb.select().from(complianceTasks).where(eq(complianceTasks.orgId, orgId)),
    platformDb.select().from(governanceActions).where(eq(governanceActions.orgId, orgId)),
  ])

  const now = new Date()

  return {
    filings: filingRows.map((f) => ({
      filingId: f.id,
      kind: f.kind as FilingKind,
      status: f.status as FilingStatus,
      dueDate: f.dueDate,
      daysUntilDue: daysFromToday(f.dueDate),
    })),
    tasks: taskRows.map((t) => ({
      taskId: t.id,
      title: t.title,
      kind: t.kind as ComplianceTaskKind,
      status: t.status as ComplianceTaskStatus,
      dueDate: t.dueDate,
      daysUntilDue: daysFromToday(t.dueDate),
      hasEvidence: !!t.evidenceDocumentId,
    })),
    governanceActions: actionRows.map((a) => ({
      actionId: a.id,
      actionType: a.actionType,
      status: a.status as GovernanceActionStatus,
      ageDays: Math.max(0, Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / 86_400_000)),
    })),
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'legal')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function LegalPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(legalAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/governance/executive/legal')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Legal</h1>
        <p className="mt-2 text-sm text-slate-600">Filings, compliance tasks, governance action approvals.</p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/governance/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Governance</Link>
        <Link href="/governance/executive/audit" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Audit</Link>
        <Link href="/knowledge/steward" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Knowledge Steward</Link>
      </nav>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Legal agent</h2>
            <p className="text-xs text-slate-500">No late filings; no stalled governance decisions.</p>
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
