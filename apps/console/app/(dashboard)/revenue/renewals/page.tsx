/**
 * /revenue/renewals — CS / Renewal agent surface.
 *
 * Live vs `cs_accounts` (exec-data bridge). We compute derived days-until
 * fields at load time so the agent stays pure.
 *
 * Heuristics (explicit, conservative):
 *  - renewal window = 90d (default)
 *  - quiet-touch risk = > 21d since sponsor_last_contact_at for yellow/red
 *  - expansion candidate = health=green AND expansion_signal=true
 *  - support-heavy = open_support_count informs risk narrative via tickets
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, asc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  executiveAgentRuns,
  executiveAgentInsights,
  csAccounts,
} from '@nzila/db/schema'
import { csRenewalAgent, type CsSignal } from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

type HealthScore = 'green' | 'yellow' | 'red'
type UsageTrend = 'up' | 'flat' | 'down'

function coerceHealth(h: string | null | undefined): HealthScore {
  if (h === 'red' || h === 'yellow' || h === 'green') return h
  return 'yellow'
}
function coerceUsage(u: string | null | undefined): UsageTrend | undefined {
  if (u === 'up' || u === 'flat' || u === 'down') return u
  return undefined
}

async function loadSignal(orgId: string): Promise<{ signal: CsSignal; total: number }> {
  const rows = await platformDb
    .select()
    .from(csAccounts)
    .where(eq(csAccounts.organizationId, orgId))
    .orderBy(asc(csAccounts.renewalDate))
    .limit(1000)

  const now = Date.now()
  const accounts: CsSignal['accounts'] = rows.map((r) => {
    const daysUntilRenewal = r.renewalDate
      ? Math.floor((new Date(r.renewalDate).getTime() - now) / 86_400_000)
      : undefined
    const lastTouchDaysAgo = r.sponsorLastContactAt
      ? Math.floor((now - new Date(r.sponsorLastContactAt).getTime()) / 86_400_000)
      : undefined
    return {
      customerId: r.id,
      customerName: r.clientName,
      arr: r.contractValue === null ? 0 : Number(r.contractValue),
      renewalDate: r.renewalDate ?? undefined,
      daysUntilRenewal,
      healthScore: coerceHealth(r.healthScore),
      lastTouchDaysAgo,
      openTickets: r.openSupportCount ?? 0,
      usageTrend: coerceUsage(r.usageState),
      expansionSignal: r.expansionSignal ?? false,
    }
  })

  return { signal: { accounts }, total: rows.length }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'cs-renewal')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function RenewalsPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()
  const loaded = orgId ? await loadSignal(orgId) : { signal: { accounts: [] } as CsSignal, total: 0 }

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const { signal } = await loadSignal(o)
    await runAndPersist(csRenewalAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/revenue/renewals')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  const redCount = loaded.signal.accounts.filter((a) => a.healthScore === 'red').length
  const upcoming90 = loaded.signal.accounts.filter(
    (a) => a.daysUntilRenewal !== undefined && a.daysUntilRenewal >= 0 && a.daysUntilRenewal <= 90,
  ).length

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Renewals &amp; CS</h1>
        <p className="mt-2 text-sm text-slate-600">
          Account health, upcoming renewals, churn risk, expansion signals.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/revenue/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          ← RevOps
        </Link>
        <Link href="/revenue/partnerships" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Partnerships
        </Link>
        <Link href="/revenue/grants" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Grants
        </Link>
      </nav>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Accounts</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{loaded.total}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Renewals in 90d</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{upcoming90}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Red accounts</div>
          <div className={`mt-1 text-2xl font-semibold ${redCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>{redCount}</div>
        </div>
      </section>

      {loaded.total === 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No <code>cs_accounts</code> rows for this org yet. Seed via your CS platform export or
          manual entry. Expected: <code>client_name, renewal_date, health_score,
          sponsor_last_contact_at, open_support_count, usage_state</code>.
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">CS / Renewal</h2>
            <p className="text-xs text-slate-500">Protect retained ARR before the renewal clock runs out.</p>
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
    </main>
  )
}
