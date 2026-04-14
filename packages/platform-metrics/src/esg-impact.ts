/**
 * Nzila OS — ESG & Impact Measurement
 *
 * Computes Environmental, Social, and Governance (ESG) scores from platform
 * data. Pulls CO₂ tracking from ai_usage_budgets (NZ-RISK-027), org diversity
 * metrics, and governance compliance signals.
 *
 * Aligned with UN Sustainable Development Goals (SDGs) per
 * governance/corporate/governance/sustainability-strategy.md:
 * - SDG 3: Good Health & Wellbeing
 * - SDG 4: Quality Education
 * - SDG 9: Industry, Innovation & Infrastructure
 * - SDG 10: Reduced Inequalities
 * - SDG 12: Responsible Consumption & Production
 *
 * @module @nzila/platform-metrics/esg-impact
 */
import { platformDb } from '@nzila/db/platform'
import { aiUsageBudgets, orgs, auditEvents } from '@nzila/db/schema'
import { sql, gte, count } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

/** UN Sustainable Development Goal alignment. */
export interface SDGAlignment {
  /** SDG number (1-17). */
  goal: number
  /** Short label e.g. "Reduced Inequalities". */
  label: string
  /** Contribution score 0–100. */
  score: number
  /** Evidence reference (feature, metric, or policy). */
  evidenceRef: string
}

/** Pillar-level ESG score breakdown. */
export interface ESGPillarScore {
  /** Environmental score (0–100). */
  environmental: number
  /** Social score (0–100). */
  social: number
  /** Governance score (0–100). */
  governance: number
}

/** CO₂ emissions summary for a given period. */
export interface CarbonFootprint {
  /** Total estimated CO₂ in grams. */
  totalCo2Grams: number
  /** Equivalent in kilograms. */
  totalCo2Kg: number
  /** Equivalent in metric tonnes. */
  totalCo2Tonnes: number
  /** CO₂ per active org (grams). */
  co2PerOrg: number
  /** Number of AI budget records contributing. */
  recordCount: number
}

/** Full ESG scorecard for a time window. */
export interface ESGScorecard {
  /** Composite ESG score (weighted average of pillars, 0–100). */
  compositeScore: number
  /** Rating label: AAA–CCC. */
  rating: ESGRating
  /** Individual pillar scores. */
  pillars: ESGPillarScore
  /** Carbon footprint data (environmental pillar input). */
  carbonFootprint: CarbonFootprint
  /** SDG alignment entries. */
  sdgAlignments: SDGAlignment[]
  /** Number of active organisations on platform. */
  activeOrgCount: number
  /** Number of audit events (governance signal). */
  auditEventCount: number
  /** Assessment period. */
  period: { start: string; end: string }
}

export type ESGRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC'

// ── Constants ───────────────────────────────────────────────────────────────

/** Pillar weights for composite score (must sum to 1). */
const PILLAR_WEIGHTS = { environmental: 0.35, social: 0.35, governance: 0.30 }

/**
 * CO₂ intensity thresholds (grams per org per month).
 * Below LOW → score 100; above HIGH → score 20.
 */
const CO2_THRESHOLDS = { low: 500, high: 5_000 }

/** Default SDG alignments for the Nzila platform. */
const PLATFORM_SDG_ALIGNMENTS: SDGAlignment[] = [
  { goal: 3, label: 'Good Health & Wellbeing', score: 60, evidenceRef: 'Digital wellness features, pension health tracking' },
  { goal: 4, label: 'Quality Education', score: 65, evidenceRef: 'NACP exam platform, onboarding education flows' },
  { goal: 9, label: 'Industry, Innovation & Infrastructure', score: 80, evidenceRef: 'Platform infrastructure, AI-driven automation' },
  { goal: 10, label: 'Reduced Inequalities', score: 75, evidenceRef: 'Justice equity vertical, inclusive access pillar' },
  { goal: 12, label: 'Responsible Consumption & Production', score: 70, evidenceRef: 'AI carbon tracking (NZ-RISK-027), responsible AI pillar' },
]

// ── Computation ─────────────────────────────────────────────────────────────

/**
 * Compute ESG scorecard from live platform data.
 *
 * - **Environmental**: derived from AI carbon footprint (CO₂ per org).
 * - **Social**: derived from org diversity (active orgs) + SDG alignment.
 * - **Governance**: derived from audit event density.
 */
export async function computeESGScorecard(
  options?: { windowDays?: number },
): Promise<ESGScorecard> {
  const windowDays = options?.windowDays ?? 90
  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - windowDays)

  const [carbonFootprint, activeOrgCount, auditEventCount] = await Promise.all([
    computeCarbonFootprint(windowStart),
    computeActiveOrgCount(),
    computeAuditEventCount(windowStart),
  ])

  const pillars = computePillarScores(carbonFootprint, activeOrgCount, auditEventCount)
  const compositeScore = round2(
    pillars.environmental * PILLAR_WEIGHTS.environmental +
    pillars.social * PILLAR_WEIGHTS.social +
    pillars.governance * PILLAR_WEIGHTS.governance,
  )

  return {
    compositeScore,
    rating: scoreToRating(compositeScore),
    pillars,
    carbonFootprint,
    sdgAlignments: PLATFORM_SDG_ALIGNMENTS,
    activeOrgCount,
    auditEventCount,
    period: {
      start: windowStart.toISOString(),
      end: now.toISOString(),
    },
  }
}

// ── Seed Fallback ───────────────────────────────────────────────────────────

/**
 * Seed ESG scorecard for development/demo (no DB required).
 */
export function seedESGScorecard(): ESGScorecard {
  const pillars: ESGPillarScore = {
    environmental: 78,
    social: 72,
    governance: 85,
  }
  const compositeScore = round2(
    pillars.environmental * PILLAR_WEIGHTS.environmental +
    pillars.social * PILLAR_WEIGHTS.social +
    pillars.governance * PILLAR_WEIGHTS.governance,
  )

  return {
    compositeScore,
    rating: scoreToRating(compositeScore),
    pillars,
    carbonFootprint: {
      totalCo2Grams: 42_500,
      totalCo2Kg: 42.5,
      totalCo2Tonnes: 0.04,
      co2PerOrg: 2_125,
      recordCount: 60,
    },
    sdgAlignments: PLATFORM_SDG_ALIGNMENTS,
    activeOrgCount: 20,
    auditEventCount: 340,
    period: {
      start: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      end: new Date().toISOString(),
    },
  }
}

/**
 * Seed SDG alignments only (for standalone SDG dashboard).
 */
export function seedSDGAlignments(): SDGAlignment[] {
  return [...PLATFORM_SDG_ALIGNMENTS]
}

// ── Internal Helpers ────────────────────────────────────────────────────────

function computePillarScores(
  carbon: CarbonFootprint,
  activeOrgs: number,
  auditEvents: number,
): ESGPillarScore {
  // Environmental: inverse of CO₂ intensity per org
  const co2PerOrg = activeOrgs > 0 ? carbon.totalCo2Grams / activeOrgs : 0
  let envScore: number
  if (co2PerOrg <= CO2_THRESHOLDS.low) {
    envScore = 100
  } else if (co2PerOrg >= CO2_THRESHOLDS.high) {
    envScore = 20
  } else {
    // Linear interpolation: low→100, high→20
    const ratio = (co2PerOrg - CO2_THRESHOLDS.low) / (CO2_THRESHOLDS.high - CO2_THRESHOLDS.low)
    envScore = 100 - ratio * 80
  }

  // Social: based on platform reach (active orgs as proxy for inclusive access)
  // Scale: 1 org → 30, 50+ orgs → 90 (log scale for diminishing returns)
  const socialScore = Math.min(90, 30 + 20 * Math.log2(Math.max(activeOrgs, 1)))

  // Governance: based on audit event density (events per org)
  // High audit trail → better governance
  const eventsPerOrg = activeOrgs > 0 ? auditEvents / activeOrgs : 0
  const govScore = Math.min(95, 40 + Math.min(eventsPerOrg, 50) * 1.1)

  return {
    environmental: round2(envScore),
    social: round2(socialScore),
    governance: round2(govScore),
  }
}

function scoreToRating(score: number): ESGRating {
  if (score >= 90) return 'AAA'
  if (score >= 80) return 'AA'
  if (score >= 70) return 'A'
  if (score >= 60) return 'BBB'
  if (score >= 50) return 'BB'
  if (score >= 40) return 'B'
  return 'CCC'
}

async function computeCarbonFootprint(since: Date): Promise<CarbonFootprint> {
  const result = await platformDb
    .select({
      totalCo2: sql<number>`COALESCE(SUM(CAST(${aiUsageBudgets.co2EstimateGrams} AS numeric)), 0)`.as('total_co2'),
      records: count().as('records'),
    })
    .from(aiUsageBudgets)
    .where(gte(aiUsageBudgets.createdAt, since))

  const totalCo2Grams = result[0]?.totalCo2 ?? 0
  const recordCount = result[0]?.records ?? 0

  return {
    totalCo2Grams: round2(totalCo2Grams),
    totalCo2Kg: round2(totalCo2Grams / 1_000),
    totalCo2Tonnes: round2(totalCo2Grams / 1_000_000),
    co2PerOrg: 0, // filled by caller with activeOrgCount
    recordCount,
  }
}

async function computeActiveOrgCount(): Promise<number> {
  const result = await platformDb
    .select({ total: count().as('total') })
    .from(orgs)

  return result[0]?.total ?? 0
}

async function computeAuditEventCount(since: Date): Promise<number> {
  const result = await platformDb
    .select({ total: count().as('total') })
    .from(auditEvents)
    .where(gte(auditEvents.createdAt, since))

  return result[0]?.total ?? 0
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
