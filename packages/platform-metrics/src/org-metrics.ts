/**
 * Nzila OS — Org-level performance metrics
 *
 * Deterministic calculations with no external API dependencies.
 * All data sourced from the platform database.
 *
 * @module @nzila/platform-metrics/org
 */
import { platformDb } from '@nzila/db/platform'
import {
  auditEvents,
  ueCases,
  zongaRevenueEvents,
  commerceCustomers,
} from '@nzila/db/schema'
import { eq, count, sql, and, gte } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

export interface OrgPerformanceMetrics {
  /** (baseline - current) / baseline; 0-1 range, higher is better */
  operationalEfficiency: number
  /** (cases_on_time / total_cases) * 100 */
  slaAdherence: number
  /** total_revenue / time_window_days */
  revenueVelocity: number
  /** normalized engagement score 0-100 */
  userEngagementScore: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASELINE_PROCESSING_DAYS = 14 // default baseline for processing time

/**
 * Compute org-level performance metrics from live DB data.
 *
 * All formulas are deterministic and derived solely from DB rows.
 * No external API calls are made.
 */
export async function getOrgPerformanceMetrics(
  orgId: string,
  options?: { windowDays?: number },
): Promise<OrgPerformanceMetrics> {
  const windowDays = options?.windowDays ?? 30
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - windowDays)

  const [efficiency, sla, revenue, engagement] = await Promise.all([
    computeOperationalEfficiency(orgId, windowStart),
    computeSlaAdherence(orgId),
    computeRevenueVelocity(orgId, windowStart, windowDays),
    computeUserEngagement(orgId, windowStart),
  ])

  return {
    operationalEfficiency: efficiency,
    slaAdherence: sla,
    revenueVelocity: revenue,
    userEngagementScore: engagement,
  }
}

// ── Operational Efficiency ──────────────────────────────────────────────────
// Efficiency = (Baseline_Time - Current_Time) / Baseline_Time

async function computeOperationalEfficiency(
  orgId: string,
  windowStart: Date,
): Promise<number> {
  // Use UE cases as the efficiency proxy — average resolution time vs baseline
  const result = await platformDb
    .select({
      avgDays: sql<number>`
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (${ueCases.updatedAt} - ${ueCases.createdAt})) / 86400),
          ${BASELINE_PROCESSING_DAYS}
        )
      `.as('avg_days'),
    })
    .from(ueCases)
    .where(
      and(
        eq(ueCases.entityId, orgId),
        eq(ueCases.status, 'resolved'),
        gte(ueCases.createdAt, windowStart),
      ),
    )

  const currentDays = result[0]?.avgDays ?? BASELINE_PROCESSING_DAYS
  const efficiency = (BASELINE_PROCESSING_DAYS - currentDays) / BASELINE_PROCESSING_DAYS
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, efficiency))
}

// ── SLA Adherence ───────────────────────────────────────────────────────────
// SLA_adherence = (cases_on_time / total_cases) * 100

async function computeSlaAdherence(orgId: string): Promise<number> {
  const result = await platformDb
    .select({
      total: count().as('total'),
      onTime: sql<number>`COUNT(*) FILTER (WHERE ${ueCases.slaBreached} = false)`.as(
        'on_time',
      ),
    })
    .from(ueCases)
    .where(eq(ueCases.entityId, orgId))

  const { total, onTime } = result[0] ?? { total: 0, onTime: 0 }
  if (total === 0) return 100
  return (onTime / total) * 100
}

// ── Revenue Velocity ────────────────────────────────────────────────────────
// Revenue_velocity = total_revenue / time_window

async function computeRevenueVelocity(
  orgId: string,
  windowStart: Date,
  windowDays: number,
): Promise<number> {
  const result = await platformDb
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${zongaRevenueEvents.amount} AS numeric)), 0)`.as(
        'total_revenue',
      ),
    })
    .from(zongaRevenueEvents)
    .where(
      and(
        eq(zongaRevenueEvents.entityId, orgId),
        gte(zongaRevenueEvents.createdAt, windowStart),
      ),
    )

  const total = result[0]?.totalRevenue ?? 0
  return total / windowDays // dollars per day
}

// ── User Engagement Score ───────────────────────────────────────────────────
// Normalized composite: audit event density + customer interaction rate

async function computeUserEngagement(
  orgId: string,
  windowStart: Date,
): Promise<number> {
  const [auditResult, customerResult] = await Promise.all([
    platformDb
      .select({ total: count().as('total') })
      .from(auditEvents)
      .where(
        and(eq(auditEvents.entityId, orgId), gte(auditEvents.createdAt, windowStart)),
      ),
    platformDb
      .select({ total: count().as('total') })
      .from(commerceCustomers)
      .where(
        and(eq(commerceCustomers.entityId, orgId), gte(commerceCustomers.createdAt, windowStart)),
      ),
  ])

  const auditCount = auditResult[0]?.total ?? 0
  const customerCount = customerResult[0]?.total ?? 0

  // Normalize: cap each component at 50, total max 100
  const auditScore = Math.min(50, auditCount / 2)
  const customerScore = Math.min(50, customerCount * 5)
  return Math.round(auditScore + customerScore)
}
