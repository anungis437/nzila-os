/**
 * Nzila OS — SaaS Unit Economics
 *
 * Live LTV, CAC, NRR, and churn computation from platform data.
 * Closes the "metrics blindness" gap for SaaS unit economics.
 *
 * All formulas are deterministic and derived from DB rows.
 * No external API calls are made.
 *
 * @module @nzila/platform-metrics/unit-economics
 */
import { platformDb } from '@nzila/db/platform'
import {
  orgs,
  zongaRevenueEvents,
  auditEvents,
} from '@nzila/db/schema'
import { count, sql, and, gte, lte, eq } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

export interface SaaSUnitEconomics {
  /** Monthly Recurring Revenue (sum of subscription events / billing period). */
  mrr: number
  /** Annualised Recurring Revenue (MRR × 12). */
  arr: number
  /** Average Revenue Per Account per month. */
  arpa: number
  /** Customer Acquisition Cost (total spend / new orgs). */
  cac: number
  /** Customer Lifetime Value = ARPA × avg lifetime months. */
  ltv: number
  /** LTV:CAC ratio (target ≥ 3.0). */
  ltvCacRatio: number
  /** CAC payback in months (CAC / ARPA). */
  cacPaybackMonths: number
  /** Gross churn rate over the window (% of orgs that cancelled). */
  grossChurnRate: number
  /** Net Revenue Retention: (start + expansion - contraction - churn) / start × 100. */
  nrr: number
  /** Number of active paying orgs. */
  activeOrgCount: number
  /** Window this computation covers (ISO-8601 range). */
  period: { start: string; end: string }
}

export interface CohortRetention {
  /** ISO-8601 month of the cohort (first org activity). */
  cohortMonth: string
  /** Number of orgs in this cohort. */
  cohortSize: number
  /** Retention percentage at month 1, 3, 6, 12. */
  retentionByMonth: Readonly<Record<number, number>>
}

export interface NRRBreakdown {
  startingMRR: number
  expansionMRR: number
  contractionMRR: number
  churnedMRR: number
  endingMRR: number
  nrrPercent: number
}

// ── Computation ─────────────────────────────────────────────────────────────

const ASSUMED_MONTHLY_MARKETING_SPEND = 5_000 // seed default
const ASSUMED_AVG_LIFETIME_MONTHS = 24 // SaaS median

/**
 * Compute SaaS unit economics from live platform data.
 *
 * Uses revenue events + org counts as primary data sources.
 * Falls back to seed defaults where data is insufficient.
 */
export async function computeUnitEconomics(
  options?: { windowDays?: number; marketingSpend?: number },
): Promise<SaaSUnitEconomics> {
  const windowDays = options?.windowDays ?? 30
  const marketingSpend = options?.marketingSpend ?? ASSUMED_MONTHLY_MARKETING_SPEND

  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - windowDays)

  const periodStart = windowStart.toISOString()
  const periodEnd = now.toISOString()

  const [revenueResult, orgCountResult, newOrgResult, churnedResult] =
    await Promise.all([
      computeTotalRevenue(windowStart),
      computeActiveOrgs(),
      computeNewOrgs(windowStart),
      computeChurnedOrgs(windowStart),
    ])

  const activeOrgCount = Math.max(orgCountResult, 1)
  const newOrgs = Math.max(newOrgResult, 1)

  // MRR = total subscription revenue in window normalised to 30 days
  const mrr = (revenueResult / windowDays) * 30
  const arr = mrr * 12
  const arpa = mrr / activeOrgCount

  // CAC = marketing spend / new orgs in window
  const cac = marketingSpend / newOrgs

  // LTV = ARPA × average lifetime
  const ltv = arpa * ASSUMED_AVG_LIFETIME_MONTHS

  const ltvCacRatio = cac > 0 ? ltv / cac : 0
  const cacPaybackMonths = arpa > 0 ? cac / arpa : 0

  // Gross churn = churned orgs / total orgs at start
  const grossChurnRate = activeOrgCount > 0
    ? (churnedResult / (activeOrgCount + churnedResult)) * 100
    : 0

  // NRR approximation from revenue trend
  const nrrBreakdown = await computeNRRBreakdown(windowStart, now)

  return {
    mrr: round2(mrr),
    arr: round2(arr),
    arpa: round2(arpa),
    cac: round2(cac),
    ltv: round2(ltv),
    ltvCacRatio: round2(ltvCacRatio),
    cacPaybackMonths: round2(cacPaybackMonths),
    grossChurnRate: round2(grossChurnRate),
    nrr: round2(nrrBreakdown.nrrPercent),
    activeOrgCount,
    period: { start: periodStart, end: periodEnd },
  }
}

/**
 * Compute NRR breakdown: starting, expansion, contraction, churned, ending.
 */
export async function computeNRRBreakdown(
  windowStart: Date,
  windowEnd: Date,
): Promise<NRRBreakdown> {
  // Prior period = same-length window before windowStart
  const windowMs = windowEnd.getTime() - windowStart.getTime()
  const priorStart = new Date(windowStart.getTime() - windowMs)

  const [priorRevenue, currentRevenue] = await Promise.all([
    computeRevenueInRange(priorStart, windowStart),
    computeRevenueInRange(windowStart, windowEnd),
  ])

  const startingMRR = priorRevenue
  const endingMRR = currentRevenue

  // Simplified NRR: assume expansion = positive delta, contraction = negative delta
  const delta = endingMRR - startingMRR
  const expansionMRR = delta > 0 ? delta : 0
  const contractionMRR = delta < 0 ? Math.abs(delta) : 0
  const churnedMRR = 0 // would need explicit subscription cancellation tracking

  const nrrPercent = startingMRR > 0
    ? ((startingMRR + expansionMRR - contractionMRR - churnedMRR) / startingMRR) * 100
    : 100

  return {
    startingMRR: round2(startingMRR),
    expansionMRR: round2(expansionMRR),
    contractionMRR: round2(contractionMRR),
    churnedMRR: round2(churnedMRR),
    endingMRR: round2(endingMRR),
    nrrPercent: round2(nrrPercent),
  }
}

// ── Seed Fallback ───────────────────────────────────────────────────────────

/**
 * Seed unit economics for development/demo (no DB required).
 */
export function seedUnitEconomics(): SaaSUnitEconomics {
  return {
    mrr: 15_360,
    arr: 184_320,
    arpa: 768,
    cac: 1_250,
    ltv: 18_432,
    ltvCacRatio: 14.7,
    cacPaybackMonths: 1.6,
    grossChurnRate: 3.2,
    nrr: 118.5,
    activeOrgCount: 20,
    period: {
      start: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      end: new Date().toISOString(),
    },
  }
}

/**
 * Seed NRR breakdown.
 */
export function seedNRRBreakdown(): NRRBreakdown {
  return {
    startingMRR: 14_200,
    expansionMRR: 2_860,
    contractionMRR: 520,
    churnedMRR: 180,
    endingMRR: 16_360,
    nrrPercent: 115.2,
  }
}

// ── Internal Helpers ────────────────────────────────────────────────────────

async function computeTotalRevenue(since: Date): Promise<number> {
  const result = await platformDb
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${zongaRevenueEvents.amount} AS numeric)), 0)`.as(
        'total',
      ),
    })
    .from(zongaRevenueEvents)
    .where(gte(zongaRevenueEvents.createdAt, since))

  return result[0]?.total ?? 0
}

async function computeRevenueInRange(start: Date, end: Date): Promise<number> {
  const result = await platformDb
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${zongaRevenueEvents.amount} AS numeric)), 0)`.as(
        'total',
      ),
    })
    .from(zongaRevenueEvents)
    .where(
      and(
        gte(zongaRevenueEvents.createdAt, start),
        lte(zongaRevenueEvents.createdAt, end),
      ),
    )

  return result[0]?.total ?? 0
}

async function computeActiveOrgs(): Promise<number> {
  const result = await platformDb
    .select({ total: count().as('total') })
    .from(orgs)
    .where(eq(orgs.status, 'active'))

  return result[0]?.total ?? 0
}

async function computeNewOrgs(since: Date): Promise<number> {
  const result = await platformDb
    .select({ total: count().as('total') })
    .from(orgs)
    .where(
      and(eq(orgs.status, 'active'), gte(orgs.createdAt, since)),
    )

  return result[0]?.total ?? 0
}

async function computeChurnedOrgs(since: Date): Promise<number> {
  const result = await platformDb
    .select({ total: count().as('total') })
    .from(orgs)
    .where(
      and(
        eq(orgs.status, 'inactive'),
        gte(orgs.updatedAt, since),
      ),
    )

  return result[0]?.total ?? 0
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
