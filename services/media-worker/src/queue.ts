/**
 * @nzila/media-worker — Queue Consumer
 *
 * Processes transcoding jobs from the queue.
 * Retry-safe, idempotent, and observable.
 *
 * @module @nzila/media-worker/queue
 */

// ── Queue Interface ─────────────────────────────────────────────────────────

export interface QueueMessage<T = unknown> {
  readonly id: string
  readonly queue: string
  readonly payload: T
  readonly attempts: number
  readonly maxAttempts: number
  readonly scheduledAt: Date
  readonly idempotencyKey: string | null
}

export interface QueueProvider {
  /** Enqueue a job. Returns the job ID. */
  enqueue<T>(params: EnqueueParams<T>): Promise<string>

  /** Dequeue the next available job. Returns null if empty. */
  dequeue<T>(queue: string): Promise<QueueMessage<T> | null>

  /** Acknowledge successful processing. */
  ack(messageId: string): Promise<void>

  /** Negative acknowledge — requeue or move to dead letter. */
  nack(messageId: string, error: string): Promise<void>

  /** Get queue depth. */
  depth(queue: string): Promise<number>

  /** List dead-letter messages. */
  deadLetters(queue: string, limit: number): Promise<readonly QueueMessage[]>
}

export interface EnqueueParams<T> {
  readonly queue: string
  readonly payload: T
  readonly idempotencyKey?: string
  readonly delaySeconds?: number
  readonly priority?: number
}

// ── Queue Names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  TRANSCODE: 'zonga:transcode',
  PAYMENT_PROCESS: 'zonga:payment:process',
  PAYMENT_CONFIRM: 'zonga:payment:confirm',
  PAYOUT_EXECUTE: 'zonga:payout:execute',
  NOTIFICATION_SEND: 'zonga:notification:send',
  RECOMMENDATION_UPDATE: 'zonga:recommendation:update',
  ANALYTICS_INGEST: 'zonga:analytics:ingest',
  SOCIAL_FEED_UPDATE: 'zonga:social:feed:update',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

// ── Job Payloads ────────────────────────────────────────────────────────────

export interface TranscodeJobPayload {
  readonly type: 'transcode'
  readonly assetId: string
  readonly orgId: string
  readonly sourceKey: string
  readonly targetQualities: readonly string[]
  readonly generateHls: boolean
  readonly normalize: boolean
  readonly correlationId: string
}

export interface PaymentProcessPayload {
  readonly type: 'payment_process'
  readonly intentId: string
  readonly orgId: string
  readonly provider: string
  readonly idempotencyKey: string
  readonly correlationId: string
}

export interface PaymentConfirmPayload {
  readonly type: 'payment_confirm'
  readonly intentId: string
  readonly orgId: string
  readonly provider: string
  readonly providerTransactionId: string
  readonly correlationId: string
}

export interface PayoutExecutePayload {
  readonly type: 'payout_execute'
  readonly payoutId: string
  readonly orgId: string
  readonly creatorId: string
  readonly amount: number
  readonly currency: string
  readonly rail: string
  readonly correlationId: string
}

export interface NotificationPayload {
  readonly type: 'notification'
  readonly orgId: string
  readonly userId: string
  readonly notificationType: string
  readonly title: string
  readonly body: string
  readonly link?: string
  readonly correlationId: string
}

export interface RecommendationUpdatePayload {
  readonly type: 'recommendation_update'
  readonly orgId: string
  readonly userId: string
  readonly surface: string
  readonly triggerEvent: string
  readonly correlationId: string
}

export interface AnalyticsIngestPayload {
  readonly type: 'analytics_ingest'
  readonly orgId: string
  readonly eventType: string
  readonly entityId: string
  readonly metadata: Record<string, unknown>
  readonly correlationId: string
}

// ── Queue Worker ────────────────────────────────────────────────────────────

export interface QueueWorkerConfig {
  readonly queue: string
  readonly concurrency: number
  readonly pollIntervalMs: number
  readonly shutdownTimeoutMs: number
}

export type JobHandler<T> = (message: QueueMessage<T>) => Promise<void>

/**
 * Creates a generic queue worker that polls, processes, and acks/nacks jobs.
 * Supports graceful shutdown.
 */
export function createQueueWorker<T>(
  queueProvider: QueueProvider,
  config: QueueWorkerConfig,
  handler: JobHandler<T>,
  logger: WorkerLogger,
): QueueWorker {
  let running = false
  let activeJobs = 0

  async function poll(): Promise<void> {
    while (running) {
      if (activeJobs >= config.concurrency) {
        await sleep(100)
        continue
      }

      const message = await queueProvider.dequeue<T>(config.queue)
      if (!message) {
        await sleep(config.pollIntervalMs)
        continue
      }

      activeJobs++
      processMessage(message).finally(() => { activeJobs-- })
    }
  }

  async function processMessage(message: QueueMessage<T>): Promise<void> {
    const startTime = Date.now()
    logger.info(`Processing job ${message.id} on queue ${config.queue}`, {
      jobId: message.id,
      queue: config.queue,
      attempt: message.attempts,
    })

    try {
      await handler(message)
      await queueProvider.ack(message.id)
      logger.info(`Job ${message.id} completed`, {
        jobId: message.id,
        durationMs: Date.now() - startTime,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      logger.error(`Job ${message.id} failed: ${errorMessage}`, {
        jobId: message.id,
        attempt: message.attempts,
        error: errorMessage,
      })
      await queueProvider.nack(message.id, errorMessage)
    }
  }

  return {
    start() {
      running = true
      logger.info(`Worker started for queue ${config.queue}`, { concurrency: config.concurrency })
      poll()
    },

    async stop(): Promise<void> {
      running = false
      logger.info(`Worker stopping for queue ${config.queue}`)
      const deadline = Date.now() + config.shutdownTimeoutMs
      while (activeJobs > 0 && Date.now() < deadline) {
        await sleep(100)
      }
      if (activeJobs > 0) {
        logger.warn(`Worker shutdown with ${activeJobs} active jobs`)
      }
    },

    isRunning: () => running,
    activeJobCount: () => activeJobs,
  }
}

export interface QueueWorker {
  start(): void
  stop(): Promise<void>
  isRunning(): boolean
  activeJobCount(): number
}

export interface WorkerLogger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
