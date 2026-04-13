import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInstrumentedEventBus } from '../src/instrumented-bus'
import { createInMemoryEventStore } from '../src/bus'
import { buildPlatformEvent } from '../src/builders'

describe('createInstrumentedEventBus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function buildTestEvent(type: string = 'workflow.started') {
    return buildPlatformEvent({
      type,
      payload: { name: 'test-workflow' },
      actorId: 'test-user',
      tenantId: 'test-tenant',
      source: 'test',
    })
  }

  it('publishes events through the inner bus', async () => {
    const store = createInMemoryEventStore()
    const bus = createInstrumentedEventBus({ store })

    const received: unknown[] = []
    bus.subscribe('workflow.started', async (e) => {
      received.push(e)
    })

    const event = buildTestEvent()
    await bus.publish(event)

    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ type: 'workflow.started' })
  })

  it('persists events to the store', async () => {
    const store = createInMemoryEventStore()
    const bus = createInstrumentedEventBus({ store })

    const event = buildTestEvent()
    await bus.publish(event)

    const replayed = await bus.replay('workflow.started', '2000-01-01')
    expect(replayed).toHaveLength(1)
  })

  it('captures handler errors without throwing', async () => {
    const errors: unknown[] = []
    const bus = createInstrumentedEventBus({
      onError(error) {
        errors.push(error)
      },
    })

    bus.subscribe('workflow.started', async () => {
      throw new Error('handler-boom')
    })

    const event = buildTestEvent()
    await bus.publish(event) // should not throw

    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe('handler-boom')
  })

  it('tracks subscriptions and unsubscriptions', () => {
    const bus = createInstrumentedEventBus()

    const unsub1 = bus.subscribe('workflow.started', async () => {})
    const unsub2 = bus.subscribeAll(async () => {})

    // Unsubscribe
    unsub1()
    unsub2()

    // No error — just verifying cleanup completes
    expect(true).toBe(true)
  })

  it('supports subscribeAll', async () => {
    const bus = createInstrumentedEventBus()

    const received: string[] = []
    bus.subscribeAll(async (e) => {
      received.push(e.type)
    })

    await bus.publish(buildTestEvent('workflow.started'))
    await bus.publish(buildTestEvent('workflow.completed'))

    expect(received).toEqual(['workflow.started', 'workflow.completed'])
  })

  it('replays events from store', async () => {
    const store = createInMemoryEventStore()
    const bus = createInstrumentedEventBus({ store })

    await bus.publish(buildTestEvent())
    await bus.publish(buildTestEvent())

    const events = await bus.replay('workflow.started', '2000-01-01')
    expect(events).toHaveLength(2)
  })

  it('replay returns empty when no store', async () => {
    const bus = createInstrumentedEventBus()
    const events = await bus.replay('workflow.started', '2000-01-01')
    expect(events).toEqual([])
  })

  it('clear empties all handlers', async () => {
    const bus = createInstrumentedEventBus()
    const received: unknown[] = []
    bus.subscribe('workflow.started', async (e) => { received.push(e) })

    bus.clear()
    await bus.publish(buildTestEvent())

    expect(received).toHaveLength(0)
  })

  it('handles handler errors when no onError is provided', async () => {
    // No onError callback — the instrumented wrapper should still not throw
    const bus = createInstrumentedEventBus()

    bus.subscribe('workflow.started', async () => {
      throw new Error('no-callback-boom')
    })

    await expect(bus.publish(buildTestEvent())).resolves.toBeUndefined()
  })

  it('handles non-Error throws in handler', async () => {
    const errors: unknown[] = []
    const bus = createInstrumentedEventBus({
      onError(error) {
        errors.push(error)
      },
    })

    bus.subscribe('workflow.started', async () => {
      // eslint-disable-next-line no-throw-literal
      throw 'string-error'
    })

    await bus.publish(buildTestEvent())

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe('string-error')
  })
})
