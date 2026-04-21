/**
 * /governance/executive/audit — Audit agent surface.
 *
 * Live signal over evidence_packs.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  evidencePacks,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  auditAgent,
  type AuditSignal,
  type ControlFamily,
  type PackStatus,
  type ChainIntegrity,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

async function loadSignal(orgId: string): Promise<AuditSignal> {
  const now = new Date()
  const rows = await platformDb
    .select()
    .from(evidencePacks)
    .where(eq(evidencePacks.orgId, orgId))
    .orderBy(desc(evidencePacks.createdAt))
    .limit(200)

  return {
    packs: rows.map((p) => ({
      packId: p.packId,
      controlFamily: p.controlFamily as ControlFamily,
      eventType: p.eventType,
      status: p.status as PackStatus,
      chainIntegrity: p.chainIntegrity as ChainIntegrity,
      allHashesVerified: p.allHashesVerified,
      artifactCount: p.artifactCount,
      ageDays: Math.max(0, Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / 86_400_000)),
      verifiedAt: p.verifiedAt ? new Date(p.verifiedAt).toISOString() : undefined,
    })),
    requiredFamilies: ['access', 'change-mgmt', 'incident-response', 'dr-bcp', 'integrity', 'sdlc', 'retention'],
    coverageWindowDays: 90,
    draftSealSlaDays: 14,
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'audit')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function AuditPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(auditAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/governance/executive/audit')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Audit</h1>
        <p className="mt-2 text-sm text-slate-600">Evidence-pack chain integrity + control-family coverage. Live vs <code>evidence_packs</code>.</p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/governance/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Governance</Link>
        <Link href="/governance/executive/legal" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Legal</Link>
        <Link href="/knowledge/steward" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Knowledge Steward</Link>
      </nav>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Audit agent</h2>
            <p className="text-xs text-slate-500">Keep the evidence chain unbroken.</p>
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
