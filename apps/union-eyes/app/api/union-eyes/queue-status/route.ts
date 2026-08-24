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
import { requireApiAuth } from '@/lib/api-auth-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Accept either platform JWT (browser) or service key (control-plane s2s)
    const svcKey = process.env.AI_SERVICE_KEY
    const isServiceRequest = !!svcKey && req.headers.get('x-service-key') === svcKey
    if (!isServiceRequest) {
      await requireApiAuth()
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
    return NextResponse.json(
      {
        service: 'union-eyes',
        availability: 'error',
        queue: null,
        error: 'Queue status unavailable',
        detail: String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

