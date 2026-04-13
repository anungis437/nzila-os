/**
 * Platform Event Bus — Unit Tests
 *
 * Tests the in-memory event bus implementation including:
 * - Subscribe/emit patterns
 * - Error isolation between handlers
 * - Wildcard subscriptions
 * - Once subscriptions
 * - emitAndWait semantics
 * - Factory function
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlatformEventBus, createPlatformEvent } from '../bus'
import type { PlatformEvent } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: crypto.randomUUID(),
    type: 'test.event',
    schemaVersion: '1.0',
    payload: { foo: 'bar' },
    metadata: {
      orgId: crypto.randomUUID(),
      actorId: 'user_test',
      correlationId: crypto.randomUUID(),
      causationId: null,
      source: 'test',
      traceId: null,
      spanId: null,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PlatformEventBus', () => {
  let bus: PlatformEventBus

  beforeEach(() => {
    bus = new PlatformEventBus()
  })

  it('delivers events to type-specific subscribers', async () => {
    const received: PlatformEvent[] = []
    bus.on('test.event', (e) => { received.push(e) })

    const event = makeEvent()
    bus.emit(event)

    // Allow microtask queue to flush
    await new Promise((r) => setTimeout(r, 10))

    expect(received).toHaveLength(1)
    expect(received[0].id).toBe(event.id)
  })

  it('does not deliver events to non-matching subscribers', async () => {
    const received: PlatformEvent[] = []
    bus.on('other.event', (e) => { received.push(e) })

    bus.emit(makeEvent({ type: 'test.event' }))

    await new Promise((r) => setTimeout(r, 10))

    expect(received).toHaveLength(0)
  })

  it('delivers events to wildcard subscribers', async () => {
    const received: PlatformEvent[] = []
    bus.onAny((e) => { received.push(e) })

    bus.emit(makeEvent({ type: 'one.event' }))
    bus.emit(makeEvent({ type: 'two.event' }))

    await new Promise((r) => setTimeout(r, 10))

    expect(received).toHaveLength(2)
  })

  it('isolates errors between handlers', async () => {
    const successHandler = vi.fn()
    const failHandler = vi.fn(() => { throw new Error('boom') })

    bus.on('test.event', failHandler)
    bus.on('test.event', successHandler)

    bus.emit(makeEvent())

    await new Promise((r) => setTimeout(r, 10))

    expect(failHandler).toHaveBeenCalledOnce()
    expect(successHandler).toHaveBeenCalledOnce()
  })

  it('isolates async errors between handlers in emit', async () => {
    const successHandler = vi.fn()
    const asyncFailHandler = vi.fn(async () => {
      throw new Error('async boom')
    })

    bus.on('test.event', asyncFailHandler)
    bus.on('test.event', successHandler)

    bus.emit(makeEvent())

    await new Promise((r) => setTimeout(r, 10))

    expect(asyncFailHandler).toHaveBeenCalledOnce()
    expect(successHandler).toHaveBeenCalledOnce()
  })

  it('supports unsubscribe', async () => {
    const received: PlatformEvent[] = []
    const unsub = bus.on('test.event', (e) => { received.push(e) })

    bus.emit(makeEvent())
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toHaveLength(1)

    unsub()

    bus.emit(makeEvent())
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toHaveLength(1)
  })

  it('supports once subscriptions', async () => {
    const received: PlatformEvent[] = []
    bus.once('test.event', (e) => { received.push(e) })

    bus.emit(makeEvent())
    bus.emit(makeEvent())

    await new Promise((r) => setTimeout(r, 10))

    expect(received).toHaveLength(1)
  })

  it('emitAndWait resolves all handlers', async () => {
    const handler1 = vi.fn(async () => { /* noop */ })
    const handler2 = vi.fn(async () => { /* noop */ })

    bus.on('test.event', handler1)
    bus.on('test.event', handler2)

    const results = await bus.emitAndWait(makeEvent())

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('emitAndWait captures rejections without throwing', async () => {
    bus.on('test.event', async () => { throw new Error('fail') })
    bus.on('test.event', async () => { /* success */ })

    const results = await bus.emitAndWait(makeEvent())

    expect(results).toHaveLength(2)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })

  it('emitAndWait includes wildcard handlers', async () => {
    const wildcard = vi.fn(async () => { /* noop */ })
    bus.onAny(wildcard)

    const results = await bus.emitAndWait(makeEvent())

    expect(results).toHaveLength(1)
    expect(results[0]?.status).toBe('fulfilled')
    expect(wildcard).toHaveBeenCalledOnce()
  })

  it('emit persists through store when configured', async () => {
    const persist = vi.fn(async () => {})
    bus = new PlatformEventBus({ store: { persist } })

    bus.emit(makeEvent())
    await new Promise((r) => setTimeout(r, 10))

    expect(persist).toHaveBeenCalledOnce()
  })

  it('emitAndWait awaits store persistence before handlers', async () => {
    const callOrder: string[] = []
    const persist = vi.fn(async () => {
      callOrder.push('persist')
    })

    bus = new PlatformEventBus({ store: { persist } })
    bus.on('test.event', async () => {
      callOrder.push('handler')
    })

    await bus.emitAndWait(makeEvent())
    expect(callOrder).toEqual(['persist', 'handler'])
  })

  it('isolates wildcard sync and async handler errors', async () => {
    const ok = vi.fn()
    bus.onAny(() => {
      throw new Error('wildcard sync fail')
    })
    bus.onAny(async () => {
      throw new Error('wildcard async fail')
    })
    bus.onAny(ok)

    bus.emit(makeEvent())
    await new Promise((r) => setTimeout(r, 10))

    expect(ok).toHaveBeenCalledOnce()
  })

  it('clear() removes all subscriptions', async () => {
    const received: PlatformEvent[] = []
    bus.on('test.event', (e) => { received.push(e) })
    bus.onAny((e) => { received.push(e) })

    bus.clear()
    bus.emit(makeEvent())

    await new Promise((r) => setTimeout(r, 10))

    expect(received).toHaveLength(0)
  })
})

describe('createPlatformEvent', () => {
  it('creates a valid event with defaults', () => {
    const event = createPlatformEvent(
      'test.created',
      { name: 'test' },
      {
        orgId: crypto.randomUUID(),
        actorId: 'user_123',
        correlationId: crypto.randomUUID(),
      },
    )

    expect(event.id).toBeDefined()
    expect(event.type).toBe('test.created')
    expect(event.schemaVersion).toBe('1.0')
    expect(event.payload).toEqual({ name: 'test' })
    expect(event.metadata.source).toBe('platform')
    expect(event.metadata.causationId).toBeNull()
    expect(event.metadata.traceId).toBeNull()
    expect(event.metadata.spanId).toBeNull()
    expect(event.createdAt).toBeDefined()
  })

  it('freezes the payload', () => {
    const event = createPlatformEvent(
      'test.created',
      { mutable: 'value' },
      {
        orgId: crypto.randomUUID(),
        actorId: 'user_123',
        correlationId: crypto.randomUUID(),
      },
    )

    expect(() => {
      (event.payload as Record<string, unknown>).mutable = 'changed'
    }).toThrow()
  })

  it('accepts custom metadata fields', () => {
    const event = createPlatformEvent(
      'test.created',
      {},
      {
        orgId: crypto.randomUUID(),
        actorId: 'user_123',
        correlationId: crypto.randomUUID(),
        causationId: crypto.randomUUID(),
        source: 'custom-source',
        traceId: 'trace-abc',
        spanId: 'span-def',
      },
    )

    expect(event.metadata.source).toBe('custom-source')
    expect(event.metadata.causationId).toBeDefined()
    expect(event.metadata.traceId).toBe('trace-abc')
    expect(event.metadata.spanId).toBe('span-def')
  })

  it('accepts custom schema version', () => {
    const event = createPlatformEvent(
      'test.created',
      {},
      {
        orgId: crypto.randomUUID(),
        actorId: 'user_123',
        correlationId: crypto.randomUUID(),
      },
      '2.0',
    )

    expect(event.schemaVersion).toBe('2.0')
  })
})

describe('package index', () => {
  it('exports core symbols', async () => {
    const api = await import('../index')
    expect(typeof api.PlatformEventBus).toBe('function')
    expect(typeof api.createPlatformEvent).toBe('function')
    expect(typeof api.PlatformEventDispatcher).toBe('function')
    expect(typeof api.validateEvent).toBe('function')
  })
})
