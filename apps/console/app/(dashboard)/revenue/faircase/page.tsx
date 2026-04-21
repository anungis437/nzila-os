import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import fs from 'node:fs'
import path from 'node:path'
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

type FunnelData = {
  as_of_date: string
  confidence_note: string
  targets_90_day: {
    leads: number
    meetings_booked: number
    demos: number
    proposals: number
    pilots: number
    closed_won: number
  }
  pipeline: {
    stages: {
      leads: number
      meetings_booked: number
      demos: number
      proposals: number
      pilots: number
      closed_won: number
    }
    conversion_rates_pct: {
      lead_to_meeting: number
      meeting_to_demo: number
      demo_to_proposal: number
      proposal_to_pilot: number
      pilot_to_close: number
      lead_to_close: number
    }
    sales_cycle_days: number
    avg_deal_size: number
    cac_estimate: number
    source_attribution_pct: Record<string, number>
  }
  deal_register: Array<{
    id: string
    account: string
    segment: string
    stage: string
    value: number
    probability: number
    next_step: string
    owner: string
    expected_close_date: string
    source: string
    confidence: string
  }>
}

function loadFunnelData(): FunnelData | null {
  try {
    const filePath = path.join(process.cwd(), '../../governance/commercial/faircase-funnel.json')
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FunnelData
  } catch {
    return null
  }
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

export default async function FaircaseRevenuePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = loadFunnelData()

  if (!data) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">FAIRCASE Revenue Dashboard</h1>
        <p className="text-sm text-gray-500">Unable to load governance/commercial/faircase-funnel.json.</p>
        <Link href="/revenue" className="text-sm text-blue-600 hover:underline">Back to Revenue</Link>
      </div>
    )
  }

  const { pipeline, targets_90_day: targets } = data
  const weightedPipeline = data.deal_register.reduce((sum, deal) => sum + deal.value * deal.probability, 0)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ArrowTrendingUpIcon className="h-8 w-8 text-gray-300" />
            FAIRCASE Revenue Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">Leads -&gt; Meetings -&gt; Demos -&gt; Proposals -&gt; Pilots -&gt; Close</p>
          <p className="text-xs text-gray-400 mt-1">As of {data.as_of_date} · {data.confidence_note}</p>
        </div>
        <Link href="/revenue" className="text-sm text-blue-600 hover:underline">Back to Revenue</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Leads</p>
          <p className="text-2xl font-bold text-gray-900">{pipeline.stages.leads}</p>
          <p className="text-xs text-gray-400 mt-1">90d target: {targets.leads}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Meetings Booked</p>
          <p className="text-2xl font-bold text-gray-900">{pipeline.stages.meetings_booked}</p>
          <p className="text-xs text-gray-400 mt-1">target: {targets.meetings_booked}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Demos</p>
          <p className="text-2xl font-bold text-gray-900">{pipeline.stages.demos}</p>
          <p className="text-xs text-gray-400 mt-1">target: {targets.demos}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Proposals</p>
          <p className="text-2xl font-bold text-gray-900">{pipeline.stages.proposals}</p>
          <p className="text-xs text-gray-400 mt-1">target: {targets.proposals}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pilots</p>
          <p className="text-2xl font-bold text-emerald-600">{pipeline.stages.pilots}</p>
          <p className="text-xs text-gray-400 mt-1">target: {targets.pilots}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Closed Won</p>
          <p className="text-2xl font-bold text-blue-700">{pipeline.stages.closed_won}</p>
          <p className="text-xs text-gray-400 mt-1">target: {targets.closed_won}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Weighted Pipeline</p>
          <p className="text-2xl font-bold text-gray-900">${weightedPipeline.toFixed(0)}</p>
          <p className="text-xs text-gray-400 mt-1">avg deal: ${pipeline.avg_deal_size.toFixed(0)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Conversion Metrics</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-gray-500">Lead -&gt; Meeting</p>
            <p className="text-xl font-semibold text-gray-900">{pct(pipeline.conversion_rates_pct.lead_to_meeting)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-gray-500">Meeting -&gt; Demo</p>
            <p className="text-xl font-semibold text-gray-900">{pct(pipeline.conversion_rates_pct.meeting_to_demo)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-gray-500">Demo -&gt; Proposal</p>
            <p className="text-xl font-semibold text-gray-900">{pct(pipeline.conversion_rates_pct.demo_to_proposal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-gray-500">Proposal -&gt; Pilot</p>
            <p className="text-xl font-semibold text-gray-900">{pct(pipeline.conversion_rates_pct.proposal_to_pilot)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-gray-500">Pilot -&gt; Close</p>
            <p className="text-xl font-semibold text-gray-900">{pct(pipeline.conversion_rates_pct.pilot_to_close)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-gray-500">Lead -&gt; Close</p>
            <p className="text-xl font-semibold text-gray-900">{pct(pipeline.conversion_rates_pct.lead_to_close)}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Revenue Efficiency</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Sales cycle (days)</span><span className="font-semibold text-gray-900">{pipeline.sales_cycle_days}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">CAC estimate</span><span className="font-semibold text-gray-900">${pipeline.cac_estimate.toFixed(0)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Average deal size</span><span className="font-semibold text-gray-900">${pipeline.avg_deal_size.toFixed(0)}</span></div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Source Attribution</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(pipeline.source_attribution_pct).map(([source, share]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-gray-500 capitalize">{source.replace('_', ' ')}</span>
                <span className="font-semibold text-gray-900">{share}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Active FAIRCASE Deals</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Prob</th>
              <th className="px-4 py-3">Next Step</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.deal_register.map((deal) => (
              <tr key={deal.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{deal.account}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{deal.segment}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{deal.stage}</td>
                <td className="px-4 py-3 text-gray-900 font-semibold">${deal.value.toFixed(0)}</td>
                <td className="px-4 py-3 text-gray-500">{pct(deal.probability * 100)}</td>
                <td className="px-4 py-3 text-gray-500">{deal.next_step}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
