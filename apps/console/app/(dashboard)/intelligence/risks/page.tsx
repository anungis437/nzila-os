/**
 * /intelligence/risks — Cross-Domain Risk Radar.
 *
 * Loads a live SynthesisSignal, runs crossDomainSynthesisAgent, persists
 * run + ranked recommendations, then renders risks ordered by rank score.
 *
 * Narrative-first: each card shows the score, bucket, top explanation
 * factors, and the human narrative (not just raw signal dumps).
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentUser } from '@nzila/platform-auth/entra/server'
import {
  crossDomainSynthesisAgent,
  synthesizeFindings,
  type RankedFinding,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../lib/executive-os'
import { loadSynthesisSignal } from '../../../../lib/executive-intelligence-signal'
import {
  persistRankedFindings,
  recordRecommendationFeedbackByDedupeKey,
  takePrioritySnapshot,
} from '../../../../lib/executive-recommendation-memory'

export const dynamic = 'force-dynamic'

const BUCKET_BADGE: Record<string, string> = {
  now: 'bg-red-100 text-red-800',
  today: 'bg-orange-100 text-orange-800',
  this_week: 'bg-amber-100 text-amber-800',
  this_month: 'bg-slate-100 text-slate-700',
  backlog: 'bg-slate-50 text-slate-500',
}

function fmtCad(n: number | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

export default async function IntelligenceRisksPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()
  const signal = orgId
    ? await loadSynthesisSignal(orgId)
    : { runwayMonths: null, accounts: [], incidents: [], grants: [], portfolio: [] }
  const allFindings = synthesizeFindings(signal)
  const risks: RankedFinding[] = allFindings.filter((f) => f.kind === 'risk')

  async function runSynthesis() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const s = await loadSynthesisSignal(o)
    const { runId, result } = await runAndPersist(crossDomainSynthesisAgent, {
      orgId: o,
      actorId: u.id,
      triggeredBy: 'manual',
      input: s,
    })
    const findings = synthesizeFindings(s)
    await persistRankedFindings({
      orgId: o,
      sourceAgent: 'cross-domain-synthesis',
      sourceRunId: runId,
      findings,
    })
    await takePrioritySnapshot({
      orgId: o,
      extraMetrics: {
        runId,
        insightCount: result.insights.length,
        actionCount: result.actions.length,
      },
    })
    revalidatePath('/intelligence/risks')
    revalidatePath('/intelligence/opportunities')
    revalidatePath('/actions')
  }

  async function submitFeedback(formData: FormData) {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const dedupeKey = String(formData.get('dedupeKey') ?? '')
    const verdict = String(formData.get('verdict') ?? '') as
      | 'accept' | 'reject' | 'postpone' | 'modify' | 'mark_wrong' | 'mark_high_impact'
    if (!dedupeKey || !verdict) return
    await recordRecommendationFeedbackByDedupeKey({
      orgId: o,
      dedupeKey,
      actorId: u.id,
      verdict,
    })
    revalidatePath('/intelligence/risks')
    revalidatePath('/intelligence/opportunities')
    revalidatePath('/briefing')
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Executive Intelligence</p>
          <h1 className="text-3xl font-semibold text-slate-900">Cross-Domain Risk Radar</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Compound risks that no single-domain agent can see — churn stacked with support burden,
            AR overdue on unhealthy accounts, incidents on premium clients, runway pressure.
          </p>
        </div>
        <form action={runSynthesis}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-700"
          >
            Run synthesis
          </button>
        </form>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Active risks</p>
          <p className="mt-1 text-2xl font-semibold">{risks.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Now bucket</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">
            {risks.filter((r) => r.rank.bucket === 'now').length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Runway (months)</p>
          <p className="mt-1 text-2xl font-semibold">
            {signal.runwayMonths === null ? '—' : signal.runwayMonths.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Accounts tracked</p>
          <p className="mt-1 text-2xl font-semibold">{signal.accounts.length}</p>
        </div>
      </section>

      {risks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No compound risks detected at current thresholds.
          <br />
          Either the system is healthy, or upstream signal (cs_accounts, erp_invoices) is sparse.
        </div>
      ) : (
        <ul className="space-y-4">
          {risks.map((r) => {
            const topFactors = r.rank.explanation.slice(0, 3)
            const estimatedValue = typeof r.evidence.contractValueCad === 'number'
              ? (r.evidence.contractValueCad as number)
              : undefined
            return (
              <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${BUCKET_BADGE[r.rank.bucket]}`}
                      >
                        {r.rank.bucket.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-500">
                        Score {r.rank.score.toFixed(1)} · conf {(r.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-xs text-slate-400">
                        · {r.domains.join(' + ')}
                      </span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-slate-900">{r.title}</h2>
                    <p className="mt-1 text-sm text-slate-700">{r.narrative}</p>
                  </div>
                  {estimatedValue !== undefined && (
                    <div className="text-right">
                      <p className="text-xs uppercase text-slate-500">At stake</p>
                      <p className="text-lg font-semibold text-slate-900">{fmtCad(estimatedValue)}</p>
                    </div>
                  )}
                </div>
                {topFactors.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {topFactors.map((f) => (
                      <li key={f.factor} className="rounded bg-slate-100 px-2 py-1">
                        {f.factor}: {f.contribution >= 0 ? '+' : ''}
                        {f.contribution.toFixed(1)}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="self-center text-[10px] uppercase tracking-wide text-slate-400">
                    Train the loop:
                  </span>
                  {([
                    ['accept', 'Accept', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
                    ['mark_high_impact', 'High impact', 'bg-indigo-50 text-indigo-700 border-indigo-200'],
                    ['postpone', 'Postpone', 'bg-amber-50 text-amber-700 border-amber-200'],
                    ['mark_wrong', 'Not a risk', 'bg-slate-50 text-slate-600 border-slate-200'],
                    ['reject', 'Reject', 'bg-rose-50 text-rose-700 border-rose-200'],
                  ] as const).map(([verdict, label, cls]) => (
                    <form key={verdict} action={submitFeedback}>
                      <input type="hidden" name="dedupeKey" value={r.id} />
                      <input type="hidden" name="verdict" value={verdict} />
                      <button
                        type="submit"
                        className={`rounded-full border px-3 py-1 font-medium hover:opacity-80 ${cls}`}
                      >
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <footer className="mt-10 text-xs text-slate-400">
        <Link href="/intelligence/opportunities" className="underline hover:text-slate-600">
          View opportunities →
        </Link>
      </footer>
    </main>
  )
}
