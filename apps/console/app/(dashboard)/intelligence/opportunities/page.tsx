/**
 * /intelligence/opportunities — Cross-Domain Opportunity Radar.
 *
 * Mirror of /intelligence/risks but filtered to `kind === 'opportunity'`
 * (grant opportunities elevated by tight runway, portfolio drag → pause
 * recommendations, etc.).
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
  now: 'bg-emerald-100 text-emerald-800',
  today: 'bg-emerald-100 text-emerald-800',
  this_week: 'bg-sky-100 text-sky-800',
  this_month: 'bg-slate-100 text-slate-700',
  backlog: 'bg-slate-50 text-slate-500',
}

export default async function IntelligenceOpportunitiesPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()
  const signal = orgId
    ? await loadSynthesisSignal(orgId)
    : { runwayMonths: null, accounts: [], incidents: [], grants: [], portfolio: [] }
  const opps: RankedFinding[] = synthesizeFindings(signal).filter((f) => f.kind === 'opportunity')

  async function runSynthesis() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const s = await loadSynthesisSignal(o)
    const { runId } = await runAndPersist(crossDomainSynthesisAgent, {
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
    await takePrioritySnapshot({ orgId: o, extraMetrics: { runId } })
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
    revalidatePath('/intelligence/opportunities')
    revalidatePath('/intelligence/risks')
    revalidatePath('/briefing')
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Executive Intelligence</p>
          <h1 className="text-3xl font-semibold text-slate-900">Opportunity Radar</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Cross-domain opportunities: grants elevated by runway pressure,
            portfolio drag flagged for pause, expansion plays.
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

      {opps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No cross-domain opportunities detected at current thresholds.
        </div>
      ) : (
        <ul className="space-y-4">
          {opps.map((o) => {
            const topFactors = o.rank.explanation.slice(0, 3)
            return (
              <li key={o.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${BUCKET_BADGE[o.rank.bucket]}`}
                  >
                    {o.rank.bucket.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500">
                    Score {o.rank.score.toFixed(1)} · conf {(o.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-slate-400">· {o.domains.join(' + ')}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{o.title}</h2>
                <p className="mt-1 text-sm text-slate-700">{o.narrative}</p>
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
                    ['accept', 'Pursue', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
                    ['mark_high_impact', 'High impact', 'bg-indigo-50 text-indigo-700 border-indigo-200'],
                    ['postpone', 'Later', 'bg-amber-50 text-amber-700 border-amber-200'],
                    ['mark_wrong', 'Not an opportunity', 'bg-slate-50 text-slate-600 border-slate-200'],
                    ['reject', 'Pass', 'bg-rose-50 text-rose-700 border-rose-200'],
                  ] as const).map(([verdict, label, cls]) => (
                    <form key={verdict} action={submitFeedback}>
                      <input type="hidden" name="dedupeKey" value={o.id} />
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
        <Link href="/intelligence/risks" className="underline hover:text-slate-600">
          ← View risks
        </Link>
      </footer>
    </main>
  )
}
