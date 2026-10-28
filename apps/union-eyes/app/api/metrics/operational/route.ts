/**
 * GET /api/metrics/operational
 *
 * Platform-wide operational counters for observability dashboards: workflow transitions in the last 24 hours, claims past
 * their SLA, queue depth and failure-like claim updates.
 *
 * These count every organization's claims, so they are for the platform operator only: a caller presenting the service
 * key (compared in constant time) or a platform administrator. An ordinary signed-in user of any organization is refused.
 * The route used to count claims across all organizations for any signed-in user and for anyone holding the AI service key,
 * and it reported a lifetime claim count as `request_count` and a ratio of claim-update text matches as `error_rate`.
 * Neither is measured here: they are not returned, rather than returned as proxies. A failed read is an error, not zero.
 */
import { NextResponse } from 'next/server'
import { db } from '@/db/db'
import { claims, claimUpdates } from '@/db/schema'
import { eq, sql, count, gte, and } from 'drizzle-orm'
import { getAllQueueStats } from '@/lib/job-queue'
import { requireApiAuth, isPlatformAdminUser } from '@/lib/api-auth-guard'
import { constantTimeEquals } from '@/lib/security/constant-time'

export const dynamic = 'force-dynamic'

async function isPlatformOperator(req: Request): Promise<{ ok: true } | { ok: false; status: 401 | 403 }> {
  if (constantTimeEquals(req.headers.get('x-service-key'), process.env.AI_SERVICE_KEY)) return { ok: true }
  let userId: string | undefined
  try {
    userId = (await requireApiAuth()).userId ?? undefined
  } catch {
    return { ok: false, status: 401 }
  }
  if (!userId) return { ok: false, status: 401 }
  return (await isPlatformAdminUser(userId)) ? { ok: true } : { ok: false, status: 403 }
}

export async function GET(req: Request) {
  const denial = await isPlatformOperator(req)
  if (!denial.ok) {
    return NextResponse.json({ error: denial.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: denial.status })
  }

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  try {
    const [transitions, slaViolations, failureLike, queueStats] = await Promise.all([
      db
        .select({ count: count() })
        .from(claimUpdates)
        .where(and(eq(claimUpdates.updateType, 'status_change'), gte(claimUpdates.createdAt, oneDayAgo))),
      db
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            sql`${claims.status} NOT IN ('closed', 'resolved', 'rejected')`,
            sql`${claims.updatedAt} < NOW() - INTERVAL '5 days'`,
          ),
        ),
      db
        .select({ count: count() })
        .from(claimUpdates)
        .where(
          and(
            sql`(${claimUpdates.message} ILIKE '%error%' OR ${claimUpdates.message} ILIKE '%failed%')`,
            gte(claimUpdates.createdAt, oneDayAgo),
          ),
        ),
      getAllQueueStats(),
    ])

    const queueDepth = queueStats.reduce((sum, q) => sum + (q.active ?? 0) + (q.reserved ?? 0) + (q.scheduled ?? 0), 0)

    return NextResponse.json({
      scope: 'platform',
      workflow_transition_rate: transitions[0]?.count ?? 0,
      sla_violations: slaViolations[0]?.count ?? 0,
      failure_like_updates: failureLike[0]?.count ?? 0,
      queue_depth: queueDepth,
      // Request and error rates come from the observability system; this route does not measure them.
      request_count: null,
      error_rate: null,
      window: '24h',
      generated_at: now.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 })
  }
}
