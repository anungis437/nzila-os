/**
 * @nzila/ml-sdk — Server-side data access layer
 *
 * This module is the ONLY authorised non-console path to ML database tables.
 * Apps (e.g. partners portal) must call these helper functions instead of
 * importing ML tables directly from @nzila/db/schema, which would violate INV-02.
 *
 * This module is server-only (Node.js runtime; never shipped to the browser).
 */
import { db } from '@nzila/db'
import { mlScoresStripeDaily, mlScoresStripeTxn, mlModels } from '@nzila/db/schema'
import { eq, and, desc, gte, count } from 'drizzle-orm'

export interface PartnerMlSummary {
  entityId: string
  daysScored: number
  recentAnomalyDays: number
  totalDailyAnomalies: number
  totalTxnAnomalies: number
  recentDailyScores: Array<{
    date: string
    isAnomaly: boolean
    score: string
    modelKey: string
  }>
}

/**
 * Returns an aggregate ML anomaly summary for the given entity.
 * "Recent" is defined as the last 30 days of daily scores.
 *
 * This is the server-side implementation backing the partner portal's
 * /portal/api/ml/summary endpoint.
 */
export async function getPartnerMlSummary(entityId: string): Promise<PartnerMlSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [recentDailyScores, [totalTxnAnomalies], [totalDailyAnomalies]] = await Promise.all([
    db
      .select({
        date: mlScoresStripeDaily.date,
        isAnomaly: mlScoresStripeDaily.isAnomaly,
        score: mlScoresStripeDaily.score,
        modelKey: mlModels.modelKey,
      })
      .from(mlScoresStripeDaily)
      .innerJoin(mlModels, eq(mlScoresStripeDaily.modelId, mlModels.id))
      .where(
        and(
          eq(mlScoresStripeDaily.entityId, entityId),
          gte(mlScoresStripeDaily.date, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(mlScoresStripeDaily.date))
      .limit(30),

    db
      .select({ count: count() })
      .from(mlScoresStripeTxn)
      .where(
        and(
          eq(mlScoresStripeTxn.entityId, entityId),
          eq(mlScoresStripeTxn.isAnomaly, true),
        ),
      ),

    db
      .select({ count: count() })
      .from(mlScoresStripeDaily)
      .where(
        and(
          eq(mlScoresStripeDaily.entityId, entityId),
          eq(mlScoresStripeDaily.isAnomaly, true),
        ),
      ),
  ])

  const daysScored = recentDailyScores.length
  const recentAnomalyDays = recentDailyScores.filter((s) => s.isAnomaly).length

  return {
    entityId,
    daysScored,
    recentAnomalyDays,
    totalDailyAnomalies: totalDailyAnomalies?.count ?? 0,
    totalTxnAnomalies: totalTxnAnomalies?.count ?? 0,
    recentDailyScores: recentDailyScores.map((s) => ({
      date: s.date,
      isAnomaly: s.isAnomaly,
      score: String(s.score),
      modelKey: s.modelKey,
    })),
  }
}
