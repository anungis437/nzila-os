import { describe, it, expect } from 'vitest'
import { createAgriEventBus, createAgriEvent, createIntegrationHandler } from './event-bus'
import { AgriEventTypes } from './event-types'
import * as agriEventsIndex from './index'

describe('AgriEventBus', () => {
  it('delivers events to typed handlers', async () => {
    const bus = createAgriEventBus()
    const received: string[] = []

    bus.on(AgriEventTypes.LOT_CREATED, async (event) => {
      received.push(event.type)
    })

    const event = createAgriEvent(
      AgriEventTypes.LOT_CREATED,
      { lotId: 'lot-1', cropId: 'crop-1' },
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-1' },
    )

    await bus.emitAndWait(event)
    expect(received).toEqual(['agri.lot.created'])
  })

  it('delivers to wildcard handlers', async () => {
    const bus = createAgriEventBus()
    const received: string[] = []

    bus.onAny(async (event) => {
      received.push(event.type)
    })

    const event = createAgriEvent(
      AgriEventTypes.BATCH_CREATED,
      { batchId: 'batch-1' },
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-1' },
    )

    await bus.emitAndWait(event)
    expect(received).toEqual(['agri.batch.created'])
  })

  it('unsubscribe removes handler', async () => {
    const bus = createAgriEventBus()
    const received: string[] = []

    const unsub = bus.on(AgriEventTypes.LOT_CERTIFIED, async (event) => {
      received.push(event.type)
    })

    unsub()

    const event = createAgriEvent(
      AgriEventTypes.LOT_CERTIFIED,
      { lotId: 'lot-1' },
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-1' },
    )

    await bus.emitAndWait(event)
    expect(received).toEqual([])
  })

  it('clear removes all handlers', async () => {
    const bus = createAgriEventBus()
    const received: string[] = []

    bus.on(AgriEventTypes.PAYMENT_EXECUTED, async (event) => {
      received.push(event.type)
    })

    bus.clear()

    const event = createAgriEvent(
      AgriEventTypes.PAYMENT_EXECUTED,
      { paymentId: 'pay-1' },
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-1' },
    )

    await bus.emitAndWait(event)
    expect(received).toEqual([])
  })

  it('emit dispatches to typed and wildcard handlers', async () => {
    const bus = createAgriEventBus()
    const received: string[] = []

    bus.on(AgriEventTypes.LOT_CREATED, async (event) => {
      received.push(`typed:${event.type}`)
    })
    bus.onAny(async (event) => {
      received.push(`any:${event.type}`)
    })

    bus.emit(
      createAgriEvent(
        AgriEventTypes.LOT_CREATED,
        { lotId: 'lot-2', cropId: 'crop-2' },
        { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-1' },
      ),
    )

    await Promise.resolve()
    expect(received).toEqual(['typed:agri.lot.created', 'any:agri.lot.created'])
  })
})

describe('createAgriEvent', () => {
  it('sets default causationId to null and source', () => {
    const event = createAgriEvent(
      AgriEventTypes.BATCH_CREATED,
      { batchId: 'batch-2' },
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-2' },
    )

    expect(event.metadata.causationId).toBeNull()
    expect(event.metadata.source).toBe('@nzila/agri')
    expect(typeof event.id).toBe('string')
    expect(typeof event.createdAt).toBe('string')
  })

  it('preserves causationId when provided', () => {
    const event = createAgriEvent(
      AgriEventTypes.BATCH_CREATED,
      { batchId: 'batch-3' },
      {
        orgId: 'org-1',
        actorId: 'actor-1',
        correlationId: 'corr-3',
        causationId: 'cause-1',
      },
    )

    expect(event.metadata.causationId).toBe('cause-1')
  })
})

describe('createIntegrationHandler', () => {
  it('dispatches all configured routes for a known event type', async () => {
    const calls: Array<Record<string, unknown>> = []
    const dispatcher = {
      dispatch: async (request: Record<string, unknown>) => {
        calls.push(request)
        return { id: 'n-1', status: 'queued' }
      },
    }

    const handler = createIntegrationHandler(dispatcher)
    await handler(
      createAgriEvent(
        AgriEventTypes.SHIPMENT_CLOSED,
        { shipmentId: 'ship-1' },
        { orgId: 'org-2', actorId: 'actor-2', correlationId: 'corr-4' },
      ),
    )

    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.channel)).toEqual(['webhook', 'email'])
    expect(calls[0]!.recipientRef).toBe('org-2')
  })

  it('falls back to webhook route for unknown event type', async () => {
    const calls: Array<Record<string, unknown>> = []
    const dispatcher = {
      dispatch: async (request: Record<string, unknown>) => {
        calls.push(request)
        return { id: 'n-2', status: 'queued' }
      },
    }

    const handler = createIntegrationHandler(dispatcher)
    await handler(
      createAgriEvent(
        'agri.unknown.event' as any,
        { value: 1 },
        { orgId: 'org-3', actorId: 'actor-3', correlationId: 'corr-5' },
      ),
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]!.channel).toBe('webhook')
    expect(calls[0]!.templateId).toBeUndefined()
  })

  it('routes lot certified events to email, sms and webhook', async () => {
    const calls: Array<Record<string, unknown>> = []
    const dispatcher = {
      dispatch: async (request: Record<string, unknown>) => {
        calls.push(request)
        return { id: 'n-3', status: 'queued' }
      },
    }

    const handler = createIntegrationHandler(dispatcher)
    await handler(
      createAgriEvent(
        AgriEventTypes.LOT_CERTIFIED,
        { lotId: 'lot-9' },
        { orgId: 'org-9', actorId: 'actor-9', correlationId: 'corr-9' },
      ),
    )

    expect(calls.map((c) => c.channel)).toEqual(['email', 'sms', 'webhook'])
  })

  it('routes shipment milestone events to slack and teams', async () => {
    const calls: Array<Record<string, unknown>> = []
    const dispatcher = {
      dispatch: async (request: Record<string, unknown>) => {
        calls.push(request)
        return { id: 'n-4', status: 'queued' }
      },
    }

    const handler = createIntegrationHandler(dispatcher)
    await handler(
      createAgriEvent(
        AgriEventTypes.SHIPMENT_MILESTONE,
        { milestone: 'departed' },
        { orgId: 'org-10', actorId: 'actor-10', correlationId: 'corr-10' },
      ),
    )

    expect(calls.map((c) => c.channel)).toEqual(['slack', 'teams'])
  })

  it('routes payment and planning events to configured channels', async () => {
    const calls: Array<Record<string, unknown>> = []
    const dispatcher = {
      dispatch: async (request: Record<string, unknown>) => {
        calls.push(request)
        return { id: 'n-5', status: 'queued' }
      },
    }

    const handler = createIntegrationHandler(dispatcher)
    await handler(
      createAgriEvent(
        AgriEventTypes.PAYMENT_EXECUTED,
        { paymentId: 'pay-9' },
        { orgId: 'org-11', actorId: 'actor-11', correlationId: 'corr-11' },
      ),
    )
    await handler(
      createAgriEvent(
        AgriEventTypes.PAYMENT_PLAN_CREATED,
        { planId: 'plan-1' },
        { orgId: 'org-11', actorId: 'actor-11', correlationId: 'corr-12' },
      ),
    )
    await handler(
      createAgriEvent(
        AgriEventTypes.BATCH_CREATED,
        { batchId: 'batch-9' },
        { orgId: 'org-11', actorId: 'actor-11', correlationId: 'corr-13' },
      ),
    )
    await handler(
      createAgriEvent(
        AgriEventTypes.SHIPMENT_PLANNED,
        { shipmentId: 'ship-9' },
        { orgId: 'org-11', actorId: 'actor-11', correlationId: 'corr-14' },
      ),
    )

    expect(calls.map((c) => c.channel)).toEqual([
      'email',
      'sms',
      'webhook',
      'webhook',
      'webhook',
      'hubspot',
    ])
  })

  it('exports event APIs from barrel index', () => {
    expect(typeof agriEventsIndex.createAgriEventBus).toBe('function')
    expect(typeof agriEventsIndex.createAgriEvent).toBe('function')
    expect(agriEventsIndex.AgriEventTypes.SHIPMENT_CLOSED).toBe('agri.shipment.closed')
  })
})
