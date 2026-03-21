/**
 * E2E Proof Test: Contract-Backed Event Flow
 *
 * Proves that inter-module events flow through @nzila/events with payload
 * validation against @nzila/contracts. Validates: emission → schema validation
 * → bus delivery → persistent storage → metadata correlation. Writes
 * machine-verifiable proof artifacts.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  EventBus,
  EventEmitter,
  InMemoryEventStore,
  type DomainEvent,
} from '@nzila/events'
import {
  createDefaultRegistry,
} from '@nzila/contracts'
import { generateTraceId } from '@nzila/observability'
import { writeProofBundle, buildSummary } from '../../../scripts/proof/proof-artifacts'
import { randomUUID } from 'node:crypto'

const SCENARIO = 'event-contract-flow'

// ── Collected evidence ──────────────────────────────────────────────────────

const evidence = {
  traceId: '',
  deliveredEvents: [] as DomainEvent[],
  storedEvents: [] as DomainEvent[],
  validationResults: [] as Array<{ eventType: string; valid: boolean; errors?: string[] }>,
}

describe('Contract-Backed Event Flow — Full Pipeline Proof', () => {
  const bus = new EventBus()
  const store = new InMemoryEventStore()
  const registry = createDefaultRegistry()
  const emitter = new EventEmitter({
    bus,
    store,
    validateContracts: true,
    source: 'proof-test',
  })

  const correlationId = 'corr-proof-001'
  const orderId = randomUUID()
  const paymentId = randomUUID()
  let orderEvent: DomainEvent
  let paymentEvent: DomainEvent

  beforeAll(async () => {
    evidence.traceId = generateTraceId()

    // Register handlers to capture delivery
    bus.on('OrderCreated', async (event) => {
      evidence.deliveredEvents.push(event as DomainEvent)
    })
    bus.on('PaymentProcessed', async (event) => {
      evidence.deliveredEvents.push(event as DomainEvent)
    })

    // Validate contracts explicitly for artifact recording
    const orderValidation = registry.validate('OrderCreated', 1, {
      orderId,
      customerId: 'cust-001',
      items: [{ productId: 'p-001', quantity: 2, unitPrice: 49.99 }],
      totalAmount: 99.98,
      currency: 'USD',
    })
    evidence.validationResults.push({ eventType: 'OrderCreated', ...orderValidation })

    const paymentValidation = registry.validate('PaymentProcessed', 1, {
      paymentId,
      orderId,
      amount: 99.98,
      currency: 'USD',
      method: 'card',
      status: 'success',
    })
    evidence.validationResults.push({ eventType: 'PaymentProcessed', ...paymentValidation })

    // Emit events through the governed emitter
    orderEvent = await emitter.emitEvent(
      'OrderCreated',
      {
        orderId,
        customerId: 'cust-001',
        items: [{ productId: 'p-001', quantity: 2, unitPrice: 49.99 }],
        totalAmount: 99.98,
        currency: 'USD',
      },
      {
        orgId: 'org_commerce',
        actorId: 'user_checkout_001',
        traceId: evidence.traceId,
        correlationId,
        source: 'proof-test',
      },
    )

    paymentEvent = await emitter.emitEvent(
      'PaymentProcessed',
      {
        paymentId,
        orderId,
        amount: 99.98,
        currency: 'USD',
        method: 'card',
        status: 'success',
      },
      {
        orgId: 'org_commerce',
        actorId: 'user_checkout_001',
        traceId: evidence.traceId,
        correlationId,
        causationId: orderEvent.id,
        source: 'proof-test',
      },
    )

    // Collect stored events
    evidence.storedEvents = store.getAll() as DomainEvent[]
  })

  it('both events pass contract validation', () => {
    for (const v of evidence.validationResults) {
      expect(v.valid).toBe(true)
    }
  })

  it('events are delivered to handlers', () => {
    expect(evidence.deliveredEvents.length).toBe(2)
    expect(evidence.deliveredEvents[0].type).toBe('OrderCreated')
    expect(evidence.deliveredEvents[1].type).toBe('PaymentProcessed')
  })

  it('events are persisted in event store', () => {
    expect(evidence.storedEvents.length).toBe(2)
  })

  it('events have explicit contract version', () => {
    expect(orderEvent.version).toBe(1)
    expect(paymentEvent.version).toBe(1)
  })

  it('events have correct type', () => {
    expect(orderEvent.type).toBe('OrderCreated')
    expect(paymentEvent.type).toBe('PaymentProcessed')
  })

  it('metadata correlates to originating request', () => {
    expect(orderEvent.metadata.correlationId).toBe(correlationId)
    expect(paymentEvent.metadata.correlationId).toBe(correlationId)
    expect(paymentEvent.metadata.causationId).toBe(orderEvent.id)
  })

  it('org and actor context propagated', () => {
    expect(orderEvent.metadata.orgId).toBe('org_commerce')
    expect(orderEvent.metadata.actorId).toBe('user_checkout_001')
  })

  it('trace context links events', () => {
    expect(orderEvent.metadata.traceId).toBe(evidence.traceId)
    expect(paymentEvent.metadata.traceId).toBe(evidence.traceId)
  })

  it('writes proof artifacts', () => {
    const paths = writeProofBundle(SCENARIO, {
      summary: buildSummary(SCENARIO, {
        trace_id: evidence.traceId,
        actor_id: 'user_checkout_001',
        org_id: 'org_commerce',
        event_contract: 'OrderCreated_v1, PaymentProcessed_v1',
      }),
      event: {
        emittedEvents: [
          {
            id: orderEvent.id,
            type: orderEvent.type,
            version: orderEvent.version,
            payload: orderEvent.payload,
            metadata: orderEvent.metadata,
            timestamp: orderEvent.timestamp,
          },
          {
            id: paymentEvent.id,
            type: paymentEvent.type,
            version: paymentEvent.version,
            payload: paymentEvent.payload,
            metadata: paymentEvent.metadata,
            timestamp: paymentEvent.timestamp,
          },
        ],
        contractValidation: evidence.validationResults,
        correlationId,
      },
      trace: {
        traceId: evidence.traceId,
        scenario: SCENARIO,
        timestamp: new Date().toISOString(),
      },
      request: {
        action: 'checkout',
        events: ['OrderCreated', 'PaymentProcessed'],
        correlationId,
      },
      response: {
        eventsEmitted: 2,
        eventsDelivered: evidence.deliveredEvents.length,
        eventsStored: evidence.storedEvents.length,
        allContractsValid: evidence.validationResults.every(v => v.valid),
      },
    })

    expect(paths.length).toBe(5)
  })
})
