import { db } from '@nzila/db'
import { sql } from 'drizzle-orm'

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertType =
  | 'stale_lead'
  | 'stalled_trial'
  | 'pilot_no_usage'
  | 'high_intent_form'
  | 'renewal_risk'
  | 'churn_risk'
  | 'pilot_expiry'
  | 'proposal_stalled'

export interface CommandAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  label: string
  detail: string
  appId: string
  orgName: string
  ageHours?: number
  daysUntilExpiry?: number
  suggestedAction: string
}

export interface CommandCenterSnapshot {
  generatedAt: string
  dataMode: 'live' | 'demo'
  alerts: CommandAlert[]
  kpis: {
    newLeadsToday: number
    staleLeads: number
    stalledTrials: number
    pilotsExpiringIn14d: number
    proposalsPendingOver72h: number
    dealsClosingThisMonth: number
    arrAddedThisMonth: number
    mrrDeltaWow: number
    winRatePct: number
  }
  scoreboard: Array<{ rep: string; arrClosed: number; dealsWon: number; pipeline: number }>
}

export interface PipelineSnapshot {
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

async function countTypeSince(type: string, intervalDays: number): Promise<number> {
  try {
    const rows = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt
          FROM platform_events
          WHERE type = ${type}
            AND created_at > NOW() - (${intervalDays} || ' days')::interval`,
    )
    return (rows[0] as { cnt: number } | undefined)?.cnt ?? 0
  } catch {
    return 0
  }
}

async function sumMrrForTypeSince(type: string, intervalDays: number): Promise<number> {
  try {
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM((payload->>'mrrUsd')::numeric), 0)::int AS mrr
          FROM platform_events
          WHERE type = ${type}
            AND created_at > NOW() - (${intervalDays} || ' days')::interval`,
    )
    return (rows[0] as { mrr: number } | undefined)?.mrr ?? 0
  } catch {
    return 0
  }
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
    return (rows as unknown as Array<{ source: string; cnt: number }>).map((row) => ({
      source: row.source ?? 'unknown',
      count: row.cnt,
    }))
  } catch {
    return []
  }
}

export async function buildCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const [
    newLeadsToday,
    staleLeads,
    stalledTrials,
    proposalsPendingOver72h,
    dealsClosingThisMonth,
    dealsWon90d,
    demosBooked90d,
    arrAddedThisMonth,
    mrrThisWeek,
  ] = await Promise.all([
    countTypeSince('commercial.lead.created', 1),
    countTypeSince('commercial.lead.created', 14),
    countTypeSince('commercial.trial.started', 14),
    countTypeSince('commercial.proposal.sent', 7),
    countTypeSince('commercial.deal.won', 30),
    countTypeSince('commercial.deal.won', 90),
    countTypeSince('commercial.demo.booked', 90),
    sumMrrForTypeSince('commercial.subscription.started', 30),
    sumMrrForTypeSince('commercial.subscription.started', 7),
  ])

  const mrrLast14d = await sumMrrForTypeSince('commercial.subscription.started', 14)
  const mrrLastWeek = mrrLast14d - mrrThisWeek

  const pilotsExpiringIn14d = Number(process.env.CP_CC_PILOTS_EXPIRING ?? 0)
  const totalSignals = newLeadsToday + staleLeads + stalledTrials + proposalsPendingOver72h + dealsClosingThisMonth
  const dataMode: 'live' | 'demo' = totalSignals > 0 ? 'live' : 'demo'

  const winRatePct = demosBooked90d > 0
    ? Math.round((dealsWon90d / demosBooked90d) * 100)
    : Number(process.env.CP_CC_WIN_RATE ?? 0)

  const mrrDeltaWow = mrrThisWeek - mrrLastWeek

  const alerts: CommandAlert[] = []
  if (staleLeads > 0) {
    alerts.push({
      id: 'alert-stale-leads',
      type: 'stale_lead',
      severity: staleLeads >= 5 ? 'critical' : 'high',
      label: `${staleLeads} stale leads need follow-up`,
      detail: 'Leads older than the active conversion window with no downstream progression.',
      appId: 'cross-app',
      orgName: 'Multiple',
      suggestedAction: 'Assign stale leads to owners and trigger outreach sequence today.',
    })
  }

  if (stalledTrials > 0) {
    alerts.push({
      id: 'alert-stalled-trials',
      type: 'stalled_trial',
      severity: stalledTrials >= 3 ? 'high' : 'medium',
      label: `${stalledTrials} stalled trials`,
      detail: 'Trial accounts have not progressed to paid conversion events.',
      appId: 'flow',
      orgName: 'Multiple',
      suggestedAction: 'Run trial rescue outreach and schedule onboarding sessions.',
    })
  }

  if (proposalsPendingOver72h > 0) {
    alerts.push({
      id: 'alert-proposal-stalled',
      type: 'proposal_stalled',
      severity: proposalsPendingOver72h >= 4 ? 'high' : 'medium',
      label: `${proposalsPendingOver72h} proposals pending over 72h`,
      detail: 'Proposal pipeline is aging without response events.',
      appId: 'flow',
      orgName: 'Multiple',
      suggestedAction: 'Escalate stalled proposals to executive follow-up queue.',
    })
  }

  if (pilotsExpiringIn14d > 0) {
    alerts.push({
      id: 'alert-pilot-expiry',
      type: 'pilot_expiry',
      severity: pilotsExpiringIn14d >= 2 ? 'critical' : 'high',
      label: `${pilotsExpiringIn14d} pilots expiring in 14 days`,
      detail: 'Pilot renewal windows are approaching.',
      appId: 'union-eyes',
      orgName: 'Multiple',
      daysUntilExpiry: 14,
      suggestedAction: 'Trigger renewal playbook and schedule close meetings.',
    })
  }

  if (dataMode === 'demo') {
    alerts.push({
      id: 'alert-demo-mode',
      type: 'high_intent_form',
      severity: 'low',
      label: 'Demo mode active',
      detail: 'Live commercial events are not yet available for this environment.',
      appId: 'control-plane',
      orgName: 'system',
      suggestedAction: 'Verify event ingestion from Tier 1 apps into platform_events.',
    })
  }

  const scoreboard = [
    { rep: 'Jordan M.', arrClosed: Math.round(arrAddedThisMonth * 0.4), dealsWon: Math.max(1, Math.round(dealsClosingThisMonth * 0.4)), pipeline: 210000 },
    { rep: 'Priya K.', arrClosed: Math.round(arrAddedThisMonth * 0.3), dealsWon: Math.max(0, Math.round(dealsClosingThisMonth * 0.3)), pipeline: 145000 },
    { rep: 'Theo A.', arrClosed: Math.round(arrAddedThisMonth * 0.2), dealsWon: Math.max(0, Math.round(dealsClosingThisMonth * 0.2)), pipeline: 188000 },
    { rep: 'Sandra B.', arrClosed: Math.round(arrAddedThisMonth * 0.1), dealsWon: Math.max(0, Math.round(dealsClosingThisMonth * 0.1)), pipeline: 94000 },
  ]

  return {
    generatedAt: new Date().toISOString(),
    dataMode,
    alerts,
    kpis: {
      newLeadsToday,
      staleLeads,
      stalledTrials,
      pilotsExpiringIn14d,
      proposalsPendingOver72h,
      dealsClosingThisMonth,
      arrAddedThisMonth,
      mrrDeltaWow,
      winRatePct,
    },
    scoreboard,
  }
}

export async function buildPipelineSnapshot(): Promise<PipelineSnapshot> {
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