/**
 * Dependency 2.0 — delegation moves and dependency trend.
 *
 * The /dependency page already shows current per-venture scores. This page
 * surfaces the *next action*: ranked delegation moves the founder can take
 * this week to lower bottleneck score. Plus a synthesized trend so we know
 * whether dependency is improving or worsening.
 */
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { ReportExportButton } from '@/components/reports/ReportExportButton'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  'assign-second-owner': 'Assign second owner',
  'reassign-task': 'Reassign task',
  'introduce-relationship': 'Introduce relationship',
}

export default async function DependencyTrendPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:dependency')

  const repo = getHqRepository()
  const moves = repo.delegationMoves()
  const trend = repo.dependencyTrend()
  const totalImpact = moves.reduce((s, m) => s + m.estimatedScoreReduction, 0)

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Phase 5+ · Dependency 2.0"
        title="The handover plan, ranked by impact."
        description="Each move below is a concrete action. Estimated score reductions are additive — executing the top three this week typically drops the studio bottleneck by a measurable amount."
      />

      <Card
        title={`Ranked delegation moves · max impact ${totalImpact} pts`}
        description="Highest-impact action first."
      >
        {moves.length === 0 ? (
          <p className="text-sm text-slate-500">
            No delegation moves recommended — the engine sees no high-leverage handovers right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {moves.slice(0, 12).map((m) => (
              <li
                key={`${m.kind}-${m.targetId}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="violet">{KIND_LABEL[m.kind] ?? m.kind}</Badge>
                    <span className="font-medium text-slate-900">{m.targetLabel}</span>
                    <span className="text-xs text-slate-500">{m.ventureSlug}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">{m.rationale}</div>
                </div>
                <Badge tone="emerald">−{m.estimatedScoreReduction}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={trend.title}
        description={trend.summary}
        action={<ReportExportButton markdown={trend.markdown} filename={`dependency-trend-${repo.now.slice(0, 10)}.md`} />}
      >
        <div className="space-y-3">
          {trend.sections.map((s) => (
            <div key={s.heading}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {s.heading}
              </div>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.body}</pre>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
