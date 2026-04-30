import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge, HealthBadge } from '@/components/primitives/Badge'
import { fmtCompactCurrency } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:portfolio')

  const repo = getHqRepository()
  const ventures = repo.listVentures()
  const scoresBySlug = new Map(repo.dependencyScores().map((s) => [s.ventureSlug, s]))
  const usersById = new Map(repo.listUsers().map((u) => [u.id, u]))

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 2 · Venture Portfolio"
        title="Portfolio"
        description="Every venture, one row each. Click into any to see mission, ICP, owner, pipeline, blockers, and 30-day plan."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ventures.map((v) => {
          const score = scoresBySlug.get(v.slug)
          return (
            <Link key={v.id} href={`/portfolio/${v.slug}`} className="block">
              <Card className="h-full transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-slate-500">{v.stage}</div>
                    <div className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                      {v.name}
                    </div>
                  </div>
                  {score && <HealthBadge signal={score.signal} />}
                </div>
                <p className="mt-2 text-sm text-slate-600">{v.mission}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500">MRR</div>
                    <div className="font-semibold text-slate-900">
                      {fmtCompactCurrency(v.monthlyRecurringRevenueCents)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Weighted pipeline</div>
                    <div className="font-semibold text-slate-900">
                      {fmtCompactCurrency(v.weightedPipelineCents)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Owner</div>
                    <div className="font-medium text-slate-700">
                      {usersById.get(v.ownerUserId)?.fullName ?? v.ownerUserId}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Confidence</div>
                    <div>
                      <Badge
                        tone={
                          v.confidence === 'high'
                            ? 'emerald'
                            : v.confidence === 'medium'
                              ? 'amber'
                              : 'rose'
                        }
                      >
                        {v.confidence}
                      </Badge>
                    </div>
                  </div>
                </div>
                {v.blockers.length > 0 && (
                  <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <span className="font-semibold">Blocker:</span> {v.blockers[0]}
                  </div>
                )}
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
