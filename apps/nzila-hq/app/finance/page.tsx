import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { fmtCompactCurrency, fmtPercent } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:finance')

  const repo = getHqRepository()
  const finance = repo.financeSnapshot()
  const ventures = repo.listVentures()
  const monthly = repo.monthlyPortfolioReview()

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 7 · Finance & Value"
        title="Finance"
        description="Studio-level economics: MRR, ARR, pipeline, runway, and revenue concentration."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total MRR" value={fmtCompactCurrency(finance.totalMrrCents)} />
        <Stat label="ARR run-rate" value={fmtCompactCurrency(finance.arrRunRateCents)} />
        <Stat label="Pipeline value" value={fmtCompactCurrency(finance.pipelineValueCents)} />
        <Stat label="Weighted pipeline" value={fmtCompactCurrency(finance.weightedPipelineCents)} />
        <Stat
          label="Top venture share"
          value={fmtPercent(finance.topVentureRevenueShare)}
          tone={finance.topVentureRevenueShare > 0.6 ? 'amber' : 'green'}
          hint="concentration risk"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Stat label="Cash runway" value={`${finance.cashRunwayMonths ?? '—'} months`} />
        <Stat
          label="CAC proxy"
          value={finance.cacProxyCents == null ? '—' : fmtCompactCurrency(finance.cacProxyCents)}
        />
        <Stat
          label="Payback"
          value={finance.paybackMonths == null ? '—' : `${finance.paybackMonths} months`}
        />
      </div>

      <Card title="MRR by venture">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Venture</th>
                <th className="px-4 py-2 text-right">MRR</th>
                <th className="px-4 py-2 text-right">Pipeline</th>
                <th className="px-4 py-2 text-right">Weighted</th>
                <th className="px-4 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {ventures.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{v.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                    {fmtCompactCurrency(v.monthlyRecurringRevenueCents)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                    {fmtCompactCurrency(v.pipelineValueCents)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                    {fmtCompactCurrency(v.weightedPipelineCents)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {finance.marginByVentureCents[v.slug] == null
                      ? '—'
                      : fmtCompactCurrency(finance.marginByVentureCents[v.slug] as number)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Monthly portfolio review (auto-generated)"
        description="From @nzila/hq-domain reports"
      >
        <pre className="overflow-x-auto rounded-md bg-slate-50 p-4 text-xs text-slate-800">
          {monthly.markdown}
        </pre>
      </Card>
    </div>
  )
}
