/**
 * CFO Truth Layer — Phase 7.
 *
 * Aging buckets, burn estimate, runway, client concentration, and a
 * single what-if scenario (lose top client). Every number is computed by
 * `@nzila/hq-domain/finance-engine`. The provenance card at the bottom
 * is explicit about what's currently derived vs. what's authoritative.
 */
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { Badge } from '@/components/primitives/Badge'
import { fmtCompactCurrency } from '@/lib/format'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'
import { buildFinanceView } from '@/server/integrations/finance-view'

export const dynamic = 'force-dynamic'

export default async function CfoPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:finance')

  const view = await buildFinanceView()
  const { aging, burn, runwayMonths: runway, cashOnHandCents: cash, concentration: conc, worstCaseScenario: scenario, provenance } = view

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Phase 7 · CFO Truth Layer"
        title="What the CFO would actually ask in the meeting."
        description="Aging, burn, runway, concentration. Plus a one-click worst-case scenario (lose top client). All deterministic from the same finance engine."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Cash on hand" value={fmtCompactCurrency(cash)} />
        <Stat
          label="Monthly burn"
          value={fmtCompactCurrency(burn.monthlyBurnCents)}
          tone="amber"
        />
        <Stat label="Monthly inflow" value={fmtCompactCurrency(burn.monthlyInflowCents)} tone="green" />
        <Stat
          label="Net monthly"
          value={fmtCompactCurrency(burn.netMonthlyCents)}
          tone={burn.netMonthlyCents >= 0 ? 'green' : 'red'}
        />
        <Stat
          label="Runway"
          value={runway == null ? '∞ (profitable)' : `${runway} mo`}
          tone={runway == null ? 'green' : runway < 6 ? 'red' : runway < 12 ? 'amber' : undefined}
        />
      </div>

      <Card title="AR aging" description="What's owed to you, by how late.">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Bucket</th>
                <th className="px-4 py-2 text-right">Invoices</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(['current', '1-30', '31-60', '61-90', '90+'] as const).map((b) => (
                <tr key={b}>
                  <td className="px-4 py-2.5">
                    <Badge tone={b === 'current' ? 'sky' : b === '1-30' ? 'amber' : 'rose'}>{b}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {aging.buckets[b].count}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                    {fmtCompactCurrency(aging.buckets[b].totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-xs">
              <tr>
                <td className="px-4 py-2 font-semibold text-slate-700">Receivable</td>
                <td className="px-4 py-2"></td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">
                  {fmtCompactCurrency(aging.receivableCents)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-semibold text-rose-700">Overdue</td>
                <td className="px-4 py-2"></td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-rose-700">
                  {fmtCompactCurrency(aging.overdueCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Burn by category" description="90-day window, normalized to monthly.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(burn.byCategoryCents)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => (
              <div key={k} className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {k}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                  {fmtCompactCurrency(Math.round(v / 3))}
                </div>
                <div className="text-[10px] text-slate-400">monthly avg</div>
              </div>
            ))}
        </div>
      </Card>

      <Card
        title="Client concentration"
        description={`Herfindahl ${(conc.herfindahl * 100).toFixed(1)}/100 · Top client share ${(conc.topShare * 100).toFixed(1)}%`}
      >
        <div className="space-y-2">
          {conc.byClient.slice(0, 8).map((c) => (
            <div key={c.clientOrgId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">{c.clientName}</span>
              <div className="flex w-1/2 items-center gap-2">
                <progress
                  aria-label={`${c.clientName} revenue share`}
                  className={`h-1.5 flex-1 overflow-hidden rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full ${
                    c.share > 0.4
                      ? '[&::-moz-progress-bar]:bg-rose-500 [&::-webkit-progress-value]:bg-rose-500'
                      : c.share > 0.2
                        ? '[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500'
                        : '[&::-moz-progress-bar]:bg-sky-500 [&::-webkit-progress-value]:bg-sky-500'
                  }`}
                  max={100}
                  value={Math.round(c.share * 100)}
                />
                <span className="w-16 text-right text-xs tabular-nums text-slate-700">
                  {(c.share * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Worst-case scenario: lose top client"
        description="Removes top client invoices and recomputes runway + concentration. No simulation of replacement revenue."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ScenarioSide title="Baseline" runway={scenario.baseline.runwayMonths} burn={scenario.baseline.burn.monthlyBurnCents} />
          <ScenarioSide title="If we lose top client" runway={scenario.scenario.runwayMonths} burn={scenario.scenario.burn.monthlyBurnCents} />
        </div>
        {scenario.notes.length > 0 && (
          <ul className="mt-4 list-disc pl-5 text-xs text-slate-500">
            {scenario.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Provenance">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span>Invoices:</span>
          <Badge tone={provenance.invoices === 'live' ? 'emerald' : 'amber'}>
            {provenance.invoices === 'live'
              ? `Stripe (${provenance.counts.ledgerInvoices} rows)`
              : 'Derived from venture seed'}
          </Badge>
          <span className="ml-3">Cash events:</span>
          <Badge tone={provenance.cashEvents === 'live' ? 'emerald' : 'amber'}>
            {provenance.cashEvents === 'live'
              ? `QuickBooks (${provenance.counts.ledgerCashEvents} rows)`
              : 'Derived from venture seed'}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Live numbers come from <code>hq_invoices</code> / <code>hq_cash_events</code>, populated by
          the daily Stripe + QuickBooks sync (<code>POST /api/internal/billing/sync</code>). When a
          source is empty or unconfigured, the page falls back to the deterministic seed so the
          cockpit is never blank. Engines and shapes are identical either way.
        </p>
      </Card>
    </div>
  )
}

function ScenarioSide({
  title,
  runway,
  burn,
}: {
  title: string
  runway: number | null
  burn: number
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase text-slate-500">Runway</div>
          <div className="text-lg font-semibold tabular-nums text-slate-900">
            {runway == null ? '∞' : `${runway} mo`}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-500">Monthly burn</div>
          <div className="text-lg font-semibold tabular-nums text-slate-900">
            {fmtCompactCurrency(burn)}
          </div>
        </div>
      </div>
    </div>
  )
}
