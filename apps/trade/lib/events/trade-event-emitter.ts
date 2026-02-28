/**
 * Trade Integration Events — emitter for trade domain events.
 *
 * Publishes trade events via @nzila/integrations-runtime dispatcher.
 * All external communication (webhook, email, SMS) goes through this module.
 * Server actions emit domain events; this module dispatches them to integrations.
 */

import type { TradeDomainEvent, TradeEventType } from '@nzila/trade-core'
import { TradeEventTypes } from '@nzila/trade-core'

// ── Event handler registry ──────────────────────────────────────────────────

type TradeEventHandler = (event: TradeDomainEvent) => Promise<void>

const handlers = new Map<TradeEventType, TradeEventHandler[]>()

export function onTradeEvent(
  type: TradeEventType,
  handler: TradeEventHandler,
): () => void {
  const existing = handlers.get(type) ?? []
  handlers.set(type, [...existing, handler])

  // Return unsubscribe function
  return () => {
    const current = handlers.get(type) ?? []
    handlers.set(
      type,
      current.filter((h) => h !== handler),
    )
  }
}

export async function emitTradeEvent(event: TradeDomainEvent): Promise<void> {
  const eventHandlers = handlers.get(event.type) ?? []
  const wildcardHandlers = handlers.get('*' as TradeEventType) ?? []

  const allHandlers = [...eventHandlers, ...wildcardHandlers]

  await Promise.allSettled(allHandlers.map((h) => h(event)))
}

// ── Convenience factory ─────────────────────────────────────────────────────

export function createTradeEvent<TPayload extends Record<string, unknown>>(
  type: TradeEventType,
  payload: TPayload,
  metadata: {
    entityId: string
    actorId: string
    correlationId: string
    causationId?: string
  },
): TradeDomainEvent<TPayload> {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    metadata: {
      ...metadata,
      source: '@nzila/trade',
    },
    createdAt: new Date(),
  }
}

// ── Integration dispatch helpers ────────────────────────────────────────────

/**
 * Creates a dispatcher-bound handler that sends trade events
 * to the integrations-runtime dispatcher.
 *
 * Usage:
 * ```ts
 * import { IntegrationDispatcher } from '@nzila/integrations-runtime'
 *
 * const dispatcher = new IntegrationDispatcher(ports)
 * onTradeEvent(TradeEventTypes.DEAL_CREATED, createIntegrationHandler(dispatcher))
 * ```
 */
export function createIntegrationHandler(dispatcher: {
  dispatch(request: {
    orgId: string
    channel: string
    recipientRef: string
    payload: Record<string, unknown>
    correlationId: string
    templateId?: string
  }): Promise<{ id: string; status: string }>
}): TradeEventHandler {
  return async (event) => {
    const { entityId, correlationId } = event.metadata

    // Route events to appropriate integration channels
    const routing = getEventRouting(event.type)
    if (!routing) return

    for (const route of routing) {
      await dispatcher.dispatch({
        orgId: entityId,
        channel: route.channel,
        recipientRef: route.recipientRef ?? entityId,
        payload: {
          eventType: event.type,
          eventId: event.id,
          ...event.payload,
        },
        correlationId,
        templateId: route.templateId,
      })
    }
  }
}

// ── Event → integration channel routing ─────────────────────────────────────

interface EventRoute {
  channel: string
  recipientRef?: string
  templateId?: string
}

function getEventRouting(eventType: TradeEventType): EventRoute[] | null {
  switch (eventType) {
    case TradeEventTypes.DEAL_CREATED:
      return [
        { channel: 'webhook', templateId: 'trade.deal.created' },
      ]
    case TradeEventTypes.DEAL_QUALIFIED:
      return [
        { channel: 'webhook', templateId: 'trade.deal.qualified' },
        { channel: 'email', templateId: 'trade-deal-qualified-notification' },
      ]
    case TradeEventTypes.DEAL_FUNDED:
      return [
        { channel: 'webhook', templateId: 'trade.deal.funded' },
        { channel: 'email', templateId: 'trade-deal-funded-notification' },
      ]
    case TradeEventTypes.DEAL_CANCELLED:
      return [
        { channel: 'webhook', templateId: 'trade.deal.cancelled' },
        { channel: 'email', templateId: 'trade-deal-cancelled-notification' },
      ]
    case TradeEventTypes.QUOTE_ACCEPTED:
      return [
        { channel: 'webhook', templateId: 'trade.quote.accepted' },
        { channel: 'email', templateId: 'trade-quote-accepted-notification' },
      ]
    case TradeEventTypes.SHIPMENT_DELIVERED:
      return [
        { channel: 'webhook', templateId: 'trade.shipment.delivered' },
        { channel: 'email', templateId: 'trade-shipment-delivered-notification' },
      ]
    case TradeEventTypes.COMMISSION_FINALIZED:
      return [
        { channel: 'webhook', templateId: 'trade.commission.finalized' },
      ]
    default:
      // All other events → webhook only
      return [{ channel: 'webhook' }]
  }
}

// ── Re-export event types for consumers ─────────────────────────────────────

export { TradeEventTypes } from '@nzila/trade-core'
export type { TradeDomainEvent, TradeEventType } from '@nzila/trade-core'
