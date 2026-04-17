import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { BanknotesIcon, ArrowTrendingUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { getForecastOutput } from '@/lib/forecast-engine'

export const dynamic = 'force-dynamic'

export default async function ForecastPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const forecast = await getForecastOutput()

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Forecast</h1>
        <p className="text-sm text-gray-500 mt-1">30 / 90 / 180-day scenarios across revenue, runway, overload, and hiring affordability.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <BanknotesIcon className="h-5 w-5 text-gray-400" />
            <p className="text-sm text-gray-500">Weighted Pipeline</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${forecast.pipelineWeightedUsd.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
            <p className="text-sm text-gray-500">Accepted Quotes</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${forecast.closeSignals.accepted.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
            <p className="text-sm text-gray-500">Draft + Sent Exposure</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${(forecast.closeSignals.draft + forecast.closeSignals.sent).toFixed(0)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {forecast.scenarios.map((scenario) => (
          <div key={scenario.name} className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
            <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">{scenario.name} Scenario</p>
            <p className="text-3xl font-bold text-gray-900">{scenario.runwayMonths.toFixed(1)}m</p>
            <p className="text-sm text-gray-500">Runway</p>
            <div className="pt-2 text-sm text-gray-700 space-y-1">
              <p>30d revenue: ${scenario.expectedRevenue30d.toFixed(0)}</p>
              <p>90d revenue: ${scenario.expectedRevenue90d.toFixed(0)}</p>
              <p>180d revenue: ${scenario.expectedRevenue180d.toFixed(0)}</p>
              <p>Overload risk: {scenario.founderOverloadRiskPct.toFixed(0)}%</p>
              <p>Hiring affordability: {scenario.hiringAffordability} hires</p>
            </div>
            <p className="text-xs text-gray-500 pt-2">{scenario.narrative}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Ranking Shift Signals</h2>
        <div className="space-y-2 text-sm text-gray-700">
          {forecast.rankingShiftSignals.length > 0 ? forecast.rankingShiftSignals.map((signal) => (
            <div key={signal} className="rounded-lg bg-gray-50 px-3 py-2">{signal}</div>
          )) : (
            <p className="text-gray-400 italic">No strong ranking shifts detected from available data.</p>
          )}
        </div>
      </div>
    </div>
  )
}
