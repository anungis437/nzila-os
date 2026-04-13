import { describe, it, expect } from 'vitest'
import {
  QUEUE_NAMES,
  createQueueWorker,
  createInMemoryQueueProvider,
  createRedisQueueProvider,
  replayDeadLetters,
  type QueueMessage,
  type RedisClient,
} from './queue'

class FakeRedis implements RedisClient {
  private lists = new Map<string, string[]>()
  private sorted = new Map<string, Array<{ score: number; member: string }>>()

  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.lists.get(key) ?? []
    for (const value of values) {
      list.unshift(value)
    }
    this.lists.set(key, list)
    return list.length
  }

  async rpoplpush(source: string, destination: string): Promise<string | null> {
    const src = this.lists.get(source) ?? []
    if (src.length === 0) return null
    const value = src.pop()!
    this.lists.set(source, src)

    const dest = this.lists.get(destination) ?? []
    dest.unshift(value)
    this.lists.set(destination, dest)
    return value
  }

  async lrem(key: string, count: number, element: string): Promise<number> {
    const list = this.lists.get(key) ?? []
    if (count === 0) return 0

    let removed = 0
    const next: string[] = []
    for (const item of list) {
      if (item === element && removed < Math.abs(count)) {
        removed++
        continue
      }
      next.push(item)
    }
    this.lists.set(key, next)
    return removed
  }

  async llen(key: string): Promise<number> {
    return (this.lists.get(key) ?? []).length
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? []
    const end = stop === -1 ? list.length : stop + 1
    return list.slice(start, end)
  }

  async zadd(key: string, score: number, member: string): Promise<number | string> {
    const list = this.sorted.get(key) ?? []
    list.push({ score, member })
    this.sorted.set(key, list)
    return 1
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const low = typeof min === 'string' ? Number(min) : min
    const high = typeof max === 'string' ? Number(max) : max
    const list = this.sorted.get(key) ?? []
    return list
      .filter((item) => item.score >= low && item.score <= high)
      .map((item) => item.member)
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const list = this.sorted.get(key) ?? []
    const before = list.length
    const memberSet = new Set(members)
    const next = list.filter((item) => !memberSet.has(item.member))
    this.sorted.set(key, next)
    return before - next.length
  }
}

describe('QUEUE_NAMES', () => {
  it('contains all expected queues', () => {
    expect(QUEUE_NAMES.TRANSCODE).toBe('zonga:transcode')
    expect(QUEUE_NAMES.PAYMENT_PROCESS).toBe('zonga:payment:process')
    expect(QUEUE_NAMES.NOTIFICATION_SEND).toBe('zonga:notification:send')
    expect(QUEUE_NAMES.ANALYTICS_INGEST).toBe('zonga:analytics:ingest')
  })
})

describe('InMemoryQueueProvider', () => {
  it('enqueue and dequeue round-trips', async () => {
    const provider = createInMemoryQueueProvider()
    const id = await provider.enqueue({
      queue: 'test-queue',
      payload: { type: 'test', value: 42 },
    })

    expect(id).toBeTruthy()

    const message = await provider.dequeue<{ type: string; value: number }>('test-queue')
    expect(message).not.toBeNull()
    expect(message!.payload.type).toBe('test')
    expect(message!.payload.value).toBe(42)
    expect(message!.attempts).toBe(1)
  })

  it('dequeue returns null on empty queue', async () => {
    const provider = createInMemoryQueueProvider()
    const message = await provider.dequeue('empty')
    expect(message).toBeNull()
  })

  it('ack removes from processing', async () => {
    const provider = createInMemoryQueueProvider()
    await provider.enqueue({ queue: 'q', payload: 'data' })
    const msg = await provider.dequeue('q')
    await provider.ack(msg!.id)
    // Should not be in depth
    expect(await provider.depth('q')).toBe(0)
  })

  it('nack requeues when under max attempts', async () => {
    const provider = createInMemoryQueueProvider()
    await provider.enqueue({ queue: 'q', payload: 'data' })
    const msg = await provider.dequeue('q')
    await provider.nack(msg!.id, 'transient error')

    // Should be requeued
    expect(await provider.depth('q')).toBe(1)
  })

  it('nack moves to DLQ when max attempts exhausted', async () => {
    const provider = createInMemoryQueueProvider()
    await provider.enqueue({ queue: 'q', payload: 'data' })

    // Exhaust attempts (maxAttempts = 3, each dequeue increments)
    let msg = await provider.dequeue('q')
    await provider.nack(msg!.id, 'err')

    msg = await provider.dequeue('q')
    await provider.nack(msg!.id, 'err')

    msg = await provider.dequeue('q')
    await provider.nack(msg!.id, 'err')

    // DLQ should have 1 message
    const dlq = await provider.deadLetters('q', 10)
    expect(dlq.length).toBe(1)
    expect(await provider.depth('q')).toBe(0)
  })

  it('depth reports correct count', async () => {
    const provider = createInMemoryQueueProvider()
    expect(await provider.depth('q')).toBe(0)
    await provider.enqueue({ queue: 'q', payload: 'a' })
    await provider.enqueue({ queue: 'q', payload: 'b' })
    expect(await provider.depth('q')).toBe(2)
  })

  it('deadLetters returns empty for fresh queue', async () => {
    const provider = createInMemoryQueueProvider()
    const dlq = await provider.deadLetters('q', 10)
    expect(dlq).toHaveLength(0)
  })
})

describe('createQueueWorker', () => {
  it('processes a job and acks', async () => {
    const provider = createInMemoryQueueProvider()
    const processed: string[] = []

    const noop = { info() {}, warn() {}, error() {} }
    const worker = createQueueWorker(
      provider,
      { queue: 'test', concurrency: 1, pollIntervalMs: 50, shutdownTimeoutMs: 1000 },
      async (msg: QueueMessage<string>) => { processed.push(msg.payload) },
      noop,
    )

    await provider.enqueue({ queue: 'test', payload: 'job-1' })
    worker.start()
    expect(worker.isRunning()).toBe(true)

    // Wait for processing
    await new Promise((r) => setTimeout(r, 200))
    await worker.stop()

    expect(processed).toContain('job-1')
    expect(worker.isRunning()).toBe(false)
  })

  it('nacks and logs error when handler fails', async () => {
    const provider = createInMemoryQueueProvider()
    const logger = { info() {}, warn() {}, error() {} }

    await provider.enqueue({ queue: 'test', payload: 'job-1' })

    const worker = createQueueWorker(
      provider,
      { queue: 'test', concurrency: 1, pollIntervalMs: 50, shutdownTimeoutMs: 1000 },
      async () => {
        throw new Error('boom')
      },
      logger,
    )

    worker.start()
    await new Promise((r) => setTimeout(r, 200))
    await worker.stop()

    expect(await provider.depth('test')).toBe(1)
  })

  it('warns when stopping with active jobs past shutdown timeout', async () => {
    const provider = createInMemoryQueueProvider()
    const logger = { info() {}, warnCalled: false, warn() { this.warnCalled = true }, error() {} }

    await provider.enqueue({ queue: 'test', payload: 'job-1' })

    const worker = createQueueWorker(
      provider,
      { queue: 'test', concurrency: 1, pollIntervalMs: 5, shutdownTimeoutMs: 1 },
      async () => new Promise<void>(() => {}),
      logger,
    )

    worker.start()
    await new Promise((r) => setTimeout(r, 30))
    await worker.stop()

    expect(logger.warnCalled).toBe(true)
  })
})

describe('RedisQueueProvider and replayDeadLetters', () => {
  it('handles delayed enqueue, dequeue, ack and dead-letter flow', async () => {
    const redis = new FakeRedis()
    const queue = createRedisQueueProvider(redis, { maxAttempts: 2, visibilityTimeoutSeconds: 30 })

    const immediateId = await queue.enqueue({
      queue: QUEUE_NAMES.TRANSCODE,
      payload: { type: 'transcode', value: 1 },
    })

    await queue.enqueue({
      queue: QUEUE_NAMES.TRANSCODE,
      payload: { type: 'transcode', value: 2 },
      delaySeconds: 10,
      idempotencyKey: 'idem-1',
    })

    const msg1 = await queue.dequeue<{ type: string; value: number }>(QUEUE_NAMES.TRANSCODE)
    expect(msg1?.id).toBe(immediateId)
    await queue.ack(msg1!.id)

    const msg2 = await queue.dequeue<{ type: string; value: number }>(QUEUE_NAMES.TRANSCODE)
    expect(msg2).toBeNull()

    const deadLetterCandidate = {
      id: 'dlq-1',
      queue: QUEUE_NAMES.TRANSCODE,
      payload: { type: 'transcode', value: 3 },
      attempts: 2,
      maxAttempts: 2,
      scheduledAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      idempotencyKey: null,
    }
    await redis.lpush(`${QUEUE_NAMES.TRANSCODE}:processing`, JSON.stringify(deadLetterCandidate))
    await queue.nack(deadLetterCandidate.id, 'fatal')

    const dlqItems = await queue.deadLetters(QUEUE_NAMES.TRANSCODE, 10)
    expect(dlqItems).toHaveLength(1)
  })

  it('replayDeadLetters requeues valid items and skips invalid JSON', async () => {
    const redis = new FakeRedis()
    const queueName = QUEUE_NAMES.NOTIFICATION_SEND

    await redis.lpush(
      `${queueName}:dlq`,
      JSON.stringify({
        id: 'job-1',
        queue: queueName,
        payload: { hello: 'world' },
        attempts: 3,
        maxAttempts: 3,
        scheduledAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        idempotencyKey: null,
      }),
    )
    await redis.lpush(`${queueName}:dlq`, 'not-json')

    const replayed = await replayDeadLetters(redis, queueName, 10)

    expect(replayed).toBe(1)
    expect(await redis.llen(`${queueName}:pending`)).toBe(1)
    expect(await redis.llen(`${queueName}:dlq`)).toBe(1)
  })
})
