import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { withSpan } from '@nzila/os-core/telemetry'

import { claimPendingJobs, completeJob, failOrRetryJob, type QueueJob } from '@/lib/queue-jobs'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { requireWorkerAuth } from '@/lib/internal-worker-auth'
import { logger } from '@/lib/logger'

const WorkerRetrySchema = z.object({
  batchSize: z.number().int().min(1).max(100).optional(),
})

async function parseBody(request: NextRequest): Promise<z.infer<typeof WorkerRetrySchema>> {
  try {
    const body = await request.json()
    return WorkerRetrySchema.parse(body ?? {})
  } catch {
    return WorkerRetrySchema.parse({})
  }
}

async function processMpesaRetry(job: QueueJob): Promise<void> {
  const payload = (job.payload ?? {}) as {
    paymentIntentId?: string
    transactionId?: string
    thirdPartyConversationId?: string
    responseCode?: string
  }

  if (!payload.paymentIntentId) {
    throw new Error('Missing paymentIntentId in retry payload')
  }

  // Retry strategy: keep intent in processing while provider callback is retryable.
  await platformDb.execute(sql`
    UPDATE zonga_payment_intents
    SET
      status = CASE
        WHEN status = 'captured' THEN status
        ELSE 'processing'
      END,
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
        mpesaRetry: {
          attemptedAt: new Date().toISOString(),
          responseCode: payload.responseCode ?? null,
          transactionId: payload.transactionId ?? null,
          thirdPartyConversationId: payload.thirdPartyConversationId ?? null,
        },
      })}::jsonb,
      updated_at = NOW()
    WHERE id = ${payload.paymentIntentId}
  `)
}

export async function POST(request: NextRequest) {
  return withRequestContext(request, () =>
    withSpan('zonga.worker.mpesa-retries.post', { 'http.method': 'POST' }, async () => {
      const authResult = await authenticateUser()
      if (!authResult.ok) {
        const unauthorized = requireWorkerAuth(request)
        if (unauthorized) return unauthorized
      }

      const payload = await parseBody(request)
      const jobs = await claimPendingJobs('payments', 'mpesa.reconcile.retry', payload.batchSize ?? 25)
      let processed = 0
      let failed = 0

      for (const job of jobs) {
        try {
          await processMpesaRetry(job)
          await completeJob(job.id)
          processed += 1
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          failed += 1
          await failOrRetryJob(job, message, 120)
          logger.error('M-Pesa retry job failed', { jobId: job.id, error: message })
        }
      }

      return NextResponse.json({ ok: true, processed, failed })
    }),
  )
}
