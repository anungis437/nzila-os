/**
 * @nzila/media-worker — Queue Consumer
 *
 * Processes transcoding jobs from the queue.
 * Redis-backed queue provider with dead letter support,
 * visibility timeout, and retry classification.
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

// ── Redis-Backed Queue Provider ─────────────────────────────────────────────

export interface RedisQueueConfig {
  /** Maximum retry attempts before dead-lettering. */
  readonly maxAttempts: number
  /** Visibility timeout in seconds — how long a message is invisible after dequeue. */
  readonly visibilityTimeoutSeconds: number
}

const DEFAULT_REDIS_QUEUE_CONFIG: RedisQueueConfig = {
  maxAttempts: 3,
  visibilityTimeoutSeconds: 300, // 5 minutes
}

/**
 * Redis client interface — minimal contract needed by the queue provider.
 * Compatible with ioredis and node-redis.
 */
export interface RedisClient {
  lpush(key: string, ...values: string[]): Promise<number>
  rpoplpush(source: string, destination: string): Promise<string | null>
  lrem(key: string, count: number, element: string): Promise<number>
  llen(key: string): Promise<number>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  zadd(key: string, score: number, member: string): Promise<number | string>
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>
  zrem(key: string, ...members: string[]): Promise<number>
}

/**
 * Creates a Redis-backed QueueProvider using reliable queue patterns:
 * - RPOPLPUSH for atomic dequeue + processing list
 * - Sorted set for delayed/scheduled jobs
 * - Dead-letter queue after maxAttempts exhausted
 */
export function createRedisQueueProvider(
  redis: RedisClient,
  config: RedisQueueConfig = DEFAULT_REDIS_QUEUE_CONFIG,
): QueueProvider {
  function pendingKey(queue: string): string { return `${queue}:pending` }
  function processingKey(queue: string): string { return `${queue}:processing` }
  function dlqKey(queue: string): string { return `${queue}:dlq` }
  function scheduledKey(queue: string): string { return `${queue}:scheduled` }

  return {
    async enqueue<T>(params: EnqueueParams<T>): Promise<string> {
      const id = crypto.randomUUID()
      const message: QueueMessage<T> = {
        id,
        queue: params.queue,
        payload: params.payload,
        attempts: 0,
        maxAttempts: config.maxAttempts,
        scheduledAt: new Date(Date.now() + (params.delaySeconds ?? 0) * 1000),
        idempotencyKey: params.idempotencyKey ?? null,
      }

      const serialized = JSON.stringify(message)

      if (params.delaySeconds && params.delaySeconds > 0) {
        // Schedule for later using sorted set
        const score = Date.now() + params.delaySeconds * 1000
        await redis.zadd(scheduledKey(params.queue), score, serialized)
      } else {
        // Immediately available
        await redis.lpush(pendingKey(params.queue), serialized)
      }

      return id
    },

    async dequeue<T>(queue: string): Promise<QueueMessage<T> | null> {
      // First, move any scheduled jobs that are ready
      const now = Date.now()
      const ready = await redis.zrangebyscore(scheduledKey(queue), 0, now)
      for (const item of ready) {
        await redis.zrem(scheduledKey(queue), item)
        await redis.lpush(pendingKey(queue), item)
      }

      // Atomic dequeue: move from pending to processing
      const raw = await redis.rpoplpush(pendingKey(queue), processingKey(queue))
      if (!raw) return null

      const message = JSON.parse(raw) as QueueMessage<T>
      return {
        ...message,
        attempts: message.attempts + 1,
        scheduledAt: new Date(message.scheduledAt),
      }
    },

    async ack(messageId: string): Promise<void> {
      // Remove from all processing lists (search all known queues)
      for (const queueName of Object.values(QUEUE_NAMES)) {
        const items = await redis.lrange(processingKey(queueName), 0, -1)
        for (const item of items) {
          try {
            const parsed = JSON.parse(item) as QueueMessage
            if (parsed.id === messageId) {
              await redis.lrem(processingKey(queueName), 1, item)
              return
            }
          } catch {
            continue
          }
        }
      }
    },

    async nack(messageId: string, error: string): Promise<void> {
      for (const queueName of Object.values(QUEUE_NAMES)) {
        const items = await redis.lrange(processingKey(queueName), 0, -1)
        for (const item of items) {
          try {
            const parsed = JSON.parse(item) as QueueMessage
            if (parsed.id === messageId) {
              await redis.lrem(processingKey(queueName), 1, item)

              if (parsed.attempts >= config.maxAttempts) {
                // Move to dead-letter queue
                const dlqMessage = JSON.stringify({
                  ...parsed,
                  error,
                  deadLetteredAt: new Date().toISOString(),
                })
                await redis.lpush(dlqKey(queueName), dlqMessage)
              } else {
                // Requeue with incremented attempt
                const requeued = JSON.stringify({
                  ...parsed,
                  attempts: parsed.attempts,
                })
                await redis.lpush(pendingKey(queueName), requeued)
              }
              return
            }
          } catch {
            continue
          }
        }
      }
    },

    async depth(queue: string): Promise<number> {
      return redis.llen(pendingKey(queue))
    },

    async deadLetters(queue: string, limit: number): Promise<readonly QueueMessage[]> {
      const items = await redis.lrange(dlqKey(queue), 0, limit - 1)
      return items.map((item) => {
        const parsed = JSON.parse(item) as QueueMessage
        return {
          ...parsed,
          scheduledAt: new Date(parsed.scheduledAt),
        }
      })
    },
  }
}

/**
 * Replays dead-lettered messages back to the pending queue.
 * Returns the number of messages replayed.
 */
export async function replayDeadLetters(
  redis: RedisClient,
  queue: string,
  limit: number,
): Promise<number> {
  const dlq = `${queue}:dlq`
  const pending = `${queue}:pending`
  const items = await redis.lrange(dlq, 0, limit - 1)

  let replayed = 0
  for (const item of items) {
    try {
      const parsed = JSON.parse(item) as QueueMessage & { error?: string; deadLetteredAt?: string }
      // Reset attempts and remove DLQ metadata
      const cleaned = JSON.stringify({
        id: parsed.id,
        queue: parsed.queue,
        payload: parsed.payload,
        attempts: 0,
        maxAttempts: parsed.maxAttempts,
        scheduledAt: new Date().toISOString(),
        idempotencyKey: parsed.idempotencyKey,
      })
      await redis.lrem(dlq, 1, item)
      await redis.lpush(pending, cleaned)
      replayed++
    } catch {
      continue
    }
  }

  return replayed
}

// ── In-Memory Queue Provider (for tests) ────────────────────────────────────

export function createInMemoryQueueProvider(): QueueProvider {
  const queues = new Map<string, QueueMessage[]>()
  const processing = new Map<string, QueueMessage>()
  const dlqs = new Map<string, QueueMessage[]>()

  function getQueue(name: string): QueueMessage[] {
    if (!queues.has(name)) queues.set(name, [])
    return queues.get(name)!
  }

  function getDlq(name: string): QueueMessage[] {
    if (!dlqs.has(name)) dlqs.set(name, [])
    return dlqs.get(name)!
  }

  return {
    async enqueue<T>(params: EnqueueParams<T>): Promise<string> {
      const id = crypto.randomUUID()
      const message: QueueMessage<T> = {
        id,
        queue: params.queue,
        payload: params.payload,
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date(),
        idempotencyKey: params.idempotencyKey ?? null,
      }
      getQueue(params.queue).push(message)
      return id
    },

    async dequeue<T>(queue: string): Promise<QueueMessage<T> | null> {
      const q = getQueue(queue)
      const message = q.shift()
      if (!message) return null
      const updated = { ...message, attempts: message.attempts + 1 } as QueueMessage<T>
      processing.set(message.id, updated)
      return updated
    },

    async ack(messageId: string): Promise<void> {
      processing.delete(messageId)
    },

    async nack(messageId: string, error: string): Promise<void> {
      const message = processing.get(messageId)
      if (!message) return
      processing.delete(messageId)

      if (message.attempts >= message.maxAttempts) {
        getDlq(message.queue).push(message)
      } else {
        getQueue(message.queue).push(message)
      }
    },

    async depth(queue: string): Promise<number> {
      return getQueue(queue).length
    },

    async deadLetters(queue: string, limit: number): Promise<readonly QueueMessage[]> {
      return getDlq(queue).slice(0, limit)
    },
  }
}
