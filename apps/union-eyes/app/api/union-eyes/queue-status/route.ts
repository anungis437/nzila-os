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
import { timingSafeEqual } from 'node:crypto'

// A shared secret is compared in constant time, so response timing does not reveal how much of a guess was right.
function sameSecret(presented: string | null, expected: string): boolean {
  if (!presented) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Queue counts and failed task names are platform-wide operational data, not an organization's: the control plane (service key)
    // or a platform administrator may read them, and a signed-in member may not.
    // A key dedicated to this route; the shared AI service key is accepted only outside production, so a leak of the AI key does not open platform queue data.
    const svcKey = process.env.QUEUE_STATUS_SERVICE_KEY || (process.env.NODE_ENV === 'production' ? undefined : process.env.AI_SERVICE_KEY)
    const isServiceRequest = !!svcKey && sameSecret(req.headers.get('x-service-key'), svcKey)
    if (!isServiceRequest) {
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

