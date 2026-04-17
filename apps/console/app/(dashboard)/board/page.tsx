import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { getCapitalPriorityRows, getTopExecutionActions, getWeeklyBriefingData } from '@/lib/executive-intelligence'
import { getFinanceSpineSnapshot } from '@/lib/finance-spine'

export const dynamic = 'force-dynamic'

export default async function BoardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [briefing, capitalRows, finance, actions] = await Promise.all([
    getWeeklyBriefingData(),
    getCapitalPriorityRows(),
    getFinanceSpineSnapshot(),
    getTopExecutionActions(8),
  ])

  const topVentures = capitalRows.slice(0, 5)
  const cutReviewVentures = capitalRows.filter((row) => row.action === 'Cut review').slice(0, 5)
  const baseRunway = finance.runwayScenarios.find((scenario) => scenario.mode === 'base')

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Board Pack</h1>
          <p className="text-sm text-gray-500 mt-2">Single source for cash, revenue, runway, ranking, risks, and asks.</p>
        </div>
        <div className="text-xs text-gray-500">Generated {finance.generatedAt.toISOString().slice(0, 10)}</div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Cash (True)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">${finance.cashPositionUsd.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">MRR</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">${finance.mrrUsd.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">ARR</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">${finance.arrUsd.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Monthly Burn</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">${finance.monthlyBurnUsd.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Base Runway</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{(baseRunway?.runwayMonths ?? 0).toFixed(1)}m</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Gross Margin Est.</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{finance.grossMarginEstimatePct.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Top Ventures (Capital Allocation)</h2>
          <div className="space-y-3">
            {topVentures.map((venture) => (
              <div key={venture.ventureId} className="rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-gray-900">{venture.ventureName}</p>
                  <span className="text-sm font-semibold text-gray-700">{venture.score}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{venture.action} · {venture.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Receivables And Collections Priority</h2>
          <div className="space-y-3">
            {finance.collectionsPriority.map((invoice) => (
              <div key={invoice.ref} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{invoice.ref}</p>
                  <p className="text-xs text-gray-500">{invoice.ventureId || 'unattributed'} · {invoice.dueDays}d</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">${invoice.amountUsd.toFixed(0)}</span>
              </div>
            ))}
            {finance.collectionsPriority.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No open receivables.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Key Risks And Regressions</h2>
          <div className="space-y-3 text-sm text-gray-700">
            {briefing.risksRising.length > 0 ? briefing.risksRising.map((risk) => (
              <div key={risk} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">{risk}</div>
            )) : <p className="text-gray-400 italic">No elevated risk this cycle.</p>}
            {cutReviewVentures.map((venture) => (
              <div key={venture.ventureId} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                Cut-review watch: {venture.ventureName} ({venture.score})
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Execution Cadence (Next 7 Days)</h2>
          <div className="space-y-3">
            {actions.map((action) => (
              <div key={action.id} className="rounded-lg border border-gray-200 px-4 py-3 text-sm">
                <p className="font-medium text-gray-900">{action.title}</p>
                <p className="text-xs text-gray-500 mt-1">{action.owner || 'unassigned'} · due {action.dueDate || 'n/a'} · {action.status}</p>
              </div>
            ))}
            {actions.length === 0 ? <p className="text-sm text-gray-400 italic">No active initiatives.</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Board Asks</h2>
        <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
          <li>Support collections escalation for all invoices over 30 days.</li>
          <li>Approve focused capital allocation to top two ventures only.</li>
          <li>Hold hiring additions until base runway remains above 9 months for two consecutive weeks.</li>
          <li>Require evidence of weekly decision closure in the Accountability dashboard.</li>
        </ul>
      </div>
    </div>
  )
}
