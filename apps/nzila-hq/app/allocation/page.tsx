/**
 * Capital Allocation — Phase 5.
 *
 * Surfaces the deterministic output of `computeAllocation()` so the founder
 * can see, in one screen, where to invest more, where to hold, and where to
 * restructure / pause / exit. Every recommendation is defensible: the axis
 * scores and reason strings are the audit trail.
 */
import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { Badge } from '@/components/primitives/Badge'
import { EmptyState } from '@/components/primitives/EmptyState'
import { fmtCompactCurrency } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'
import type { AllocationRecommendation } from '@nzila/hq-domain'

export const dynamic = 'force-dynamic'

const REC_LABEL: Record<AllocationRecommendation, string> = {
  'invest-more': 'Invest more',
  hold: 'Hold',
  restructure: 'Restructure',
  pause: 'Pause',
  exit: 'Exit',
}

const REC_TONE: Record<AllocationRecommendation, 'emerald' | 'sky' | 'amber' | 'rose' | 'slate'> = {
  'invest-more': 'emerald',
  hold: 'sky',
  restructure: 'amber',
  pause: 'rose',
  exit: 'slate',
}

export default async function AllocationPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:allocation')

  const repo = getHqRepository()
  const scores = repo.allocationScores()
  const summary = repo.allocationSummary()
  const ventures = repo.listVentures()
  const venturesBySlug = new Map(ventures.map((v) => [v.slug, v]))
  const deltas = repo.allocationDelta()
  const movers = deltas
    .filter((d) => d.compositeDelta != null && Math.abs(d.compositeDelta) >= 3)
    .sort((a, b) => Math.abs(b.compositeDelta!) - Math.abs(a.compositeDelta!))
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Phase 5 · Capital Allocation"
        title="Allocate capital like an investor."
        description="Composite scores per venture across six axes — revenue, pipeline, margin, fit, founder load, confidence. Recommendations are deterministic and defensible: every reason is shown."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Avg. composite" value={`${summary.averageComposite}/100`} />
        <Stat label="Invest more" value={summary.byRecommendation['invest-more']} tone="green" />
        <Stat label="Hold" value={summary.byRecommendation.hold} />
        <Stat label="Restructure" value={summary.byRecommendation.restructure} tone="amber" />
        <Stat label="Pause" value={summary.byRecommendation.pause} tone="amber" />
        <Stat label="Exit" value={summary.byRecommendation.exit} tone="red" />
      </div>

      <Card
        title="Movement since last review"
        description="Composite changes vs the prior allocation pass. Recommendation flips are highlighted."
      >
        {movers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No material movement (≥3 composite points) since last review. Stability is a feature.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {movers.map((d) => {
              const v = venturesBySlug.get(d.ventureSlug)
              const tone =
                d.recommendationChanged
                  ? 'amber'
                  : (d.compositeDelta ?? 0) > 0
                    ? 'green'
                    : 'rose'
              return (
                <li
                  key={d.ventureSlug}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-slate-900">
                      <span className="font-medium">{v?.name ?? d.ventureSlug}</span>{' '}
                      <span className="text-xs text-slate-500">
                        {d.compositeBefore ?? '—'} → {d.compositeAfter}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">{d.headline}</div>
                  </div>
                  <Badge tone={tone === 'green' ? 'emerald' : tone === 'rose' ? 'rose' : 'amber'}>
                    {(d.compositeDelta ?? 0) > 0 ? '+' : ''}
                    {d.compositeDelta ?? 0}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Recommendation by venture"
        description="Sorted by composite score (highest first). Click a venture for full detail."
      >
        {scores.length === 0 ? (
          <EmptyState title="No ventures scored yet" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Venture</th>
                  <th className="px-4 py-2 text-right">Composite</th>
                  <th className="px-4 py-2 text-left">Recommendation</th>
                  <th className="px-4 py-2 text-right">MRR</th>
                  <th className="px-4 py-2 text-right">Weighted pipe</th>
                  <th className="px-4 py-2 text-left">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {scores.map((s) => {
                  const v = venturesBySlug.get(s.ventureSlug)
                  return (
                    <tr key={s.ventureSlug} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/portfolio/${s.ventureSlug}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {v?.name ?? s.ventureSlug}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                        <span
                          className={
                            s.signal === 'green'
                              ? 'text-emerald-700'
                              : s.signal === 'amber'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                          }
                        >
                          {s.composite}
                        </span>
                        <span className="text-slate-400">/100</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={REC_TONE[s.recommendation]}>
                          {REC_LABEL[s.recommendation]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {v ? fmtCompactCurrency(v.monthlyRecurringRevenueCents) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {v ? fmtCompactCurrency(v.weightedPipelineCents) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone="slate">{v?.stage ?? '—'}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Per-venture breakdown"
        description="Axis-level transparency. The axis weights sum to 100; the composite is a straight weighted average."
      >
        <div className="space-y-4">
          {scores.map((s) => {
            const v = venturesBySlug.get(s.ventureSlug)
            return (
              <div
                key={s.ventureSlug}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/portfolio/${s.ventureSlug}`}
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {v?.name ?? s.ventureSlug}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Composite{' '}
                      <span className="font-semibold text-slate-900">{s.composite}/100</span> · Stage{' '}
                      {v?.stage ?? '—'}
                    </div>
                  </div>
                  <Badge tone={REC_TONE[s.recommendation]}>{REC_LABEL[s.recommendation]}</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  {Object.entries(s.axes).map(([key, axis]) => (
                    <div
                      key={key}
                      title={axis.rationale}
                      className="rounded-md bg-slate-50 px-3 py-2"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {humanizeAxis(key)}
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="text-base font-semibold tabular-nums text-slate-900">
                          {axis.score}
                        </span>
                        <span className="text-[10px] text-slate-400">w {axis.weight}</span>
                      </div>
                      <progress
                        aria-label={`${humanizeAxis(key)} score`}
                        className="mt-2 h-1 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-slate-700 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-slate-700"
                        max={100}
                        value={axis.score}
                      />
                    </div>
                  ))}
                </div>

                {s.reasons.length > 0 && (
                  <ul className="mt-4 space-y-1 text-xs text-slate-700">
                    {s.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 inline-block h-1 w-1 rounded-full bg-slate-400" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="How to read this">
        <div className="text-sm text-slate-700">
          <p className="mb-2">
            <strong>Invest more</strong> requires a composite ≥ 75 <em>and</em> a low founder load.
            That combination is what separates a real growth bet from a money pit that only the
            founder can run.
          </p>
          <p className="mb-2">
            <strong>Pause</strong> and <strong>Restructure</strong> are not failures — they protect
            your attention. Every paused venture frees founder hours to compound the winners.
          </p>
          <p className="text-slate-500">
            Margin scoring uses a stage-derived prior because per-venture COGS is not yet captured.
            When venture-level finance lands, margin will swap to the real number with no other
            change to this engine.
          </p>
        </div>
      </Card>
    </div>
  )
}

function humanizeAxis(key: string): string {
  const map: Record<string, string> = {
    revenueTraction: 'Revenue',
    pipelineStrength: 'Pipeline',
    marginPotential: 'Margin',
    strategicFit: 'Fit',
    founderLoad: 'Founder load',
    confidence: 'Confidence',
  }
  return map[key] ?? key
}
