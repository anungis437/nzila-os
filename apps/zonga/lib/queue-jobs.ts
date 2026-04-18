import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'

export type QueueJob = {
  id: string
  org_id: string
  queue: string
  job_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter'
  retry_count: number
  max_retries: number
  idempotency_key: string | null
}

export async function enqueueJob(input: {
  orgId: string
  queue: string
  jobType: string
  payload: Record<string, unknown>
  idempotencyKey?: string
  maxRetries?: number
  priority?: number
  scheduledAt?: string | null
}): Promise<string> {
  if (input.idempotencyKey) {
    const existing = await platformDb.execute(sql`
      SELECT id
      FROM zonga_queue_jobs
      WHERE queue = ${input.queue}
        AND job_type = ${input.jobType}
        AND idempotency_key = ${input.idempotencyKey}
        AND status IN ('pending', 'processing', 'completed')
      ORDER BY created_at DESC
      LIMIT 1
    `) as unknown as Array<{ id: string }>

    if (existing[0]?.id) return existing[0].id
  }

  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_queue_jobs (
      org_id, queue, job_type, payload, status,
      priority, retry_count, max_retries, idempotency_key, scheduled_at
    ) VALUES (
      ${input.orgId}, ${input.queue}, ${input.jobType},
      ${JSON.stringify(input.payload)}::jsonb,
      'pending',
      ${input.priority ?? 0},
      0,
      ${input.maxRetries ?? 3},
      ${input.idempotencyKey ?? null},
      ${input.scheduledAt ?? null}::timestamptz
    )
    RETURNING id
  `) as unknown as Array<{ id: string }>

  return rows[0]!.id
}

export async function claimPendingJobs(queue: string, jobType: string, limit = 25): Promise<QueueJob[]> {
  const rows = await platformDb.execute(sql`
    WITH candidates AS (
      SELECT id
      FROM zonga_queue_jobs
      WHERE queue = ${queue}
        AND job_type = ${jobType}
        AND status = 'pending'
        AND (scheduled_at IS NULL OR scheduled_at <= NOW())
      ORDER BY priority DESC, created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE zonga_queue_jobs j
    SET status = 'processing', started_at = NOW()
    FROM candidates
    WHERE j.id = candidates.id
    RETURNING j.id, j.org_id, j.queue, j.job_type, j.payload, j.status,
              j.retry_count, j.max_retries, j.idempotency_key
  `) as unknown as QueueJob[]

  return rows
}

export async function completeJob(jobId: string): Promise<void> {
  await platformDb.execute(sql`
    UPDATE zonga_queue_jobs
    SET status = 'completed', completed_at = NOW(), last_error = NULL
    WHERE id = ${jobId}
  `)
}

export async function failOrRetryJob(job: QueueJob, errorMessage: string, retryDelaySec = 60): Promise<void> {
  const nextRetryCount = Number(job.retry_count ?? 0) + 1
  const maxRetries = Number(job.max_retries ?? 3)

  if (nextRetryCount > maxRetries) {
    await platformDb.execute(sql`
      UPDATE zonga_queue_jobs
      SET status = 'dead_letter', retry_count = ${nextRetryCount},
          last_error = ${errorMessage}, completed_at = NOW()
      WHERE id = ${job.id}
    `)
    return
  }

  await platformDb.execute(sql`
    UPDATE zonga_queue_jobs
    SET status = 'pending',
        retry_count = ${nextRetryCount},
        last_error = ${errorMessage},
        scheduled_at = NOW() + (${retryDelaySec} * INTERVAL '1 second')
    WHERE id = ${job.id}
  `)
}
