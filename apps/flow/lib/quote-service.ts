/**
 * Quote service — Flow app.
 *
 * Wires @nzila/commerce-services for quote CRUD, pricing, and lifecycle
 * orchestration. Uses the QuoteRepository port for persistence.
 */
import {
  createQuoteService,
  type CreateQuoteInput,
  type QuoteLineInput,
  type QuoteEntity,
  type QuoteLineEntity,
  type PricedQuote,
  type QuoteServiceResult,
  type QuoteRepository,
} from '@nzila/commerce-services'

export {
  createQuoteService,
}
export type {
  CreateQuoteInput,
  QuoteLineInput,
  QuoteEntity,
  QuoteLineEntity,
  PricedQuote,
  QuoteServiceResult,
  QuoteRepository,
}

/**
 * Domain events — from @nzila/commerce-events.
 * Used for publishing quote lifecycle events to the event bus.
 */
export {
  InMemoryEventBus,
  createDomainEvent,
  domainEventsFromTransition,
  CommerceEventTypes,
  type DomainEvent,
  type EventBus,
  type CommerceEventType,
} from '@nzila/commerce-events'
