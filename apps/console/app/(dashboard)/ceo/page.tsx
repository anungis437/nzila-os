import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { getRunwayData, getFounderFocusData, getWeeklyBriefingData } from '@/lib/executive-intelligence'
import { getDataFreshnessSummary } from '@/lib/data-freshness'
import { generateAutopilotRecommendations } from '@/lib/autopilot-engine'
import { CommandPageShell } from '@/components/command-page-shell'

export const dynamic = 'force-dynamic'

export default async function CEODashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [runway, focus, briefing, freshness, autopilot] = await Promise.all([
    getRunwayData(),
    getFounderFocusData(),
    getWeeklyBriefingData(),
    getDataFreshnessSummary(),
    generateAutopilotRecommendations(),
  ])

  const baseRunway = runway.scenarioRows.find((row) => row.mode === 'base')?.runwayMonths ?? 0
  const topThree = autopilot.slice(0, 3)

  return (
    <CommandPageShell as="div" className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">CEO One-Screen</h1>
        <p className="text-sm text-gray-500 mt-1">A 60-second truth snapshot: cash, decisions, risks, opportunities, and founder focus.</p>
      </div>

      <div className="rounded-2xl bg-gray-900 text-white p-6">
        <p className="text-xs uppercase tracking-widest text-gray-400">North Star Summary</p>
        <p className="text-2xl font-semibold mt-3 leading-tight">{briefing.summarySentence}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Cash Now</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">${runway.cashNowUsd.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Runway (Base)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{baseRunway.toFixed(1)} months</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Data Freshness</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{freshness.overallScore}%</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Top 3 Decisions / Opportunities</h2>
          <div className="space-y-2 text-sm text-gray-700">
            {topThree.map((row, index) => (
              <div key={`${row.action}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="font-medium text-gray-900">{row.action}</p>
                <p className="text-gray-600">{row.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Risk + Founder Focus</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>Overdue accountability items: {briefing.risksRising.length}</p>
            <p>Context-switch tax: {focus.contextSwitchTaxPct.toFixed(0)}%</p>
            <p>Admin drag: {focus.adminDragPct.toFixed(0)}%</p>
            <p>Deep-work score: {focus.deepWorkScore.toFixed(0)}</p>
          </div>
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-900">
            Weekly north-star: protect the top venture while reducing stale execution and preserving runway quality.
          </div>
        </div>
      </div>
    </CommandPageShell>
  )
}
