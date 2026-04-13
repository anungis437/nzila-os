/**
 * @nzila/platform-event-fabric — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import {
  PlatformEventTypes,
  createPlatformEventBus,
  createInMemoryEventStore,
  registerEventType,
  getEventSchema,
  validateEventPayload,
  listEventSchemas,
  resetEventSchemaRegistry,
  buildPlatformEvent,
} from './index'
import type { PlatformEvent } from './types'

const TENANT = '550e8400-e29b-41d4-a716-446655440000'

describe('platform-event-fabric', () => {
  beforeEach(() => {
    resetEventSchemaRegistry()
  })

  describe('event bus', () => {
    it('publishes and receives typed events', async () => {
      const bus = createPlatformEventBus()
      const received: PlatformEvent[] = []

      bus.subscribe(PlatformEventTypes.CASE_CREATED, (evt) => {
        received.push(evt)
      })

      const event = buildPlatformEvent({
        type: PlatformEventTypes.CASE_CREATED,
        payload: { caseId: '123', title: 'Test case' },
        tenantId: TENANT,
        actorId: 'user-1',
        source: 'test',
      })

      await bus.publish(event)

      expect(received).toHaveLength(1)
      expect(received[0].type).toBe('case.created')
    })

    it('supports global subscribers', async () => {
      const bus = createPlatformEventBus()
      const all: PlatformEvent[] = []

      bus.subscribeAll((evt) => {
        all.push(evt)
      })

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.LEAD_CREATED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.DOCUMENT_UPLOADED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      expect(all).toHaveLength(2)
    })

    it('supports unsubscribe', async () => {
      const bus = createPlatformEventBus()
      const received: PlatformEvent[] = []

      const unsub = bus.subscribe(PlatformEventTypes.PAYMENT_RECEIVED, (evt) => {
        received.push(evt)
      })

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.PAYMENT_RECEIVED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      unsub()

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.PAYMENT_RECEIVED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      expect(received).toHaveLength(1)
    })

    it('replays events from store', async () => {
      const store = createInMemoryEventStore()
      const bus = createPlatformEventBus({ store })

      const t0 = new Date('2026-01-01').toISOString()

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.CASE_CREATED,
          payload: { caseId: 'c1' },
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      const events = await bus.replay(PlatformEventTypes.CASE_CREATED, t0)
      expect(events).toHaveLength(1)
    })

    it('replay filters by tenant when store.query receives tenantId', async () => {
      const store = createInMemoryEventStore()
      const bus = createPlatformEventBus({ store })

      const otherTenant = '00000000-0000-0000-0000-000000000099'

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.CASE_CREATED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )
      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.CASE_CREATED,
          payload: {},
          tenantId: otherTenant,
          actorId: 'user-2',
          source: 'test',
        }),
      )
      // Also publish a different event type to exercise the type-mismatch branch
      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.LEAD_CREATED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      const since = new Date('2000-01-01').toISOString()
      // Direct store query with tenantId
      const filtered = await store.query(PlatformEventTypes.CASE_CREATED, since, TENANT)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].metadata.tenantId).toBe(TENANT)
    })

    it('allows multiple subscribers for the same event type', async () => {
      const bus = createPlatformEventBus()
      const first: PlatformEvent[] = []
      const second: PlatformEvent[] = []

      bus.subscribe(PlatformEventTypes.CASE_CREATED, (evt) => { first.push(evt) })
      bus.subscribe(PlatformEventTypes.CASE_CREATED, (evt) => { second.push(evt) })

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.CASE_CREATED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      expect(first).toHaveLength(1)
      expect(second).toHaveLength(1)
    })
  })

  describe('event schema registry', () => {
    it('registers and retrieves schemas', () => {
      registerEventType({
        eventType: PlatformEventTypes.LEAD_CREATED,
        version: 1,
        description: 'A new lead was created',
        payloadSchema: z.object({ leadId: z.string(), source: z.string() }),
      })

      const schema = getEventSchema(PlatformEventTypes.LEAD_CREATED)
      expect(schema).toBeDefined()
      expect(schema!.version).toBe(1)
    })

    it('validates event payload against schema', () => {
      registerEventType({
        eventType: PlatformEventTypes.PAYMENT_RECEIVED,
        version: 1,
        description: 'Payment received',
        payloadSchema: z.object({ amount: z.number(), currency: z.string() }),
      })

      expect(
        validateEventPayload(PlatformEventTypes.PAYMENT_RECEIVED, {
          amount: 100,
          currency: 'USD',
        }).success,
      ).toBe(true)

      expect(
        validateEventPayload(PlatformEventTypes.PAYMENT_RECEIVED, {
          amount: 'not-a-number',
        }).success,
      ).toBe(false)
    })

    it('lists all registered schemas', () => {
      registerEventType({
        eventType: PlatformEventTypes.LEAD_CREATED,
        version: 1,
        description: 'Lead created',
        payloadSchema: z.object({}),
      })
      registerEventType({
        eventType: PlatformEventTypes.CASE_CREATED,
        version: 1,
        description: 'Case created',
        payloadSchema: z.object({}),
      })

      const schemas = listEventSchemas()
      expect(schemas).toHaveLength(2)
    })
  })

  describe('buildPlatformEvent', () => {
    it('builds a valid event', () => {
      const event = buildPlatformEvent({
        type: PlatformEventTypes.DOCUMENT_UPLOADED,
        payload: { documentId: 'doc-1' },
        tenantId: TENANT,
        actorId: 'user-1',
        source: 'upload-service',
      })

      expect(event.type).toBe('document.uploaded')
      expect(event.metadata.tenantId).toBe(TENANT)
      expect(event.metadata.source).toBe('upload-service')
      expect(event.createdAt).toBeDefined()
    })

    it('falls back to counter-based ID when crypto.randomUUID is unavailable', () => {
      const original = globalThis.crypto?.randomUUID
      // Temporarily remove randomUUID
      if (globalThis.crypto) {
        ;(globalThis.crypto as Record<string, unknown>).randomUUID = undefined
      }
      try {
        const event = buildPlatformEvent({
          type: PlatformEventTypes.CASE_CREATED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        })
        // Fallback ID has the deterministic format
        expect(event.id).toMatch(/^00000000-0000-0000-0000-\d{12}$/)
      } finally {
        if (globalThis.crypto && original) {
          globalThis.crypto.randomUUID = original
        }
      }
    })
  })

  describe('event bus — global handler errors', () => {
    it('calls onError when a global handler throws', async () => {
      const errors: unknown[] = []
      const bus = createPlatformEventBus({
        onError(error) {
          errors.push(error)
        },
      })

      bus.subscribeAll(async () => {
        throw new Error('global-boom')
      })

      await bus.publish(
        buildPlatformEvent({
          type: PlatformEventTypes.LEAD_CREATED,
          payload: {},
          tenantId: TENANT,
          actorId: 'user-1',
          source: 'test',
        }),
      )

      expect(errors).toHaveLength(1)
      expect((errors[0] as Error).message).toBe('global-boom')
    })
  })

  describe('event schema registry — versioned lookups', () => {
    it('retrieves a schema by explicit version', () => {
      registerEventType({
        eventType: PlatformEventTypes.CASE_CREATED,
        version: 1,
        description: 'Case created v1',
        payloadSchema: z.object({ caseId: z.string() }),
      })
      registerEventType({
        eventType: PlatformEventTypes.CASE_CREATED,
        version: 2,
        description: 'Case created v2',
        payloadSchema: z.object({ caseId: z.string(), priority: z.number() }),
      })

      const v1 = getEventSchema(PlatformEventTypes.CASE_CREATED, 1)
      expect(v1).toBeDefined()
      expect(v1!.version).toBe(1)

      const v2 = getEventSchema(PlatformEventTypes.CASE_CREATED, 2)
      expect(v2).toBeDefined()
      expect(v2!.version).toBe(2)
    })

    it('returns undefined for unregistered version', () => {
      registerEventType({
        eventType: PlatformEventTypes.LEAD_CREATED,
        version: 1,
        description: 'Lead created',
        payloadSchema: z.object({}),
      })

      expect(getEventSchema(PlatformEventTypes.LEAD_CREATED, 99)).toBeUndefined()
    })

    it('validates against a specific version', () => {
      registerEventType({
        eventType: PlatformEventTypes.CASE_CREATED,
        version: 1,
        description: 'Case created v1',
        payloadSchema: z.object({ caseId: z.string() }),
      })

      const result = validateEventPayload(
        PlatformEventTypes.CASE_CREATED,
        { caseId: 'c-1' },
        1,
      )
      expect(result.success).toBe(true)
    })

    it('returns error when validating against unregistered event type', () => {
      const result = validateEventPayload('totally.unknown', { any: 'data' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('No schema registered')
    })
  })

  describe('schema (drizzle tables)', () => {
    it('exports platformEvents and eventSubscriptions tables', async () => {
      const { platformEvents, eventSubscriptions } = await import('./schema')
      // Tables exist and have the expected SQL names
      expect(platformEvents).toBeDefined()
      expect(eventSubscriptions).toBeDefined()
    })

    it('platformEvents table has expected indexes', async () => {
      const { getTableConfig } = await import('drizzle-orm/pg-core')
      const { platformEvents } = await import('./schema')
      const config = getTableConfig(platformEvents)
      expect(config.name).toBe('platform_events')
      const indexNames = config.indexes.map((i) => i.config.name)
      expect(indexNames).toContain('platform_events_tenant_idx')
      expect(indexNames).toContain('platform_events_type_idx')
    })

    it('eventSubscriptions table has expected indexes', async () => {
      const { getTableConfig } = await import('drizzle-orm/pg-core')
      const { eventSubscriptions } = await import('./schema')
      const config = getTableConfig(eventSubscriptions)
      expect(config.name).toBe('event_subscriptions')
      const indexNames = config.indexes.map((i) => i.config.name)
      expect(indexNames).toContain('event_subs_type_idx')
      expect(indexNames).toContain('event_subs_subscriber_idx')
    })
  })
})
