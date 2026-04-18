import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { claimPendingJobs, completeJob, failOrRetryJob, type QueueJob } from '@/lib/queue-jobs'
import { requireWorkerAuth } from '@/lib/internal-worker-auth'
import { logger } from '@/lib/logger'

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

export async function POST(request: Request) {
  const unauthorized = requireWorkerAuth(request)
  if (unauthorized) return unauthorized

  const jobs = await claimPendingJobs('payments', 'mpesa.reconcile.retry', 25)
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
}
