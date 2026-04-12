import type { DomainEvent } from '@nzila/contracts'

// ─── Durable Event Bus Interface ────────────────────────────────────────────
// Abstraction for message brokers that guarantee at-least-once delivery.
// Implementations: InMemoryEventBus (dev/test), AzureServiceBusAdapter (prod).

export interface DurableEventBusOptions {
  /** Dead-letter after N delivery attempts (default: 5) */
  maxDeliveryAttempts?: number
  /** Visibility timeout in seconds before redelivery (default: 30) */
  visibilityTimeoutSeconds?: number
}

export interface DurableSubscription {
  /** Unsubscribe and release resources */
  unsubscribe(): Promise<void>
}

/**
 * Durable event bus contract — guarantees at-least-once delivery
 * with acknowledgement and dead-lettering.
 */
export interface DurableEventBus {
  /**
   * Publish an event to the bus. The event is persisted before returning.
   * @throws if the event cannot be persisted (network failure, quota, etc.)
   */
  publish(event: DomainEvent): Promise<void>

  /**
   * Subscribe to events of a given type. Handler is called at least once per event.
   * Handler must be idempotent. Throwing requeues the message.
   */
  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): Promise<DurableSubscription>

  /** Subscribe to all event types */
  subscribeAll(
    handler: (event: DomainEvent) => Promise<void>,
  ): Promise<DurableSubscription>

  /** Graceful shutdown — close connections, flush pending acks */
  close(): Promise<void>
}
