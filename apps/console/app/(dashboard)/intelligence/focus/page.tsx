/**
 * /intelligence/focus — Founder Focus Engine.
 *
 * Combines the learning-loop ranked recommendations with weekly time
 * allocation (weeklyFocusTargets + founderTimeLogs) to answer a single
 * question: "With N hours left this week, what should I actually work on?"
 *
 * Draws from:
 *  - executive_recommendations (status='open', ordered by rank_score desc)
 *  - getFounderFocusData() — per-venture targets, logged hours, drag metrics
 *
 * Produces a cut-line: recommendations above the cut-line fit within
 * remaining capacity; below is context for next week.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { and, desc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { executiveRecommendations } from '@nzila/db/schema'
import { getFounderFocusData } from '@/lib/executive-intelligence'

export const dynamic = 'force-dynamic'

const BUCKET_BADGE: Record<string, string> = {
  now: 'bg-red-100 text-red-800',
  today: 'bg-orange-100 text-orange-800',
  this_week: 'bg-amber-100 text-amber-800',
  this_month: 'bg-slate-100 text-slate-700',
  backlog: 'bg-slate-50 text-slate-500',
}

// Rough time-cost heuristic per bucket so we can carve a cut-line against
// available capacity. Tunable later via NIL capability params.
const BUCKET_COST_HOURS: Record<string, number> = {
  now: 4,
  today: 3,
  this_week: 2,
  this_month: 1,
  backlog: 1,
}

export default async function FounderFocusEnginePage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const focus = await getFounderFocusData()
  const orgId = focus.executiveOrgId

  const openRecs = orgId
    ? await platformDb
        .select({
          id: executiveRecommendations.id,
          title: executiveRecommendations.title,
          narrative: executiveRecommendations.narrative,
          rankScore: executiveRecommendations.rankScore,
          rankBucket: executiveRecommendations.rankBucket,
          kind: executiveRecommendations.kind,
          domains: executiveRecommendations.domains,
        })
        .from(executiveRecommendations)
        .where(
          and(
            eq(executiveRecommendations.orgId, orgId),
            eq(executiveRecommendations.status, 'open'),
          ),
        )
        .orderBy(desc(executiveRecommendations.rankScore))
        .limit(50)
    : []

  // Capacity model:
  //  target = sum of weeklyFocusTargets for this week
  //  logged = focus.totalHours7
  //  remaining = max(0, target - logged) OR fall back to 40 - logged
  const targetTotal = focus.currentWeekTargets.reduce((s, t) => s + t.targetHours, 0)
  const capacity = targetTotal > 0 ? targetTotal : 40
  const remainingHours = Math.max(0, capacity - focus.totalHours7)

  // Carve cut-line greedily.
  let cumulativeHours = 0
  const abovePlan: typeof openRecs = []
  const belowPlan: typeof openRecs = []
  for (const rec of openRecs) {
    const cost = BUCKET_COST_HOURS[rec.rankBucket] ?? 2
    if (cumulativeHours + cost <= remainingHours) {
      abovePlan.push(rec)
      cumulativeHours += cost
    } else {
      belowPlan.push(rec)
    }
  }

  const criticalAlerts = focus.alerts.filter((a) => a.level === 'critical' || a.level === 'warning')

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-slate-500">Executive Intelligence</p>
        <h1 className="text-3xl font-semibold text-slate-900">Founder Focus Engine</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Ranked recommendations, sliced against your remaining weekly capacity.
          Everything above the cut-line fits in the hours you have left; everything below
          is context for next week&rsquo;s planning.
        </p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Capacity</p>
          <p className="mt-1 text-2xl font-semibold">{capacity.toFixed(0)}h</p>
          <p className="text-[10px] text-slate-400">
            {targetTotal > 0 ? 'from weekly targets' : 'default 40h'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Logged (7d)</p>
          <p className="mt-1 text-2xl font-semibold">{focus.totalHours7.toFixed(1)}h</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{remainingHours.toFixed(1)}h</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Admin drag</p>
          <p className="mt-1 text-2xl font-semibold">
            {focus.adminDragPct.toFixed(0)}%
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Deep-work score</p>
          <p className="mt-1 text-2xl font-semibold">{focus.deepWorkScore.toFixed(0)}</p>
        </div>
      </section>

      {criticalAlerts.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Capacity signals
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {criticalAlerts.map((a, i) => (
              <li key={i}>· {a.message}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          This week&rsquo;s plan — {abovePlan.length} items · ~{cumulativeHours}h
        </h2>
        {abovePlan.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {orgId
              ? remainingHours === 0
                ? 'No remaining capacity this week. Protect recovery time.'
                : 'No open recommendations. Run cross-domain synthesis first.'
              : 'No executive org resolved for this user.'}
          </div>
        ) : (
          <ol className="space-y-3">
            {abovePlan.map((r, i) => {
              const cost = BUCKET_COST_HOURS[r.rankBucket] ?? 2
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">0{i + 1}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${BUCKET_BADGE[r.rankBucket]}`}
                        >
                          {r.rankBucket.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] uppercase text-slate-400">
                          {r.kind}
                        </span>
                        <span className="text-xs text-slate-500">
                          score {r.rankScore.toFixed(0)} · ~{cost}h
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{r.title}</h3>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{r.narrative}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {belowPlan.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Deferred to next week — {belowPlan.length} items
          </h2>
          <ul className="space-y-2">
            {belowPlan.slice(0, 10).map((r) => (
              <li
                key={r.id}
                className="rounded border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 flex items-center justify-between gap-3"
              >
                <span className="truncate">{r.title}</span>
                <span className="text-xs text-slate-400 shrink-0">
                  {r.rankBucket.replace('_', ' ')} · {r.rankScore.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {focus.ventureRows.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Per-venture allocation
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Venture</th>
                  <th className="px-4 py-2 text-right">Target (wk)</th>
                  <th className="px-4 py-2 text-right">Logged (7d)</th>
                  <th className="px-4 py-2 text-right">Gap</th>
                </tr>
              </thead>
              <tbody>
                {focus.ventureRows.slice(0, 8).map((row) => (
                  <tr key={row.ventureId} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{row.ventureName}</td>
                    <td className="px-4 py-2 text-right">{row.targetHours.toFixed(0)}h</td>
                    <td className="px-4 py-2 text-right">{row.hours7.toFixed(1)}h</td>
                    <td
                      className={`px-4 py-2 text-right ${row.focusGapHours > 0 ? 'text-amber-700' : 'text-emerald-700'}`}
                    >
                      {row.focusGapHours > 0 ? '+' : ''}
                      {row.focusGapHours.toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="mt-10 flex items-center gap-4 text-xs text-slate-400">
        <Link href="/intelligence/risks" className="underline hover:text-slate-600">
          Risks →
        </Link>
        <Link href="/intelligence/opportunities" className="underline hover:text-slate-600">
          Opportunities →
        </Link>
        <Link href="/focus" className="underline hover:text-slate-600">
          Log time →
        </Link>
      </footer>
    </main>
  )
}
