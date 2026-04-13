/**
 * Trade — Event Emitter Tests
 *
 * Tests for onTradeEvent, emitTradeEvent, and createTradeEvent.
 * The event emitter only depends on @nzila/trade-core for types and
 * the TradeEventTypes constant — no external I/O.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @nzila/trade-core so we can resolve it without a built package
vi.mock('@nzila/trade-core', () => ({
  TradeEventTypes: {
    DEAL_CREATED: 'deal_created',
    DEAL_UPDATED: 'deal_updated',
    QUOTE_ACCEPTED: 'quote_accepted',
    SHIPMENT_DELIVERED: 'shipment_delivered',
    COMMISSION_SETTLED: 'commission_settled',
  },
}))

import {
  onTradeEvent,
  emitTradeEvent,
  createTradeEvent,
} from '../events/trade-event-emitter'
import type { TradeDomainEvent } from '@nzila/trade-core'

function makeEvent(type = 'deal_created', payload: Record<string, unknown> = {}): TradeDomainEvent {
  return {
    id: 'evt-1',
    type: type as TradeDomainEvent['type'],
    payload,
    metadata: {
      orgId: 'org-1',
      actorId: 'user-1',
      correlationId: 'corr-1',
      source: '@nzila/trade',
    },
    createdAt: new Date(),
  }
}

describe('onTradeEvent / emitTradeEvent', () => {
  beforeEach(() => {
    // Each test uses fresh registrations via the returned unsubscribe
  })

  it('calls registered handler when event is emitted', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const unsubscribe = onTradeEvent('deal_created' as TradeDomainEvent['type'], handler)

    const event = makeEvent('deal_created')
    await emitTradeEvent(event)

    expect(handler).toHaveBeenCalledWith(event)
    unsubscribe()
  })

  it('calls multiple handlers for the same event type', async () => {
    const h1 = vi.fn().mockResolvedValue(undefined)
    const h2 = vi.fn().mockResolvedValue(undefined)
    const unsub1 = onTradeEvent('deal_updated' as TradeDomainEvent['type'], h1)
    const unsub2 = onTradeEvent('deal_updated' as TradeDomainEvent['type'], h2)

    const event = makeEvent('deal_updated')
    await emitTradeEvent(event)

    expect(h1).toHaveBeenCalledWith(event)
    expect(h2).toHaveBeenCalledWith(event)
    unsub1()
    unsub2()
  })

  it('unsubscription prevents future calls', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const unsubscribe = onTradeEvent('quote_accepted' as TradeDomainEvent['type'], handler)

    unsubscribe()
    await emitTradeEvent(makeEvent('quote_accepted'))

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not call handler for different event type', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const unsubscribe = onTradeEvent('deal_created' as TradeDomainEvent['type'], handler)

    await emitTradeEvent(makeEvent('shipment_delivered'))

    expect(handler).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('does not throw when no handlers registered for event type', async () => {
    await expect(emitTradeEvent(makeEvent('commission_settled'))).resolves.toBeUndefined()
  })

  it('continues calling remaining handlers if one throws', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('handler error'))
    const succeeding = vi.fn().mockResolvedValue(undefined)

    const unsub1 = onTradeEvent('deal_created' as TradeDomainEvent['type'], failing)
    const unsub2 = onTradeEvent('deal_created' as TradeDomainEvent['type'], succeeding)

    await emitTradeEvent(makeEvent('deal_created'))

    // emitTradeEvent uses Promise.allSettled — all handlers run regardless of failures
    expect(failing).toHaveBeenCalled()
    expect(succeeding).toHaveBeenCalled()
    unsub1()
    unsub2()
  })
})

describe('createTradeEvent', () => {
  it('returns event with correct type and payload', () => {
    const event = createTradeEvent(
      'deal_created' as TradeDomainEvent['type'],
      { dealId: 'deal-1' },
      { orgId: 'org-1', actorId: 'user-1', correlationId: 'corr-1' },
    )

    expect(event.type).toBe('deal_created')
    expect(event.payload.dealId).toBe('deal-1')
  })

  it('includes metadata with source @nzila/trade', () => {
    const event = createTradeEvent(
      'quote_accepted' as TradeDomainEvent['type'],
      {},
      { orgId: 'org-1', actorId: 'user-1', correlationId: 'corr-1' },
    )

    expect(event.metadata.orgId).toBe('org-1')
    expect(event.metadata.actorId).toBe('user-1')
    expect(event.metadata.source).toBe('@nzila/trade')
  })

  it('generates a unique id (uuid format)', () => {
    const e1 = createTradeEvent('deal_created' as TradeDomainEvent['type'], {}, { orgId: 'o', actorId: 'u', correlationId: 'c' })
    const e2 = createTradeEvent('deal_created' as TradeDomainEvent['type'], {}, { orgId: 'o', actorId: 'u', correlationId: 'c' })

    expect(e1.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(e1.id).not.toBe(e2.id)
  })

  it('sets createdAt to a recent date', () => {
    const before = new Date()
    const event = createTradeEvent('deal_updated' as TradeDomainEvent['type'], {}, { orgId: 'o', actorId: 'u', correlationId: 'c' })
    const after = new Date()

    expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(event.createdAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('forwards optional causationId', () => {
    const event = createTradeEvent(
      'deal_created' as TradeDomainEvent['type'],
      {},
      { orgId: 'o', actorId: 'u', correlationId: 'c', causationId: 'parent-evt' },
    )

    expect(event.metadata.causationId).toBe('parent-evt')
  })
})

describe('locales constants', () => {
  it('exports expected locales', async () => {
    const { locales, defaultLocale } = await import('../locales')
    expect(locales).toContain('en-CA')
    expect(locales).toContain('fr-CA')
    expect(defaultLocale).toBe('en-CA')
  })
})
