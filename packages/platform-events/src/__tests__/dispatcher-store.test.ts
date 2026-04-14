import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlatformEventDispatcher } from '../dispatcher'
import { DrizzleEventStore } from '../store'
import type { PlatformEvent } from '../types'

function makeEvent(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: crypto.randomUUID(),
    type: 'test.event',
    schemaVersion: '1.0',
    payload: { ok: true },
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

describe('PlatformEventDispatcher', () => {
  let dispatcher: PlatformEventDispatcher

  beforeEach(() => {
    dispatcher = new PlatformEventDispatcher()
  })

  it('dispatches to matching and wildcard handlers and captures failures', async () => {
    const ok = vi.fn(async () => {})
    const fail = vi.fn(async () => {
      throw new Error('handler failed')
    })
    const wildcard = vi.fn(async () => {})

    dispatcher.register({ name: 'ok', eventTypes: ['test.event'], handler: ok })
    dispatcher.register({ name: 'fail', eventTypes: ['test.event'], handler: fail })
    dispatcher.register({ name: 'wildcard', eventTypes: ['*'], handler: wildcard })

    const result = await dispatcher.dispatch(makeEvent())

    expect(result.handlersInvoked).toBe(3)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors[0]?.handler).toBe('fail')
    expect(ok).toHaveBeenCalledOnce()
    expect(wildcard).toHaveBeenCalledOnce()
  })

  it('lists and clears handlers', async () => {
    dispatcher.register({ name: 'one', eventTypes: ['a.event'], handler: async () => {} })
    dispatcher.register({ name: 'two', eventTypes: ['*'], handler: async () => {} })

    const listed = dispatcher.listHandlers()
    expect(listed).toHaveLength(2)
    expect(listed.map((h) => h.name)).toEqual(['one', 'two'])

    dispatcher.clear()
    const result = await dispatcher.dispatch(makeEvent({ type: 'a.event' }))
    expect(result.handlersInvoked).toBe(0)
    expect(result.failed).toBe(0)
  })
})

describe('DrizzleEventStore', () => {
  it('persists event rows with mapped metadata', async () => {
    const values = vi.fn(async (_row: Record<string, unknown>) => ({}))
    const insert = vi.fn(() => ({ values }))
    const db = {
      insert,
      select: vi.fn(),
    } as unknown as ConstructorParameters<typeof DrizzleEventStore>[0]['db']

    const store = new DrizzleEventStore({ db })
    const event = makeEvent()

    await store.persist(event)

    expect(insert).toHaveBeenCalledOnce()
    expect(values).toHaveBeenCalledOnce()
    expect(values.mock.calls[0]?.[0]).toMatchObject({
      id: event.id,
      type: event.type,
      schemaVersion: event.schemaVersion,
      orgId: event.metadata.orgId,
      actorId: event.metadata.actorId,
      source: event.metadata.source,
    })
  })

  it('queries by type, correlation, and count with mapped events', async () => {
    const rows: Record<string, unknown>[] = [
      {
        id: crypto.randomUUID(),
        type: 'test.event',
        schemaVersion: '1.0',
        payload: { a: 1 },
        orgId: crypto.randomUUID(),
        actorId: 'user_1',
        correlationId: crypto.randomUUID(),
        causationId: null,
        source: 'svc',
        traceId: null,
        spanId: null,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        type: 'test.event',
        schemaVersion: '1.0',
        payload: { a: 2 },
        orgId: crypto.randomUUID(),
        actorId: 'user_2',
        correlationId: crypto.randomUUID(),
        causationId: null,
        source: 'svc',
        traceId: null,
        spanId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]

    const limit = vi.fn(async (n: number) => rows.slice(0, n))
    const orderBy = vi.fn(() => ({ limit }))
    const where = vi.fn(() => ({ orderBy }))
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))

    const db = {
      insert: vi.fn(),
      select,
    } as unknown as ConstructorParameters<typeof DrizzleEventStore>[0]['db']

    const store = new DrizzleEventStore({ db })

    const byType = await store.queryByType('org-1', 'test.event', 1)
    expect(byType).toHaveLength(1)
    expect(byType[0]?.createdAt).toMatch(/T/)

    const byCorrelation = await store.queryByCorrelation('corr-1')
    expect(byCorrelation).toHaveLength(2)

    const countByType = await store.count('org-1', 'test.event')
    const countAll = await store.count('org-1')
    expect(countByType).toBe(2)
    expect(countAll).toBe(2)

    expect(select).toHaveBeenCalledTimes(4)
    expect(where).toHaveBeenCalledTimes(4)
    expect(orderBy).toHaveBeenCalledTimes(4)
  })
})
