import type { DomainEvent } from '@nzila/contracts'
import type { DurableEventBus, DurableEventBusOptions, DurableSubscription } from '../durable-bus'

// ─── Azure Service Bus Adapter ──────────────────────────────────────────────
// Production-ready durable event bus backed by Azure Service Bus.
// Requires @azure/service-bus peer dependency.
//
// STATUS: Stub — wire up when Azure Service Bus namespace is provisioned.
//
// Usage:
//   import { AzureServiceBusAdapter } from '@nzila/events/adapters/azure-service-bus'
//   const bus = new AzureServiceBusAdapter({
//     connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING!,
//     topicName: 'nzila-events',
//   })

export interface AzureServiceBusConfig extends DurableEventBusOptions {
  connectionString: string
  topicName: string
  /** Subscription name (defaults to process hostname) */
  subscriptionName?: string
}

export class AzureServiceBusAdapter implements DurableEventBus {
  private readonly config: AzureServiceBusConfig

  constructor(config: AzureServiceBusConfig) {
    this.config = config
  }

  async publish(event: DomainEvent): Promise<void> {
    // TODO: Implement with @azure/service-bus ServiceBusSender
    // const { ServiceBusClient } = await import('@azure/service-bus')
    // const client = new ServiceBusClient(this.config.connectionString)
    // const sender = client.createSender(this.config.topicName)
    // await sender.sendMessages({ body: event, subject: event.type })
    // await sender.close()
    // await client.close()
    throw new Error(
      `AzureServiceBusAdapter.publish() not yet implemented. ` +
        `Provision Azure Service Bus and install @azure/service-bus to enable.`,
    )
  }

  async subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): Promise<DurableSubscription> {
    // TODO: Implement with ServiceBusReceiver + topic subscription filter
    void eventType
    void handler
    throw new Error('AzureServiceBusAdapter.subscribe() not yet implemented.')
  }

  async subscribeAll(
    handler: (event: DomainEvent) => Promise<void>,
  ): Promise<DurableSubscription> {
    void handler
    throw new Error('AzureServiceBusAdapter.subscribeAll() not yet implemented.')
  }

  async close(): Promise<void> {
    // TODO: Close ServiceBusClient connection
  }
}
