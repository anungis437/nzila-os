/**
 * Monday — Pipeline Review.
 * Question: where is revenue going to come from this week?
 */
import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { Stat } from '@/components/primitives/Stat'
import { EmptyState } from '@/components/primitives/EmptyState'
import { fmtCompactCurrency, fmtRelativeDays } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const STALE_THRESHOLD_DAYS = 14

export default async function MondayRitualPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:cadence')

  const repo = getHqRepository()
  const opps = repo.listOpportunities()
  const ventures = repo.listVentures()
  const users = repo.listUsers()
  const userById = new Map(users.map((u) => [u.id, u]))
  const ventureBySlug = new Map(ventures.map((v) => [v.slug, v]))
  const now = new Date(repo.now)

  const open = opps.filter((o) => o.stage !== 'won' && o.stage !== 'lost')
  const totalWeighted = open.reduce(
    (s, o) => s + o.estimatedValueCents * o.probability,
    0,
  )
  const closingThisMonth = open
    .filter((o) => {
      if (!o.expectedCloseAt) return false
      const days = (new Date(o.expectedCloseAt).getTime() - now.getTime()) / 86_400_000
      return days >= 0 && days <= 30
    })
    .sort(
      (a, b) =>
        new Date(a.expectedCloseAt!).getTime() - new Date(b.expectedCloseAt!).getTime(),
    )

  const stale = open
    .filter((o) => o.daysStale >= STALE_THRESHOLD_DAYS)
    .sort((a, b) => b.daysStale - a.daysStale)

  const founderTouch = open.filter((o) => o.founderTouchRequired)

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Monday · Pipeline Review"
        title="Where is revenue going to come from this week?"
        description="20 minutes. Walk through closing-this-month deals, kill or unblock the stale ones, decide which need founder touch."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open opportunities" value={open.length} />
        <Stat label="Weighted pipeline" value={fmtCompactCurrency(totalWeighted)} />
        <Stat
          label="Closing in 30 days"
          value={closingThisMonth.length}
          tone={closingThisMonth.length > 0 ? 'green' : 'amber'}
        />
        <Stat
          label={`Stale ≥ ${STALE_THRESHOLD_DAYS}d`}
          value={stale.length}
          tone={stale.length > 0 ? 'amber' : 'green'}
        />
      </div>

      <Card
        title="Closing in the next 30 days"
        description="Sorted by expected close date. Confirm next action and owner for each."
      >
        {closingThisMonth.length === 0 ? (
          <EmptyState
            title="No deals on a near-term clock"
            description="Either pipeline is thin or close dates are missing. Both are problems."
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {closingThisMonth.map((o) => (
              <li key={o.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <div className="min-w-0">
                  <Link
                    href={`/portfolio/${o.ventureSlug}`}
                    className="text-sm font-semibold text-slate-900 hover:underline"
                  >
                    {o.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {ventureBySlug.get(o.ventureSlug)?.name ?? o.ventureSlug} ·{' '}
                    {userById.get(o.ownerUserId)?.fullName ?? o.ownerUserId}
                  </div>
                  <div className="mt-1 text-xs text-slate-700">
                    <span className="font-semibold">Next:</span> {o.nextAction}
                  </div>
                </div>
                <div className="text-xs">
                  <Badge tone="sky">{o.stage}</Badge>
                </div>
                <div className="text-right text-xs tabular-nums text-slate-700">
                  {fmtCompactCurrency(o.estimatedValueCents)} @{' '}
                  {Math.round(o.probability * 100)}%
                </div>
                <div className="text-right text-xs font-medium text-slate-900">
                  closes {fmtRelativeDays(o.expectedCloseAt, now)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Stale deals"
          description="No movement in two weeks or more. Decide: revive, escalate, or kill."
        >
          {stale.length === 0 ? (
            <EmptyState title="Nothing is stale — clean board." />
          ) : (
            <ul className="space-y-2">
              {stale.slice(0, 6).map((o) => (
                <li
                  key={o.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{o.name}</div>
                    <div className="text-xs text-slate-500">
                      {ventureBySlug.get(o.ventureSlug)?.name ?? o.ventureSlug} ·{' '}
                      {userById.get(o.ownerUserId)?.fullName ?? o.ownerUserId}
                    </div>
                    {o.blockers.length > 0 && (
                      <div className="mt-1 text-xs text-rose-700">
                        Blockers: {o.blockers.join('; ')}
                      </div>
                    )}
                  </div>
                  <Badge tone="amber">{o.daysStale}d stale</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Founder-touch required"
          description="Deals tagged as needing the founder personally. Goal: shrink this list every quarter."
        >
          {founderTouch.length === 0 ? (
            <EmptyState
              title="No deals require the founder"
              description="The team is selling without you. This is the goal state."
            />
          ) : (
            <ul className="space-y-2">
              {founderTouch.map((o) => (
                <li
                  key={o.id}
                  className="rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-slate-900">{o.name}</div>
                  <div className="text-xs text-slate-500">
                    {ventureBySlug.get(o.ventureSlug)?.name ?? o.ventureSlug} ·{' '}
                    {fmtCompactCurrency(o.estimatedValueCents)} @{' '}
                    {Math.round(o.probability * 100)}%
                  </div>
                  <div className="mt-1 text-xs text-slate-700">
                    <span className="font-semibold">Why founder:</span> {o.nextAction}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
