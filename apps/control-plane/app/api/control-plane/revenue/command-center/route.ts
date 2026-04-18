import { NextResponse } from 'next/server'

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

function buildCommandCenter(): CommandCenterSnapshot {
  // Env-driven with realistic defaults — will be replaced by event-store queries in Phase 6.
  const newLeadsToday = Number(process.env.CP_CC_LEADS_TODAY ?? 4)
  const staleLeads = Number(process.env.CP_CC_STALE_LEADS ?? 7)
  const stalledTrials = Number(process.env.CP_CC_STALLED_TRIALS ?? 3)
  const pilotsExpiringIn14d = Number(process.env.CP_CC_PILOTS_EXPIRING ?? 2)
  const proposalsPendingOver72h = Number(process.env.CP_CC_PROPOSALS_STALLED ?? 4)
  const dealsClosingThisMonth = Number(process.env.CP_CC_DEALS_CLOSING ?? 3)
  const arrAddedThisMonth = Number(process.env.CP_CC_ARR_ADDED ?? 42000)
  const mrrDeltaWow = Number(process.env.CP_CC_MRR_DELTA_WOW ?? 1850)
  const winRatePct = Number(process.env.CP_CC_WIN_RATE ?? 38)

  const alerts: CommandAlert[] = [
    {
      id: 'alert-001',
      type: 'stale_lead',
      severity: 'critical',
      label: 'UnionEyes lead — no outreach in 48h',
      detail: 'Local 847 (Healthcare, ON) — submitted pilot request 2 days ago, no rep assigned.',
      appId: 'union-eyes',
      orgName: 'Local 847',
      ageHours: 51,
      suggestedAction: 'Assign to rep and send intro within 4 hours to prevent cold.',
    },
    {
      id: 'alert-002',
      type: 'stale_lead',
      severity: 'high',
      label: '3 Flow trial signups — no follow-up',
      detail: 'Trial accounts from Greenfield Imports, KumoTech, and AfriShip — no demo scheduled.',
      appId: 'flow',
      orgName: 'Multiple',
      ageHours: 36,
      suggestedAction: 'Send demo invite sequence today. These are high-intent form completions.',
    },
    {
      id: 'alert-003',
      type: 'stalled_trial',
      severity: 'high',
      label: 'Flow trial — no login in 7 days',
      detail: 'DistroHub Ltd. signed up 10 days ago but has not logged in since day 3.',
      appId: 'flow',
      orgName: 'DistroHub Ltd.',
      ageHours: 168,
      suggestedAction: 'Send re-activation email with success video. Offer onboarding call.',
    },
    {
      id: 'alert-004',
      type: 'pilot_expiry',
      severity: 'critical',
      label: 'UnionEyes pilot expiring in 11 days',
      detail: 'CUPE Local 5001 pilot ends in 11 days. No renewal discussion initiated.',
      appId: 'union-eyes',
      orgName: 'CUPE Local 5001',
      daysUntilExpiry: 11,
      suggestedAction: 'Schedule executive close call this week. Prepare ROI report from pilot data.',
    },
    {
      id: 'alert-005',
      type: 'pilot_expiry',
      severity: 'high',
      label: 'UnionEyes pilot expiring in 14 days',
      detail: 'Steelworkers District 6 pilot ends in 14 days. In procurement review stage.',
      appId: 'union-eyes',
      orgName: 'Steelworkers District 6',
      daysUntilExpiry: 14,
      suggestedAction: 'Share case study outcomes. Confirm budget holder is in loop.',
    },
    {
      id: 'alert-006',
      type: 'proposal_stalled',
      severity: 'high',
      label: 'Flow proposal pending 96h without response',
      detail: 'Amara Commodities — $38K ARR proposal sent 4 days ago. No reply.',
      appId: 'flow',
      orgName: 'Amara Commodities',
      ageHours: 96,
      suggestedAction: 'Follow up with CEO directly. Try phone if email has no response by EOD.',
    },
    {
      id: 'alert-007',
      type: 'renewal_risk',
      severity: 'medium',
      label: 'Zonga label tier — renewal risk flagged',
      detail: 'Afro Waves Label — usage dropped 40% MoM. At risk of downgrade or cancel.',
      appId: 'zonga',
      orgName: 'Afro Waves Label',
      suggestedAction: 'Book feature walkthrough call. Show underused distribution analytics.',
    },
    {
      id: 'alert-008',
      type: 'high_intent_form',
      severity: 'medium',
      label: '4 new Zonga Pro Creator signups today',
      detail: 'New Pro Creator subs from Lagos (2), Nairobi (1), Johannesburg (1).',
      appId: 'zonga',
      orgName: 'Multiple',
      suggestedAction: 'Trigger onboarding email sequence. Flag for creator success team.',
    },
  ]

  const scoreboard = [
    { rep: 'Jordan M.', arrClosed: 96000, dealsWon: 3, pipeline: 210000 },
    { rep: 'Priya K.', arrClosed: 72000, dealsWon: 2, pipeline: 145000 },
    { rep: 'Theo A.', arrClosed: 42000, dealsWon: 1, pipeline: 188000 },
    { rep: 'Sandra B.', arrClosed: 18000, dealsWon: 1, pipeline: 94000 },
  ]

  return {
    generatedAt: new Date().toISOString(),
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

export async function GET() {
  return NextResponse.json({ ok: true, data: buildCommandCenter() })
}
