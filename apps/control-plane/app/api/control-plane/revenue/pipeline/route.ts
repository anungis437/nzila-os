import { NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { sql } from 'drizzle-orm'

interface PipelineSnapshot {
  generatedAt: string
  dataMode: 'live' | 'demo'
  leadsBySource: Array<{ source: string; count: number }>
  demosBooked: number
  proposalsSent: number
  pilotsActive: number
  dealsWon: number
  mrr: number
  arr: number
  arpu: number
  forecastArr90d: number
  funnelConversionPct: number
  trialToPaidPct: number
  pilotToPaidPct: number
  winRatePct: number
  avgSaleCycleDays: number
  expansionRevenue: number
}

async function queryEventCount(type: string, intervalDays = 90): Promise<number> {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt
          FROM platform_events
          WHERE type = ${type}
            AND created_at > NOW() - (${intervalDays} || ' days')::interval`,
    )
    return (result[0] as { cnt: number })?.cnt ?? 0
  } catch {
    return 0
  }
}

async function queryLeadsBySource(intervalDays = 90): Promise<Array<{ source: string; count: number }>> {
  try {
    const rows = await db.execute(
      sql`SELECT
            payload->>'source' AS source,
            COUNT(*)::int AS cnt
          FROM platform_events
          WHERE type = 'commercial.lead.created'
            AND created_at > NOW() - (${intervalDays} || ' days')::interval
          GROUP BY payload->>'source'
          ORDER BY cnt DESC`,
    )
    return (rows as unknown as Array<{ source: string; cnt: number }>).map((r) => ({
      source: r.source ?? 'unknown',
      count: r.cnt,
    }))
  } catch {
    return []
  }
}

async function buildSnapshot(): Promise<PipelineSnapshot> {
  const [
    totalLeads,
    leadsBySourceRaw,
    demosBooked,
    trialsStarted,
    pilotsActive,
    dealsWon,
    subscriptionsStarted,
    subscriptionsUpgraded,
  ] = await Promise.all([
    queryEventCount('commercial.lead.created'),
    queryLeadsBySource(),
    queryEventCount('commercial.demo.booked'),
    queryEventCount('commercial.trial.started'),
    queryEventCount('commercial.pilot.started'),
    queryEventCount('commercial.deal.won'),
    queryEventCount('commercial.subscription.started'),
    queryEventCount('commercial.subscription.upgraded'),
  ])

  // Fall back to env vars if event store returns no data (pre-population)
  const effectiveLeads = totalLeads > 0 ? totalLeads
    : (Number(process.env.CP_LEADS_UE ?? 14) + Number(process.env.CP_LEADS_FLOW ?? 23) + Number(process.env.CP_LEADS_ZONGA ?? 31))
  const effectiveDemos = demosBooked > 0 ? demosBooked : Number(process.env.CP_DEMOS_BOOKED ?? 18)
  const effectiveProposals = Number(process.env.CP_PROPOSALS_SENT ?? 11)
  const effectivePilots = pilotsActive > 0 ? pilotsActive : Number(process.env.CP_PILOTS_ACTIVE ?? 6)
  const effectiveWins = dealsWon > 0 ? dealsWon : Number(process.env.CP_DEALS_WON ?? 4)

  const effectiveLeadsBySource = leadsBySourceRaw.length > 0
    ? leadsBySourceRaw
    : [
        { source: 'union-eyes-contact', count: Number(process.env.CP_LEADS_UE ?? 14) },
        { source: 'flow-trial-signup', count: Number(process.env.CP_LEADS_FLOW ?? 23) },
        { source: 'zonga-contact-page', count: Number(process.env.CP_LEADS_ZONGA ?? 31) },
      ]

  const mrr = Number(process.env.CP_MRR ?? 18250)
  const arr = mrr * 12
  const arpu = effectiveWins > 0 ? Math.round(mrr / effectiveWins) : 0
  const forecastArr90d = Number(process.env.CP_FORECAST_ARR_90D ?? 420000)

  const funnelConversionPct = effectiveLeads > 0 ? Math.round((effectiveWins / effectiveLeads) * 100) : 0
  const trialToPaidPct = trialsStarted > 0
    ? Math.round(((subscriptionsStarted + subscriptionsUpgraded) / trialsStarted) * 100)
    : Number(process.env.CP_TRIAL_TO_PAID_PCT ?? 22)
  const pilotToPaidPct = effectivePilots > 0
    ? Math.round((effectiveWins / effectivePilots) * 100)
    : Number(process.env.CP_PILOT_TO_PAID_PCT ?? 67)
  const winRatePct = effectiveDemos > 0
    ? Math.round((effectiveWins / effectiveDemos) * 100)
    : Number(process.env.CP_WIN_RATE_PCT ?? 38)
  const expansionRevenue = subscriptionsUpgraded * Number(process.env.CP_AVG_EXPANSION_MRR ?? 850)

  const dataMode: 'live' | 'demo' = totalLeads > 0 || demosBooked > 0 || dealsWon > 0 ? 'live' : 'demo'

  return {
    generatedAt: new Date().toISOString(),
    dataMode,
    leadsBySource: effectiveLeadsBySource,
    demosBooked: effectiveDemos,
    proposalsSent: effectiveProposals,
    pilotsActive: effectivePilots,
    dealsWon: effectiveWins,
    mrr,
    arr,
    arpu,
    forecastArr90d,
    funnelConversionPct,
    trialToPaidPct,
    pilotToPaidPct,
    winRatePct,
    avgSaleCycleDays: Number(process.env.CP_AVG_CYCLE_DAYS ?? 28),
    expansionRevenue,
  }
}

export async function GET() {
  const data = await buildSnapshot()
  return NextResponse.json({ ok: true, data })
}
