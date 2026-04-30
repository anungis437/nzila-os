/**
 * Monthly — Portfolio Allocation Review.
 * Question: where should the next dollar / hour / hire go?
 *
 * Surfaces the allocation engine output alongside the deterministic monthly
 * portfolio review report so the founder can sign off on capital direction
 * with the audit trail in one place.
 */
import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { Badge } from '@/components/primitives/Badge'
import { fmtDateTime } from '@/lib/format'
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

export default async function MonthlyRitualPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:cadence')

  const repo = getHqRepository()
  const summary = repo.allocationSummary()
  const scores = repo.allocationScores()
  const ventures = repo.listVentures()
  const venturesBySlug = new Map(ventures.map((v) => [v.slug, v]))
  const review = repo.monthlyPortfolioReview()

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Monthly · Portfolio Allocation"
        title="Where should the next dollar / hour / hire go?"
        description="45 minutes. The allocation engine has done the math; this ritual is for the founder to override or accept and write down the decision."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Avg composite" value={`${summary.averageComposite}/100`} />
        <Stat label="Invest more" value={summary.byRecommendation['invest-more']} tone="green" />
        <Stat label="Hold" value={summary.byRecommendation.hold} />
        <Stat label="Restructure / pause" value={summary.byRecommendation.restructure + summary.byRecommendation.pause} tone="amber" />
        <Stat label="Exit" value={summary.byRecommendation.exit} tone={summary.byRecommendation.exit > 0 ? 'red' : 'neutral'} />
      </div>

      <Card
        title="Recommendation snapshot"
        description="Click into Capital Allocation for the per-axis breakdown and reason strings."
        action={
          <Link
            href="/allocation"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Open allocation engine →
          </Link>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Venture</th>
                <th className="px-4 py-2 text-right">Composite</th>
                <th className="px-4 py-2 text-left">Recommendation</th>
                <th className="px-4 py-2 text-left">Top reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {scores.map((s) => (
                <tr key={s.ventureSlug}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {venturesBySlug.get(s.ventureSlug)?.name ?? s.ventureSlug}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">{s.composite}</td>
                  <td className="px-4 py-2">
                    <Badge tone={REC_TONE[s.recommendation]}>{REC_LABEL[s.recommendation]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">{s.reasons[0] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={review.title}
        description={review.summary}
        action={
          <span className="text-[11px] text-slate-500">
            generated {fmtDateTime(review.generatedAt)}
          </span>
        }
      >
        <div className="space-y-4">
          {review.sections.map((s, i) => (
            <div key={i}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {s.heading}
              </div>
              <pre className="mt-1.5 whitespace-pre-wrap font-sans text-sm text-slate-700">
                {s.body}
              </pre>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
