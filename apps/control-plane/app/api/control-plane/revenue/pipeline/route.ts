import { NextResponse } from 'next/server'

interface PipelineSnapshot {
  generatedAt: string
  leadsBySource: Array<{ source: string; count: number }>
  demosBooked: number
  proposalsSent: number
  pilotsActive: number
  dealsWon: number
  mrr: number
  arr: number
  arpu: number
  forecastArr90d: number
}

function buildSnapshot(): PipelineSnapshot {
  const leadsBySource = [
    { source: 'union-eyes-contact', count: Number(process.env.CP_LEADS_UE ?? 14) },
    { source: 'flow-trial-signup', count: Number(process.env.CP_LEADS_FLOW ?? 23) },
    { source: 'zonga-contact-page', count: Number(process.env.CP_LEADS_ZONGA ?? 31) },
  ]

  const demosBooked = Number(process.env.CP_DEMOS_BOOKED ?? 18)
  const proposalsSent = Number(process.env.CP_PROPOSALS_SENT ?? 11)
  const pilotsActive = Number(process.env.CP_PILOTS_ACTIVE ?? 6)
  const dealsWon = Number(process.env.CP_DEALS_WON ?? 4)
  const mrr = Number(process.env.CP_MRR ?? 18250)
  const arr = mrr * 12
  const arpu = dealsWon > 0 ? Math.round(mrr / dealsWon) : 0
  const forecastArr90d = Number(process.env.CP_FORECAST_ARR_90D ?? 420000)

  return {
    generatedAt: new Date().toISOString(),
    leadsBySource,
    demosBooked,
    proposalsSent,
    pilotsActive,
    dealsWon,
    mrr,
    arr,
    arpu,
    forecastArr90d,
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, data: buildSnapshot() })
}
