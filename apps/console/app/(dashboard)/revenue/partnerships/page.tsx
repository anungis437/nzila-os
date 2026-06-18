/**
 * /revenue/partnerships — Partnerships agent surface.
 *
 * Reads real partner deals (partners.deals) and commissions
 * (partners.commissions) and runs the partnerships agent.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { CommandPageShell } from '@/components/command-page-shell'
import {
  deals,
  commissions,
  partners,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  partnershipsAgent,
  type PartnershipsSignal,
  type PartnerDealStage,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

async function loadSignal(): Promise<PartnershipsSignal> {
  const now = new Date()

  const dealRows = await platformDb
    .select({
      id: deals.id,
      partnerName: partners.companyName,
      accountName: deals.accountName,
      stage: deals.stage,
      estimatedArr: deals.estimatedArr,
      updatedAt: deals.updatedAt,
      lockedUntil: deals.lockedUntil,
      nzilaReviewerId: deals.nzilaReviewerId,
    })
    .from(deals)
    .leftJoin(partners, eq(deals.partnerId, partners.id))

  const commissionRows = await platformDb
    .select({
      id: commissions.id,
      partnerName: partners.companyName,
      amount: commissions.amount,
      status: commissions.status,
      createdAt: commissions.createdAt,
    })
    .from(commissions)
    .leftJoin(partners, eq(commissions.partnerId, partners.id))

  return {
    deals: dealRows.map((d) => {
      const days = Math.max(0, Math.floor((now.getTime() - new Date(d.updatedAt).getTime()) / 86_400_000))
      const daysUntilLockExpires = d.lockedUntil
        ? Math.floor((new Date(d.lockedUntil).getTime() - now.getTime()) / 86_400_000)
        : null
      return {
        dealId: d.id,
        partnerName: d.partnerName ?? '(unknown partner)',
        accountName: d.accountName,
        stage: d.stage as PartnerDealStage,
        estimatedArr: Number(d.estimatedArr ?? 0),
        daysInStage: days,
        lockedUntil: d.lockedUntil ? new Date(d.lockedUntil).toISOString() : null,
        daysUntilLockExpires,
        hasReviewer: Boolean(d.nzilaReviewerId),
      }
    }),
    commissions: commissionRows.map((c) => ({
      commissionId: c.id,
      partnerName: c.partnerName ?? '(unknown partner)',
      amount: Number(c.amount ?? 0),
      status: c.status as 'pending' | 'earned' | 'paid' | 'cancelled',
      ageDays: Math.max(0, Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / 86_400_000)),
    })),
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'partnerships')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function PartnershipsPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal()
    await runAndPersist(partnershipsAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/revenue/partnerships')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  return (
    <CommandPageShell className="space-y-6">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Partnerships</h1>
        <p className="mt-2 text-sm text-slate-600">
          Partner deal registry, review SLAs, deal-protection lock hygiene,
          commission payouts.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/revenue/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          ← RevOps
        </Link>
        <Link href="/revenue/renewals" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Renewals &amp; CS
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

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Partnerships</h2>
            <p className="text-xs text-slate-500">Keep partner deals moving and payouts on time.</p>
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
