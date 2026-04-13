/**
 * @nzila/commerce-events — Event Bus Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus, createDomainEvent, domainEventsFromTransition } from './event-bus'
import type { DomainEvent, EventHandler } from './types'

// ── Fixtures ────────────────────────────────────────────────────────────────

const TEST_ORG = 'org-test-001'
const TEST_ACTOR = 'actor-test-001'

function makeEvent(type: string, payload: Record<string, unknown> = {}): DomainEvent {
  return createDomainEvent(type, payload, {
    orgId: TEST_ORG,
    actorId: TEST_ACTOR,
    correlationId: 'corr-001',
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('createDomainEvent', () => {
  it('generates unique id and ISO timestamp', () => {
    const event = createDomainEvent('test.created', { foo: 'bar' }, {
      orgId: TEST_ORG,
      actorId: TEST_ACTOR,
      correlationId: 'corr-001',
    })

    expect(event.id).toBeTruthy()
    expect(event.type).toBe('test.created')
    expect(event.payload).toEqual({ foo: 'bar' })
    expect(event.metadata.orgId).toBe(TEST_ORG)
    expect(event.metadata.actorId).toBe(TEST_ACTOR)
    expect(event.metadata.correlationId).toBe('corr-001')
    expect(event.metadata.causationId).toBeNull()
    expect(event.metadata.source).toBe('commerce-events')
    expect(new Date(event.createdAt).getTime()).toBeGreaterThan(0)
  })

  it('allows custom causationId and source', () => {
    const event = createDomainEvent('test.event', {}, {
      orgId: TEST_ORG,
      actorId: TEST_ACTOR,
      correlationId: 'corr-002',
      causationId: 'evt-parent',
      source: 'quote-service',
    })

    expect(event.metadata.causationId).toBe('evt-parent')
    expect(event.metadata.source).toBe('quote-service')
  })

  it('each call generates a different id', () => {
    const meta = { orgId: TEST_ORG, actorId: TEST_ACTOR, correlationId: 'c' }
    const a = createDomainEvent('x', {}, meta)
    const b = createDomainEvent('x', {}, meta)
    expect(a.id).not.toBe(b.id)
  })
})

describe('domainEventsFromTransition', () => {
  it('converts emitted events array to DomainEvents', () => {
    const eventsToEmit = [
      { type: 'order.confirmed', payload: { orderId: 'o-1' } },
      { type: 'invoice.create_from_order', payload: { orderId: 'o-1' } },
    ]

    const result = domainEventsFromTransition(eventsToEmit, {
      orgId: TEST_ORG,
      actorId: TEST_ACTOR,
      correlationId: 'corr-003',
    })

    expect(result).toHaveLength(2)
    expect(result[0]!.type).toBe('order.confirmed')
    expect(result[1]!.type).toBe('invoice.create_from_order')
    expect(result[0]!.metadata.orgId).toBe(TEST_ORG)
    expect(result[0]!.metadata.correlationId).toBe('corr-003')
  })

  it('returns empty array for empty events', () => {
    expect(domainEventsFromTransition([], {
      orgId: TEST_ORG,
      actorId: TEST_ACTOR,
      correlationId: 'c',
    })).toEqual([])
  })
})

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus

  beforeEach(() => {
    bus = new InMemoryEventBus()
  })

  describe('on / emit', () => {
    it('delivers event to subscriber', () => {
      const handler = vi.fn()
      bus.on('order.created', handler)
      bus.emit(makeEvent('order.created', { orderId: 'o-1' }))

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0]![0].type).toBe('order.created')
    })

    it('does not deliver to wrong event type', () => {
      const handler = vi.fn()
      bus.on('order.created', handler)
      bus.emit(makeEvent('quote.accepted'))

      expect(handler).not.toHaveBeenCalled()
    })

    it('delivers to multiple subscribers', () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      bus.on('x', h1)
      bus.on('x', h2)
      bus.emit(makeEvent('x'))

      expect(h1).toHaveBeenCalledTimes(1)
      expect(h2).toHaveBeenCalledTimes(1)
    })

    it('isolates handler errors', () => {
      const thrower = vi.fn(() => { throw new Error('boom') })
      const safe = vi.fn()
      bus.on('x', thrower as unknown as EventHandler)
      bus.on('x', safe)
      bus.emit(makeEvent('x'))

      expect(thrower).toHaveBeenCalledTimes(1)
      expect(safe).toHaveBeenCalledTimes(1)
    })
  })

  describe('onAny', () => {
    it('receives events of all types', () => {
      const handler = vi.fn()
      bus.onAny(handler)
      bus.emit(makeEvent('a'))
      bus.emit(makeEvent('b'))

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('once', () => {
    it('handler fires only once', () => {
      const handler = vi.fn()
      bus.once('x', handler)
      bus.emit(makeEvent('x'))
      bus.emit(makeEvent('x'))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('returned unsubscribe prevents handler from firing', () => {
      const handler = vi.fn()
      const unsub = bus.once('x', handler)
      unsub()
      bus.emit(makeEvent('x'))

      expect(handler).not.toHaveBeenCalled()
    })

    it('handler fires only once via emitAndWait', async () => {
      const handler = vi.fn()
      bus.once('x', handler)
      await bus.emitAndWait(makeEvent('x'))
      await bus.emitAndWait(makeEvent('x'))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('reuses existing subscriber set when type already has handlers', () => {
      const first = vi.fn()
      const second = vi.fn()
      bus.on('x', first)
      bus.once('x', second)

      bus.emit(makeEvent('x'))
      bus.emit(makeEvent('x'))

      expect(first).toHaveBeenCalledTimes(2)
      expect(second).toHaveBeenCalledTimes(1)
    })
  })

  describe('unsubscribe', () => {
    it('on() returns unsubscribe function', () => {
      const handler = vi.fn()
      const unsub = bus.on('x', handler)
      unsub()
      bus.emit(makeEvent('x'))

      expect(handler).not.toHaveBeenCalled()
    })

    it('onAny() returns unsubscribe function', () => {
      const handler = vi.fn()
      const unsub = bus.onAny(handler)
      unsub()
      bus.emit(makeEvent('x'))

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('emitAndWait', () => {
    it('waits for async handlers', async () => {
      const order: string[] = []
      bus.on('x', async () => {
        await new Promise((r) => setTimeout(r, 10))
        order.push('async-done')
      })

      await bus.emitAndWait(makeEvent('x'))
      order.push('after-wait')

      expect(order).toEqual(['async-done', 'after-wait'])
    })

    it('isolates async handler errors', async () => {
      const safe = vi.fn()
      bus.on('x', async () => { throw new Error('boom') })
      bus.on('x', safe)

      await bus.emitAndWait(makeEvent('x'))
      expect(safe).toHaveBeenCalledTimes(1)
    })

    it('handles sync handlers that do not return a promise', async () => {
      const handler = vi.fn()
      bus.on('x', handler)

      await bus.emitAndWait(makeEvent('x'))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('isolates sync handler errors in async dispatch', async () => {
      const thrower = vi.fn(() => { throw new Error('sync boom') })
      const safe = vi.fn()
      bus.on('x', thrower as unknown as EventHandler)
      bus.on('x', safe)

      await bus.emitAndWait(makeEvent('x'))
      expect(safe).toHaveBeenCalledTimes(1)
    })
  })

  describe('emitBatch / emitBatchAndWait', () => {
    it('emitBatch delivers all events', () => {
      const handler = vi.fn()
      bus.on('x', handler)
      bus.emitBatch([makeEvent('x'), makeEvent('x'), makeEvent('x')])
      expect(handler).toHaveBeenCalledTimes(3)
    })

    it('emitBatchAndWait delivers in order', async () => {
      const order: string[] = []
      bus.on('a', async () => {
        await new Promise((r) => setTimeout(r, 5))
        order.push('a')
      })
      bus.on('b', () => { order.push('b') })

      await bus.emitBatchAndWait([makeEvent('a'), makeEvent('b')])
      expect(order).toEqual(['a', 'b'])
    })
  })

  describe('clear', () => {
    it('removes all subscribers', () => {
      const handler = vi.fn()
      bus.on('x', handler)
      bus.onAny(handler)
      bus.clear()
      bus.emit(makeEvent('x'))

      expect(handler).not.toHaveBeenCalled()
    })
  })
})
