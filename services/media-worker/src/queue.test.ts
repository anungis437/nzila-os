import { describe, it, expect } from 'vitest'
import {
  QUEUE_NAMES,
  createQueueWorker,
  createInMemoryQueueProvider,
  type QueueMessage,
} from './queue'

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
})
