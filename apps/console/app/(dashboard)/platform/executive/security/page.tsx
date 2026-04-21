/**
 * /platform/executive/security — Security agent surface.
 *
 * Live vs `security_findings` + `security_waivers`. The existing
 * `security_posture_checks` table (check-shaped) is intentionally kept
 * untouched; a future pass may derive finding candidates from checks.
 *
 * Heuristics (explicit, conservative):
 *  - overdue = due_at < now AND status in {open, in_progress}
 *  - waiver expiring = 0 ≤ days_until_expiry ≤ 14 (default)
 *  - ownerless high/critical = severity in {high, critical} AND owner IS NULL
 *  - resolved / suppressed findings never participate in active queues
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, inArray } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  executiveAgentRuns,
  executiveAgentInsights,
  securityFindings,
  securityWaivers,
} from '@nzila/db/schema'
import { securityAgent, type SecuritySignal, type VulnFinding } from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

function coerceSeverity(s: string): VulnFinding['severity'] {
  return s === 'critical' || s === 'high' || s === 'medium' || s === 'low' ? s : 'medium'
}
function coerceStatus(s: string): VulnFinding['status'] {
  return s === 'open' || s === 'in_progress' || s === 'accepted_risk' || s === 'resolved' || s === 'suppressed'
    ? s
    : 'open'
}

async function loadSignal(orgId: string): Promise<{ signal: SecuritySignal; total: number }> {
  const findings = await platformDb
    .select()
    .from(securityFindings)
    .where(eq(securityFindings.organizationId, orgId))
    .limit(2000)

  const findingIds = findings.map((f) => f.id)
  const waivers =
    findingIds.length > 0
      ? await platformDb.select().from(securityWaivers).where(inArray(securityWaivers.findingId, findingIds))
      : []
  // Keep the latest waiver per finding.
  const waiverByFinding = new Map<string, typeof waivers[number]>()
  for (const w of waivers) {
    const cur = waiverByFinding.get(w.findingId)
    if (!cur || (w.createdAt && cur.createdAt && w.createdAt > cur.createdAt)) {
      waiverByFinding.set(w.findingId, w)
    } else if (!cur) {
      waiverByFinding.set(w.findingId, w)
    }
  }

  const now = Date.now()
  const items: VulnFinding[] = findings.map((f) => {
    const w = waiverByFinding.get(f.id)
    const status = coerceStatus(f.status)
    // Accepted-risk rows with an explicit waiver count as waived.
    // Without a waiver row, accepted_risk is informational-only; still treat
    // as waived to avoid double-escalating a decision already made.
    const waived = Boolean(w) || status === 'accepted_risk' || status === 'suppressed'
    const waiverExpiresAt = w?.expiresAt ? w.expiresAt.toISOString() : undefined
    const daysUntilWaiverExpires = w?.expiresAt
      ? Math.floor((new Date(w.expiresAt).getTime() - now) / 86_400_000)
      : undefined
    const daysUntilDue = f.dueAt
      ? Math.floor((new Date(f.dueAt).getTime() - now) / 86_400_000)
      : undefined
    return {
      advisoryId: f.fingerprint ?? f.id.slice(0, 8),
      packageName: f.title,
      severity: coerceSeverity(f.severity),
      affectedRange: f.affectedSurface ?? undefined,
      waived,
      waiverExpiresAt,
      daysUntilWaiverExpires,
      owner: f.owner ?? null,
      daysUntilDue,
      status,
    }
  })

  return {
    signal: {
      findings: items,
      // lastScanAt heuristic: most recent detected_at across all findings.
      lastScanAt: findings
        .map((f) => f.detectedAt)
        .filter((d): d is Date => d instanceof Date)
        .reduce<Date | null>((acc, d) => (acc && acc > d ? acc : d), null)
        ?.toISOString(),
    },
    total: findings.length,
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'security')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function SecurityPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()
  const loaded = orgId ? await loadSignal(orgId) : { signal: { findings: [] } as SecuritySignal, total: 0 }

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const { signal } = await loadSignal(o)
    await runAndPersist(securityAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/platform/executive/security')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  const openCritical = loaded.signal.findings.filter(
    (f) => !f.waived && f.severity === 'critical' && (f.status === 'open' || f.status === 'in_progress'),
  ).length
  const overdue = loaded.signal.findings.filter(
    (f) => !f.waived && f.daysUntilDue !== undefined && f.daysUntilDue < 0 && (f.status === 'open' || f.status === 'in_progress'),
  ).length
  const ownerless = loaded.signal.findings.filter(
    (f) => !f.waived && !f.owner && (f.severity === 'high' || f.severity === 'critical'),
  ).length

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Security</h1>
        <p className="mt-2 text-sm text-slate-600">
          Findings queue, waiver hygiene, owner accountability.
        </p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/platform/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Platform</Link>
        <Link href="/platform/executive/reliability" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Reliability</Link>
        <Link href="/platform/executive/release-guard" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Release Guard</Link>
        <Link href="/platform/executive/finops" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">FinOps</Link>
      </nav>

      <section className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Findings</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{loaded.total}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Open critical</div>
          <div className={`mt-1 text-2xl font-semibold ${openCritical > 0 ? 'text-red-700' : 'text-slate-900'}`}>{openCritical}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Overdue</div>
          <div className={`mt-1 text-2xl font-semibold ${overdue > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{overdue}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Ownerless high/crit</div>
          <div className={`mt-1 text-2xl font-semibold ${ownerless > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{ownerless}</div>
        </div>
      </section>

      {loaded.total === 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No <code>security_findings</code> rows for this org. Populate from{' '}
          <code>tooling/security/supply-chain-policy check-vulns</code>, Trivy, or manual review.
          Expected: <code>source, severity, status, title, affected_surface, owner, detected_at, due_at</code>.
          Add rows to <code>security_waivers</code> for explicit accepted risks.
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Security agent</h2>
            <p className="text-xs text-slate-500">No unknown critical exposure; every waiver has a clock.</p>
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
