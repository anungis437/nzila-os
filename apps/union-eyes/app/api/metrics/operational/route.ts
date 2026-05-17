/**
 * GET /api/metrics/operational
 *
 * Exposes operational metrics for observability dashboards:
 * - request_count (proxy — relies on external APM; returns placeholder)
 * - error_rate
 * - workflow_transition_rate
 * - queue_depth
 * - sla_violations
 */
import { NextResponse } from 'next/server'
import { db } from '@/db/db'
import { claims, claimUpdates } from '@/db/schema'
import { eq, sql, count, gte, and } from 'drizzle-orm'
import { getAllQueueStats } from '@/lib/job-queue'
import { requireApiAuth } from '@/lib/api-auth-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Auth check must be outside the data-query try-catch so auth errors are
  // returned as 401/403, not swallowed as a generic 500.
  const svcKey = process.env.AI_SERVICE_KEY
  const isServiceRequest = !!svcKey && req.headers.get('x-service-key') === svcKey
  if (!isServiceRequest) {
    try {
      await requireApiAuth()
    } catch (authErr) {
      const msg = authErr instanceof Error ? authErr.message : String(authErr)
      const status = msg.toLowerCase().includes('forbidden') ? 403 : 401
      return NextResponse.json({ error: msg }, { status })
    }
  }

  try {
    const [
      totalClaimsResult,
      recentTransitionsResult,
      slaViolationsResult,
      queueStatsResult,
      recentErrorsResult,
    ] = await Promise.allSettled([
      // Total claims
      db.select({ count: count() }).from(claims),

      // Workflow transitions in last 24h
      db
        .select({ count: count() })
        .from(claimUpdates)
        .where(
          and(
            eq(claimUpdates.updateType, 'status_change'),
            gte(claimUpdates.createdAt, oneDayAgo),
          ),
        ),

      // SLA violations: claims past their deadline that aren't closed
      db
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            sql`${claims.status} NOT IN ('closed', 'resolved', 'rejected')`,
            sql`${claims.updatedAt} < NOW() - INTERVAL '5 days'`,
          ),
        ),

      // Queue depth from Celery
      getAllQueueStats().catch(() => [] as Awaited<ReturnType<typeof getAllQueueStats>>),

      // Error-like updates in last 24h (crude proxy)
      db.select({ count: count() }).from(claimUpdates).where(
        and(
          sql`${claimUpdates.message} ILIKE '%error%' OR ${claimUpdates.message} ILIKE '%failed%'`,
          gte(claimUpdates.createdAt, oneDayAgo),
        ),
      ),
    ])

    const totalClaims =
      totalClaimsResult.status === 'fulfilled' ? totalClaimsResult.value[0]?.count ?? 0 : 0
    const transitionRate =
      recentTransitionsResult.status === 'fulfilled'
        ? recentTransitionsResult.value[0]?.count ?? 0
        : 0
    const slaViolations =
      slaViolationsResult.status === 'fulfilled'
        ? slaViolationsResult.value[0]?.count ?? 0
        : 0
    const queueStats =
      queueStatsResult.status === 'fulfilled' ? queueStatsResult.value : []
    const errorCount =
      recentErrorsResult.status === 'fulfilled'
        ? recentErrorsResult.value[0]?.count ?? 0
        : 0

    const queueDepth = queueStats.reduce(
      (sum, q) => sum + (q.active ?? 0) + (q.reserved ?? 0) + (q.scheduled ?? 0),
      0,
    )

    return NextResponse.json({
      request_count: totalClaims, // lifetime claim count as proxy
      error_rate: totalClaims > 0 ? +(errorCount / Math.max(transitionRate, 1)).toFixed(4) : 0,
      workflow_transition_rate: transitionRate,
      queue_depth: queueDepth,
      sla_violations: slaViolations,
      window: '24h',
      generated_at: now.toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to compute metrics', detail: String(err) },
      { status: 500 },
    )
  }
}

