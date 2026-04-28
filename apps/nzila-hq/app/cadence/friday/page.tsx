/**
 * Friday — Cash & Priorities.
 * Question: are we burning faster than we can compound?
 */
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { Badge } from '@/components/primitives/Badge'
import { EmptyState } from '@/components/primitives/EmptyState'
import { fmtCompactCurrency } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function FridayRitualPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:cadence')

  const repo = getHqRepository()
  const finance = repo.financeSnapshot()
  const portfolio = repo.portfolioSnapshot()
  const alerts = repo.alerts()
  const ventures = repo.listVentures()

  const concentration = Math.round(finance.topVentureRevenueShare * 100)
  const topAlerts = [...alerts]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Friday · Cash & Priorities"
        title="Are we burning faster than we can compound?"
        description="15 minutes. Read the cash signals. Pick the three things that must move next week. Everything else waits."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total MRR" value={fmtCompactCurrency(finance.totalMrrCents)} />
        <Stat label="ARR run-rate" value={fmtCompactCurrency(finance.arrRunRateCents)} />
        <Stat
          label="Cash runway"
          value={finance.cashRunwayMonths != null ? `${finance.cashRunwayMonths} mo` : 'n/a'}
          tone={
            finance.cashRunwayMonths == null
              ? 'neutral'
              : finance.cashRunwayMonths < 6
                ? 'red'
                : finance.cashRunwayMonths < 12
                  ? 'amber'
                  : 'green'
          }
        />
        <Stat
          label="Top venture share"
          value={`${concentration}%`}
          tone={concentration > 60 ? 'amber' : concentration > 80 ? 'red' : 'green'}
          hint="concentration risk"
        />
      </div>

      <Card
        title="Pick the three things"
        description="If you only do three things next week, what are they? Write them down."
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-800">
          <li>
            <span className="text-slate-500">Priority 1:</span>{' '}
            <em className="text-slate-400">— write here in the Friday meeting —</em>
          </li>
          <li>
            <span className="text-slate-500">Priority 2:</span>{' '}
            <em className="text-slate-400">— write here in the Friday meeting —</em>
          </li>
          <li>
            <span className="text-slate-500">Priority 3:</span>{' '}
            <em className="text-slate-400">— write here in the Friday meeting —</em>
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          When persistence lands, these become first-class entities saved to the cadence log.
        </p>
      </Card>

      <Card title="Top automated alerts">
        {topAlerts.length === 0 ? (
          <EmptyState title="Quiet week — nothing automated is screaming." />
        ) : (
          <ul className="space-y-2">
            {topAlerts.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={a.severity === 'critical' ? 'rose' : 'amber'}>{a.severity}</Badge>
                    <span className="truncate text-sm font-semibold text-slate-900">{a.title}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{a.detail}</div>
                </div>
                <Badge tone="slate">{a.ruleCode}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Per-venture revenue contribution">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Venture</th>
                <th className="px-4 py-2 text-right">MRR</th>
                <th className="px-4 py-2 text-right">% of total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[...ventures]
                .sort((a, b) => b.monthlyRecurringRevenueCents - a.monthlyRecurringRevenueCents)
                .map((v) => {
                  const share =
                    portfolio.totalMrrCents === 0
                      ? 0
                      : v.monthlyRecurringRevenueCents / portfolio.totalMrrCents
                  return (
                    <tr key={v.id}>
                      <td className="px-4 py-2 text-slate-900">{v.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                        {fmtCompactCurrency(v.monthlyRecurringRevenueCents)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                        {Math.round(share * 100)}%
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

function severityRank(s: string): number {
  if (s === 'critical') return 3
  if (s === 'warn') return 2
  return 1
}
