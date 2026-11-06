/**
 * GET /api/union-eyes/queue-status
 *
 * Control-plane–facing endpoint that exposes queue health:
 * - pending jobs (active + reserved + scheduled per queue)
 * - failed jobs (per queue, capped at 20 most recent)
 * - retry count
 */
import { NextResponse } from 'next/server'
import { getAllQueueStats, getFailedJobs } from '@/lib/job-queue'
import { requireApiAuth, requireSystemAdmin } from '@/lib/api-auth-guard'
import { logger } from '@/lib/logger'
import { constantTimeEquals } from '@/lib/security/constant-time'

export const dynamic = 'force-dynamic'

/**
 * The machine path authenticates with QUEUE_STATUS_SERVICE_KEY alone: a key dedicated to this route, at least 32 characters, and distinct
 * from AI_SERVICE_KEY and UE_METRICS_SERVICE_KEY, so a leak of either of those does not open queue data (issue #1118). There is no fallback
 * to the shared AI key in any environment. Absence, underlength or re-use is a configuration error the operator sees in the log; the caller
 * sees 401 either way, so the answer does not tell it whether the key is configured.
 */
function authenticateQueueService(presented: string): 'allowed' | 'unconfigured' | 'denied' {
  const expected = process.env.QUEUE_STATUS_SERVICE_KEY
  if (!expected || expected.length < 32 ||
      expected === process.env.AI_SERVICE_KEY ||
      expected === process.env.UE_METRICS_SERVICE_KEY) {
    return 'unconfigured'
  }
  return constantTimeEquals(presented, expected) ? 'allowed' : 'denied'
}

export async function GET(req: Request) {
  try {
    // Queue counts and failed task identifiers/names are platform infrastructure data, not an organization's: no claim, member, case or
    // other tenant content is read or returned. The monitoring caller (service key) or a platform administrator may read them; a signed-in
    // member may not. A request that presents a service key is judged on that key only and never falls through to the session path.
    const presentedKey = req.headers.get('x-service-key')
    if (presentedKey !== null) {
      const access = authenticateQueueService(presentedKey)
      if (access === 'unconfigured') logger.error('queue_status_service_key_unconfigured', { route: '/api/union-eyes/queue-status' })
      if (access !== 'allowed') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
      }
    } else {
      try {
        await requireApiAuth()
      } catch {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      try {
        await requireSystemAdmin()
      } catch {
        return NextResponse.json({ error: 'Platform administrator authority required' }, { status: 403 })
      }
    }

    const djangoUrl = process.env.DJANGO_API_URL || process.env.NEXT_PUBLIC_DJANGO_API_URL
    if (!djangoUrl) {
      return NextResponse.json({
        service: 'union-eyes',
        availability: 'not_configured',
        queue: null,
        timestamp: new Date().toISOString(),
      })
    }

    const [stats, failed] = await Promise.all([
      getAllQueueStats(),
      getFailedJobs('celery', 20),
    ])

    // Aggregate totals
    let pending = 0
    let active = 0
    const queueDetails: Record<string, { active: number; reserved: number; scheduled: number }> = {}

    for (const q of stats) {
      const queuePending = (q.reserved ?? 0) + (q.scheduled ?? 0)
      pending += queuePending
      active += q.active ?? 0
      queueDetails[q.name] = {
        active: q.active ?? 0,
        reserved: q.reserved ?? 0,
        scheduled: q.scheduled ?? 0,
      }
    }

    return NextResponse.json({
      service: 'union-eyes',
      availability: 'available',
      queue: {
        pending,
        active,
        failed: failed.length,
        retry_count: failed.filter((f) => f.status === 'RETRY').length,
        queues: queueDetails,
        recent_failures: failed.map((f) => ({
          task_id: f.task_id,
          task_name: f.task_name,
          status: f.status,
          date_done: f.date_done,
        })),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    // The cause is logged, not returned: it can name hosts and credentials of the queue backend.
    logger.error('queue-status unavailable', { error: String(err) })
    return NextResponse.json(
      {
        service: 'union-eyes',
        availability: 'error',
        queue: null,
        error: 'Queue status unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

