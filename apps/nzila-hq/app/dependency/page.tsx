import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { HealthBadge } from '@/components/primitives/Badge'
import { EmptyState } from '@/components/primitives/EmptyState'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function DependencyPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:dependency')

  const repo = getHqRepository()
  const scores = repo.dependencyScores()
  const ventures = new Map(repo.listVentures().map((v) => [v.slug, v]))
  const portfolio = repo.portfolioSnapshot()
  const trend = repo.dependencyTrend()

  const reds = scores.filter((s) => s.signal === 'red').length
  const ambers = scores.filter((s) => s.signal === 'amber').length
  const greens = scores.filter((s) => s.signal === 'green').length

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 5 · Founder Dependency Engine"
        title="Founder dependency"
        description="The studio's most strategic metric. Higher = the founder is a bottleneck. Goal: down every month."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Studio bottleneck"
          value={`${portfolio.founderBottleneckScore}/100`}
          tone={portfolio.founderBottleneckSignal}
          hint={portfolio.founderBottleneckSignal.toUpperCase()}
        />
        <Stat label="Ventures on RED" value={reds} tone={reds > 0 ? 'red' : 'green'} />
        <Stat label="Ventures on AMBER" value={ambers} tone={ambers > 0 ? 'amber' : 'green'} />
        <Stat label="Ventures on GREEN" value={greens} tone="green" />
      </div>

      <Card title="Per-venture dependency scores">
        {scores.length === 0 ? (
          <EmptyState title="No ventures to score" />
        ) : (
          <ul className="space-y-3">
            {scores
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((s) => {
                const v = ventures.get(s.ventureSlug)
                return (
                  <li key={s.ventureSlug} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/portfolio/${s.ventureSlug}`}
                          className="text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {v?.name ?? s.ventureSlug}
                        </Link>
                        <div className="text-xs text-slate-500">{v?.stage}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-sm font-semibold text-slate-900">
                          {s.score}/100
                        </span>
                        <HealthBadge signal={s.signal} />
                      </div>
                    </div>
                    {s.reasons.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-slate-600">
                        {s.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1 inline-block h-1 w-1 rounded-full bg-rose-400" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </Card>

      <Card title="Trend" description="Movement vs prior snapshot">
        <pre className="overflow-x-auto rounded-md bg-slate-50 p-4 text-xs text-slate-800">
          {trend.markdown}
        </pre>
      </Card>
    </div>
  )
}
