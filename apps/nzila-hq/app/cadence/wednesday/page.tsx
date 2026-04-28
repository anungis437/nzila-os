/**
 * Wednesday — Product & Blockers Review.
 * Question: what is stuck, and who can unblock it?
 */
import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge, HealthBadge } from '@/components/primitives/Badge'
import { Stat } from '@/components/primitives/Stat'
import { EmptyState } from '@/components/primitives/EmptyState'
import { fmtRelativeDays } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function WednesdayRitualPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:cadence')

  const repo = getHqRepository()
  const ventures = repo.listVentures()
  const tasks = repo.listTasks()
  const scores = repo.dependencyScores()
  const users = repo.listUsers()
  const userById = new Map(users.map((u) => [u.id, u]))
  const now = new Date(repo.now)

  const blocked = tasks.filter((t) => t.status === 'blocked')
  const venturesWithBlockers = ventures.filter((v) => v.blockers.length > 0)
  const productEscalations = tasks.filter(
    (t) => t.queue === 'product-escalations' && t.status !== 'done',
  )

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Wednesday · Product & Blockers"
        title="What is stuck, and who can unblock it?"
        description="25 minutes. Walk every blocker. Either assign an owner with a date or formally accept the cost."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Blocked tasks" value={blocked.length} tone={blocked.length > 0 ? 'amber' : 'green'} />
        <Stat label="Ventures with blockers" value={venturesWithBlockers.length} />
        <Stat label="Product escalations" value={productEscalations.length} tone={productEscalations.length > 0 ? 'amber' : 'green'} />
        <Stat label="RED dependency" value={scores.filter((s) => s.signal === 'red').length} tone="red" />
      </div>

      <Card title="Venture blockers" description="Per-venture surface — own each line by name and date.">
        {venturesWithBlockers.length === 0 ? (
          <EmptyState title="No declared venture blockers" />
        ) : (
          <ul className="space-y-3">
            {venturesWithBlockers.map((v) => {
              const score = scores.find((s) => s.ventureSlug === v.slug)
              return (
                <li key={v.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/portfolio/${v.slug}`}
                        className="text-sm font-semibold text-slate-900 hover:underline"
                      >
                        {v.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        Owner {userById.get(v.ownerUserId)?.fullName ?? v.ownerUserId}
                      </div>
                    </div>
                    {score && <HealthBadge signal={score.signal} />}
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {v.blockers.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 inline-block h-1 w-1 rounded-full bg-rose-500" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Blocked tasks" description="Anything in `blocked` status — escalate or kill.">
        {blocked.length === 0 ? (
          <EmptyState title="No blocked tasks" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {blocked.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                  <div className="text-xs text-slate-500">
                    {userById.get(t.ownerUserId)?.fullName ?? t.ownerUserId} · {t.context}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-slate-700">
                  <Badge tone="rose">blocked</Badge>
                  {t.dueAt && <span>due {fmtRelativeDays(t.dueAt, now)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Product escalations"
        description="Items routed in from Console. Decide whether to fix, defer, or accept as known."
      >
        {productEscalations.length === 0 ? (
          <EmptyState title="No active product escalations" />
        ) : (
          <ul className="space-y-2">
            {productEscalations.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                  <div className="text-xs text-slate-500">{t.context}</div>
                </div>
                <Badge tone="sky">{t.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
