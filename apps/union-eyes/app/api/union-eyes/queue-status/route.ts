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
    // Accept either Clerk JWT (browser) or service key (control-plane s2s)
    const svcKey = process.env.AI_SERVICE_KEY
    const isServiceRequest = !!svcKey && req.headers.get('x-service-key') === svcKey
    if (!isServiceRequest) {
      await requireApiAuth()
    }
    const stats = await getAllQueueStats().catch(() => [])

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

    // Fetch failed jobs from default queue
    const failed = await getFailedJobs('celery', 20).catch(() => [])

    return NextResponse.json({
      service: 'union-eyes',
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
      { error: 'Queue status unavailable', detail: String(err) },
      { status: 503 },
    )
  }
}
