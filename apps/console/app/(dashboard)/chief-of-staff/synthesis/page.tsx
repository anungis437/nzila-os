/**
 * /chief-of-staff/synthesis — Chief of Staff v2 (multi-agent synthesis).
 *
 * Reads all ExecutiveOS agents' recent insights + last-run summaries.
 * Emits an executive briefing: criticals, silent agents, recurring themes, net-new.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, gte } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  chiefOfStaffV2Agent,
  type CosV2Signal,
  type ExecutiveDomain,
  type Severity,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

const WINDOW_DAYS = 7

async function loadSignal(orgId: string): Promise<CosV2Signal> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000)

  // Recent insights in the window
  const insightRows = await platformDb
    .select({
      id: executiveAgentInsights.id,
      runId: executiveAgentInsights.runId,
      domain: executiveAgentInsights.domain,
      title: executiveAgentInsights.title,
      severity: executiveAgentInsights.severity,
      confidence: executiveAgentInsights.confidence,
      createdAt: executiveAgentInsights.createdAt,
      agentKey: executiveAgentRuns.agentKey,
    })
    .from(executiveAgentInsights)
    .innerJoin(executiveAgentRuns, eq(executiveAgentInsights.runId, executiveAgentRuns.id))
    .where(
      and(
        eq(executiveAgentRuns.orgId, orgId),
        gte(executiveAgentInsights.createdAt, windowStart),
      ),
    )
    .limit(2000)

  const recentInsights = insightRows
    .filter((r) => r.agentKey !== 'chief-of-staff-v2') // don't synthesize our own output
    .map((r) => ({
      agentKey: r.agentKey,
      domain: r.domain as ExecutiveDomain,
      title: r.title,
      severity: (r.severity ?? 'info') as Severity,
      confidence: r.confidence ?? 0.5,
      createdAt: new Date(r.createdAt).toISOString(),
    }))

  // Last-run per agentKey (excluding CoS v2 itself). Domain derived from
  // the latest insight per agent (runs table doesn't carry domain).
  const runRows = await platformDb
    .select({
      agentKey: executiveAgentRuns.agentKey,
      startedAt: executiveAgentRuns.startedAt,
    })
    .from(executiveAgentRuns)
    .where(eq(executiveAgentRuns.orgId, orgId))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(500)

  const latestByAgent = new Map<string, Date>()
  for (const r of runRows) {
    if (r.agentKey === 'chief-of-staff-v2') continue
    if (!latestByAgent.has(r.agentKey)) latestByAgent.set(r.agentKey, new Date(r.startedAt))
  }

  const agentDomainMap = new Map<string, ExecutiveDomain>()
  for (const r of insightRows) {
    if (!agentDomainMap.has(r.agentKey)) agentDomainMap.set(r.agentKey, r.domain as ExecutiveDomain)
  }

  const agentRuns = Array.from(latestByAgent.entries()).map(([agentKey, startedAt]) => ({
    agentKey,
    domain: agentDomainMap.get(agentKey) ?? ('executive' as ExecutiveDomain),
    lastRunAt: startedAt.toISOString(),
    ageDays: Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 86_400_000)),
  }))

  // Previous synthesis criticals — last v2 run's critical-titled insights
  const [prevV2Run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'chief-of-staff-v2')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)

  let previousCriticalTitles: string[] = []
  if (prevV2Run) {
    const prev = await platformDb
      .select()
      .from(executiveAgentInsights)
      .where(
        and(eq(executiveAgentInsights.runId, prevV2Run.id), eq(executiveAgentInsights.severity, 'critical')),
      )
    previousCriticalTitles = prev.map((p) => p.title)
  }

  return { recentInsights, agentRuns, previousCriticalTitles, silentAgentDays: 7 }
}

async function lastSynthesis(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'chief-of-staff-v2')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function SynthesisPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(chiefOfStaffV2Agent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/chief-of-staff/synthesis')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastSynthesis(orgId) : { run: null, insights: [] }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Chief of Staff — Synthesis</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cross-agent executive briefing. {WINDOW_DAYS}-day window.
        </p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/chief-of-staff" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Chief of Staff</Link>
        <Link href="/actions" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Actions queue</Link>
      </nav>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Synthesis agent</h2>
            <p className="text-xs text-slate-500">One briefing, every domain.</p>
          </div>
          <form action={run}>
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">Run</button>
          </form>
        </div>
        {data.run ? (
          <p className="mt-2 text-xs text-slate-500">
            Last run {new Date(data.run.startedAt).toLocaleString('en-CA')} · {data.run.durationMs}ms · {data.run.status}
            {data.run.summary ? ` — ${data.run.summary}` : ''}
          </p>
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
