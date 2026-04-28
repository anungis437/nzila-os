import { Card } from '@/components/primitives/Card'
import { Stat } from '@/components/primitives/Stat'
import { Badge, HealthBadge } from '@/components/primitives/Badge'
import { EmptyState } from '@/components/primitives/EmptyState'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { fmtCompactCurrency, fmtRelativeDays, fmtDate } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ExecutiveHomePage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:executive-home')

  const repo = getHqRepository()
  const portfolio = repo.portfolioSnapshot()
  const alerts = repo.alerts()
  const tasks = repo.listTasks().filter((t) => t.status !== 'done')
  const founderTasks = tasks.filter((t) => t.queue === 'founder-decisions')
  const operatorTasks = tasks.filter((t) => t.queue === 'operator-actions')
  const partnerTasks = tasks.filter((t) => t.queue === 'partner-followups')
  const events = repo.upcomingStrategicEvents(8)
  const ventures = repo.listVentures()
  const opps = repo.listOpportunities()
  const expiringOpps = opps
    .filter((o) => o.expectedCloseAt && o.stage !== 'won' && o.stage !== 'lost')
    .sort((a, b) => new Date(a.expectedCloseAt!).getTime() - new Date(b.expectedCloseAt!).getTime())
    .slice(0, 5)

  const topPriorities = [
    ...alerts.filter((a) => a.severity === 'critical').slice(0, 3),
    ...alerts.filter((a) => a.severity === 'warn').slice(0, 5),
  ].slice(0, 5)

  const usersById = new Map(repo.listUsers().map((u) => [u.id, u]))
  const venturesBySlug = new Map(ventures.map((v) => [v.slug, v]))

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={`${fmtDate(repo.now)} · Executive Home`}
        title="Nzila Ventures — Operating Cockpit"
        description="The studio at a glance: where revenue lives, what needs the founder, what operators can move now, and what the week looks like."
      />

      {/* ── Phase 1 §1: Portfolio Snapshot ───────────────────────────── */}
      <Card
        title="Portfolio snapshot"
        description="Studio-level signals across all active ventures"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Stat label="Active ventures" value={portfolio.activeVentures} />
          <Stat
            label="Total MRR"
            value={fmtCompactCurrency(portfolio.totalMrrCents)}
            hint="across all ventures"
          />
          <Stat
            label="Weighted pipeline"
            value={fmtCompactCurrency(portfolio.weightedPipelineCents)}
            hint={`${fmtCompactCurrency(portfolio.totalPipelineCents)} unweighted`}
          />
          <Stat label="Pilots live" value={portfolio.pilotsLive} />
          <Stat
            label="Strategic alerts"
            value={portfolio.strategicAlerts}
            tone={portfolio.strategicAlerts > 0 ? 'amber' : 'green'}
          />
          <Stat
            label="Founder bottleneck"
            value={`${portfolio.founderBottleneckScore}/100`}
            tone={portfolio.founderBottleneckSignal}
            hint={portfolio.founderBottleneckSignal.toUpperCase()}
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ── Phase 1 §2: This Week Priorities ───────────────────────── */}
        <Card
          title="This week — priorities"
          description="Top automated alerts + expiring deals"
          className="xl:col-span-2"
        >
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Top alerts
              </div>
              {topPriorities.length === 0 ? (
                <EmptyState
                  title="No alerts triggered"
                  description="Nothing automated is screaming at you. Use this calm to delegate."
                />
              ) : (
                <ul className="space-y-2">
                  {topPriorities.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone={a.severity === 'critical' ? 'rose' : 'amber'}>
                            {a.severity}
                          </Badge>
                          <span className="truncate text-sm font-medium text-slate-900">
                            {a.title}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{a.detail}</div>
                        {a.suggestedAction && (
                          <div className="mt-1 text-xs text-slate-700">
                            <span className="font-semibold">Next:</span> {a.suggestedAction}
                          </div>
                        )}
                      </div>
                      <Badge tone="slate">{a.ruleCode}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Expiring opportunities
              </div>
              {expiringOpps.length === 0 ? (
                <EmptyState title="No deals on a near-term clock" />
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {expiringOpps.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">{o.name}</div>
                        <div className="text-xs text-slate-500">
                          {venturesBySlug.get(o.ventureSlug)?.name ?? o.ventureSlug} ·{' '}
                          {usersById.get(o.ownerUserId)?.fullName ?? o.ownerUserId} ·{' '}
                          {fmtCompactCurrency(o.estimatedValueCents)} @{' '}
                          {Math.round(o.probability * 100)}%
                        </div>
                      </div>
                      <div className="text-xs font-medium text-slate-700">
                        closes {fmtRelativeDays(o.expectedCloseAt, new Date(repo.now))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {/* ── Phase 1 §5: Strategic Timeline ─────────────────────────── */}
        <Card title="Strategic timeline" description="Next 30 days — meetings, launches, renewals">
          {events.length === 0 ? (
            <EmptyState title="No upcoming strategic events" />
          ) : (
            <ol className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="relative pl-4">
                  <span className="absolute left-0 top-1.5 inline-block h-2 w-2 rounded-full bg-slate-900" />
                  <div className="text-xs font-medium text-slate-500">
                    {fmtDate(e.occursAt)} · {e.kind}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{e.title}</div>
                  {e.ventureSlug && (
                    <div className="text-xs text-slate-500">
                      {venturesBySlug.get(e.ventureSlug)?.name ?? e.ventureSlug}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Phase 1 §3: Founder Focus Queue ────────────────────────── */}
        <Card
          title="Founder focus queue"
          description="Items only the founder can decide. Everything else has been triaged out."
          action={
            <Link
              href="/delegation"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View all queues →
            </Link>
          }
        >
          {founderTasks.length === 0 ? (
            <EmptyState
              title="The founder queue is clear"
              description="Operator queue is carrying the load. This is the goal."
            />
          ) : (
            <ul className="space-y-2">
              {founderTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{t.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{t.context}</div>
                    {t.ventureSlug && (
                      <div className="mt-1">
                        <Badge tone="violet">
                          {venturesBySlug.get(t.ventureSlug)?.name ?? t.ventureSlug}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-slate-700">
                    due {fmtRelativeDays(t.dueAt, new Date(repo.now))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Phase 1 §4: Operator Queue ─────────────────────────────── */}
        <Card
          title="Operator queue"
          description="Items already delegated and executable now — no founder needed."
        >
          {operatorTasks.length === 0 && partnerTasks.length === 0 ? (
            <EmptyState title="No operator items in flight" />
          ) : (
            <ul className="space-y-2">
              {[...operatorTasks, ...partnerTasks].map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={t.queue === 'operator-actions' ? 'sky' : 'emerald'}>
                        {t.queue.replace('-', ' ')}
                      </Badge>
                      <span className="truncate text-sm font-medium text-slate-900">{t.title}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {usersById.get(t.ownerUserId)?.fullName ?? t.ownerUserId} · {t.context}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-700">
                    due {fmtRelativeDays(t.dueAt, new Date(repo.now))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Ventures health strip */}
      <Card
        title="Venture health"
        description="Stage, MRR, dependency signal — single line per venture"
      >
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Venture</th>
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-right">MRR</th>
                <th className="px-4 py-2 text-right">Weighted pipe</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-left">Confidence</th>
                <th className="px-4 py-2 text-left">Dependency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {ventures.map((v) => {
                const score = repo.dependencyScores().find((s) => s.ventureSlug === v.slug)
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/portfolio/${v.slug}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {v.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <Badge tone="slate">{v.stage}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                      {fmtCompactCurrency(v.monthlyRecurringRevenueCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {fmtCompactCurrency(v.weightedPipelineCents)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {usersById.get(v.ownerUserId)?.fullName ?? v.ownerUserId}
                    </td>
                    <td className="px-4 py-2.5">
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
                    </td>
                    <td className="px-4 py-2.5">
                      {score ? <HealthBadge signal={score.signal} /> : <Badge>n/a</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
