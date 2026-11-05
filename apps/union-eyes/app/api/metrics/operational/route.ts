/**
 * GET /api/metrics/operational
 *
 * Platform-wide operational counters for observability dashboards. The caller is the platform operator: a caller presenting the
 * service key (compared in constant time) or a platform administrator. An ordinary signed-in user of any organization is refused.
 *
 * Only infrastructure state is read here: the job queue's depth. Issue #1116: a platform title confers no tenant content, and an
 * aggregate computed over every organization's claims or claim-update text is tenant content. So workflow transitions, claims past
 * their SLA and failure-like updates are not computed from the tenants' tables; they are returned as null ("not measured here"),
 * like the request and error rates that come from the observability system, rather than as proxies. A failed read is an error, not
 * zero.
 */
import { NextResponse } from 'next/server'
import { getAllQueueStats } from '@/lib/job-queue'
import { requireApiAuth, isPlatformAdminUser } from '@/lib/api-auth-guard'
import { constantTimeEquals } from '@/lib/security/constant-time'
import { logger } from '@/lib/logger'

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

  try {
    const queueStats = await getAllQueueStats()
    const queueDepth = queueStats.reduce((sum, q) => sum + (q.active ?? 0) + (q.reserved ?? 0) + (q.scheduled ?? 0), 0)

    return NextResponse.json({
      scope: 'platform',
      // Aggregates over the tenants' claims are tenant content (#1116): the platform operator does not read them.
      workflow_transition_rate: null,
      sla_violations: null,
      failure_like_updates: null,
      queue_depth: queueDepth,
      // Request and error rates come from the observability system; this route does not measure them.
      request_count: null,
      error_rate: null,
      window: '24h',
      generated_at: now.toISOString(),
    })
  } catch (error) {
    logger.error('operational_metrics_failed', { error })
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 })
  }
}
