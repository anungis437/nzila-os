/**
 * @nzila/platform-intelligence-home — Deal Pipeline Service
 *
 * Typed deal pipeline covering pilots, sponsorships, enterprise sales,
 * channel deals, and law firm partnerships across all Nzila products.
 *
 * TODO: Replace SEED_DEALS with DB queries from lh_deal_pipeline table
 * TODO: Wire to @nzila/deal-engine for live deal sync
 */
import type { Deal, DealKpis, DealStage } from './types'

// ── Seed Data ─────────────────────────────────────────────────────────────────
// Representative deals based on Nzila's actual pipeline focus.

const SEED_DEALS: Deal[] = [
  // ── Union Eyes ────────────────────────────────────────────────────────────
  {
    id: 'deal-ue-001',
    name: 'CUPE Ontario — Digital Grievance Pilot',
    org: 'CUPE Ontario',
    product: 'union-eyes',
    dealType: 'pilot',
    stage: 'proposal',
    estimatedValueCad: 0,
    owner: 'Michel Nungisa',
    probability: 60,
    expectedCloseDate: '2026-06-30',
    nextStep: 'Book demo call with CUPE Ontario regional VP. Prepare customized deck showing UE grievance workflow.',
    lastActivityDate: '2026-04-15',
    daysSinceActivity: 5,
    notes: 'Introduced at CLC conference. High interest. Need to convert to formal pilot MOU.',
  },
  {
    id: 'deal-ue-002',
    name: 'Unifor — AI Labour Intelligence Pilot',
    org: 'Unifor Canada',
    product: 'union-eyes',
    dealType: 'pilot',
    stage: 'negotiation',
    estimatedValueCad: 0,
    owner: 'Michel Nungisa',
    probability: 75,
    expectedCloseDate: '2026-05-31',
    nextStep: 'Review pilot MOU draft. Confirm data governance clause with Unifor legal team.',
    lastActivityDate: '2026-04-18',
    daysSinceActivity: 2,
    notes: 'Technical review completed. Unifor IT approved data sharing framework. MOU in final review.',
  },
  {
    id: 'deal-ue-003',
    name: 'Sun Life Financial — Zonga / UE Benefits Sponsor',
    org: 'Sun Life Financial',
    product: 'union-eyes',
    dealType: 'sponsor',
    stage: 'prospect',
    estimatedValueCad: 25_000,
    owner: 'Michel Nungisa',
    probability: 35,
    expectedCloseDate: '2026-09-30',
    nextStep: 'Draft sponsorship deck targeting Sun Life group benefits admin. Contact VP Partnerships.',
    lastActivityDate: '2026-04-01',
    daysSinceActivity: 19,
    notes: 'Sun Life administers benefits for several CUPE locals. Natural co-sponsorship fit.',
  },
  {
    id: 'deal-ue-004',
    name: 'Ontario Teachers Pension — UE Pension Intelligence Pilot',
    org: "Ontario Teachers' Pension Plan",
    product: 'union-eyes',
    dealType: 'pilot',
    stage: 'discovery',
    estimatedValueCad: 15_000,
    owner: 'Michel Nungisa',
    probability: 40,
    expectedCloseDate: '2026-08-31',
    nextStep: 'Schedule discovery call. Prepare Union Eyes pension module demo.',
    lastActivityDate: '2026-03-28',
    daysSinceActivity: 23,
    notes: 'Pension intelligence is a top-requested UE feature. OTPP is the anchor reference customer.',
  },
  {
    id: 'deal-ue-005',
    name: 'Canadian Union of Public Employees — National Deal',
    org: 'CUPE National',
    product: 'union-eyes',
    dealType: 'enterprise_sales',
    stage: 'prospect',
    estimatedValueCad: 120_000,
    owner: 'Michel Nungisa',
    probability: 25,
    expectedCloseDate: '2026-12-31',
    nextStep: 'Establish relationship with CUPE National Research Director. Prepare ROI study.',
    lastActivityDate: '2026-02-14',
    daysSinceActivity: 65,
    notes: 'National CUPE = 700,000 members. Top strategic target. Long sales cycle expected.',
  },
  // ── FairCase ──────────────────────────────────────────────────────────────
  {
    id: 'deal-fc-001',
    name: 'Dentons Canada LLP — FairCase Distribution Partnership',
    org: 'Dentons Canada',
    product: 'faircase',
    dealType: 'law_firm_partnership',
    stage: 'negotiation',
    estimatedValueCad: 200_000,
    owner: 'Michel Nungisa',
    probability: 55,
    expectedCloseDate: '2026-07-31',
    nextStep: 'Review distribution agreement. Agree on referral fee structure. Michel to present at Dentons innovation day.',
    lastActivityDate: '2026-04-17',
    daysSinceActivity: 3,
    notes: 'Dentons Innovation team introduced by mutual contact. Revenue share model under discussion.',
  },
  {
    id: 'deal-fc-002',
    name: 'A2AJ — Access to Justice Research Partnership',
    org: 'A2AJ (Action Committee on Access to Justice)',
    product: 'faircase',
    dealType: 'research',
    stage: 'proposal',
    estimatedValueCad: 0,
    owner: 'Michel Nungisa',
    probability: 65,
    expectedCloseDate: '2026-06-30',
    nextStep: 'Submit MOU for data sharing on A2AJ legal corpus integration into FairCase.',
    lastActivityDate: '2026-04-10',
    daysSinceActivity: 10,
    notes: 'Research partnership unlocks A2AJ legal corpus for FairCase AI. Strategic data moat.',
  },
  {
    id: 'deal-fc-003',
    name: 'Ontario Legal Aid — FairCase Enterprise Pilot',
    org: 'Legal Aid Ontario',
    product: 'faircase',
    dealType: 'pilot',
    stage: 'prospect',
    estimatedValueCad: 50_000,
    owner: 'Michel Nungisa',
    probability: 30,
    expectedCloseDate: '2026-09-30',
    nextStep: 'Contact LAO Director of Technology. Leverage a2aj introduction.',
    lastActivityDate: '2026-03-20',
    daysSinceActivity: 31,
    notes: 'Government procurement path. Long cycle. High value if landed — 20,000 files/year.',
  },
  // ── Flow ──────────────────────────────────────────────────────────────────
  {
    id: 'deal-flow-001',
    name: 'Toronto BIPOC Business Network — Flow SMB Channel',
    org: 'BIPOC Business Network Toronto',
    product: 'flow',
    dealType: 'channel',
    stage: 'proposal',
    estimatedValueCad: 60_000,
    owner: 'Michel Nungisa',
    probability: 50,
    expectedCloseDate: '2026-07-31',
    nextStep: 'Finalize channel partner agreement. Provide Flow co-branded onboarding for their 200 members.',
    lastActivityDate: '2026-04-14',
    daysSinceActivity: 6,
    notes: 'Channel deal: $300/member/yr × 200 members. High efficiency path to SMB revenue.',
  },
  {
    id: 'deal-flow-002',
    name: 'Export Development Canada — Flow Exporter SMB Grant',
    org: 'Export Development Canada',
    product: 'flow',
    dealType: 'distribution',
    stage: 'discovery',
    estimatedValueCad: 0,
    owner: 'Michel Nungisa',
    probability: 40,
    expectedCloseDate: '2026-10-31',
    nextStep: 'Explore EDC partnership for Flow + CanExport SME. Attend EDC partner day.',
    lastActivityDate: '2026-03-15',
    daysSinceActivity: 36,
    notes: 'EDC distributes CanExport through partner network. Flow integration opportunity.',
  },
  // ── Zonga ─────────────────────────────────────────────────────────────────
  {
    id: 'deal-zonga-001',
    name: 'TIFF — Zonga Black Creators Spotlight',
    org: 'Toronto International Film Festival',
    product: 'zonga',
    dealType: 'sponsor',
    stage: 'prospect',
    estimatedValueCad: 15_000,
    owner: 'Michel Nungisa',
    probability: 30,
    expectedCloseDate: '2026-10-31',
    nextStep: 'Approach TIFF partnership team with Afrobeats × film cross-promotion concept.',
    lastActivityDate: '2026-03-01',
    daysSinceActivity: 50,
    notes: 'TIFF × Zonga Afrobeats spotlight during festival week (September). $15K minimum sponsorship.',
  },
  {
    id: 'deal-zonga-002',
    name: 'FACTOR — Zonga Digital Distribution Grant',
    org: 'Foundation Assisting Canadian Talent on Recordings',
    product: 'zonga',
    dealType: 'grant',
    stage: 'proposal',
    estimatedValueCad: 75_000,
    owner: 'Michel Nungisa',
    probability: 70,
    expectedCloseDate: '2026-06-01',
    nextStep: 'Complete FACTOR digital distribution application. Attach Zonga streaming metrics.',
    lastActivityDate: '2026-04-12',
    daysSinceActivity: 8,
    notes: 'FACTOR Digital Distribution stream. Deadline June 1. High confidence based on eligibility review.',
  },
]

// ── Service Functions ────────────────────────────────────────────────────────

/** Returns all deals */
export function getDealPipeline(): Deal[] {
  return SEED_DEALS
}

/** Returns deals by product domain */
export function getDealsByProduct(product: string): Deal[] {
  return SEED_DEALS.filter((d) => d.product === product)
}

/** Returns deals in active stages (not closed, not stale) */
export function getActiveDeals(): Deal[] {
  const inactive: DealStage[] = ['closed_won', 'closed_lost', 'stale']
  return SEED_DEALS.filter((d) => !inactive.includes(d.stage))
}

/** Returns deals with no activity in > 14 days and not closed */
export function getStaleDeals(staleDays = 14): Deal[] {
  const inactive: DealStage[] = ['closed_won', 'closed_lost']
  return SEED_DEALS.filter(
    (d) => !inactive.includes(d.stage) && d.daysSinceActivity > staleDays
  ).sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
}

/** Returns deals with probability >= threshold, sorted by expected value desc */
export function getHighProbabilityDeals(threshold = 50): Deal[] {
  return getActiveDeals()
    .filter((d) => d.probability >= threshold)
    .sort((a, b) => b.probability * b.estimatedValueCad - a.probability * a.estimatedValueCad)
}

/** Compute KPI rollup */
export function getDealKpis(): DealKpis {
  const all = SEED_DEALS
  const active = getActiveDeals()
  const weightedPipeline = active.reduce(
    (sum, d) => sum + (d.estimatedValueCad * d.probability) / 100,
    0
  )
  const avgProb =
    active.length > 0
      ? active.reduce((sum, d) => sum + d.probability, 0) / active.length
      : 0
  const stale = getStaleDeals()
  const closedWon = all.filter((d) => d.stage === 'closed_won')
  const closedWonVal = closedWon.reduce((sum, d) => sum + d.estimatedValueCad, 0)

  return {
    totalDeals: all.length,
    weightedPipelineCad: Math.round(weightedPipeline),
    avgProbability: Math.round(avgProb),
    staleDeals: stale.length,
    closedWonCount: closedWon.length,
    closedWonValueCad: closedWonVal,
    pilotCount: all.filter((d) => d.dealType === 'pilot').length,
    sponsorCount: all.filter((d) => d.dealType === 'sponsor').length,
  }
}
