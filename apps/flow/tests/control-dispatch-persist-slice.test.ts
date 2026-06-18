import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockEmitFlowEvent,
  mockOnFlowEvent,
  mockLogger,
  mockTimelineAdd,
  mockDbValues,
} = vi.hoisted(() => ({
  mockEmitFlowEvent: vi.fn(),
  mockOnFlowEvent: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockTimelineAdd: vi.fn(),
  mockDbValues: vi.fn(),
}))

vi.mock('@/lib/events/emitter', () => ({
  emitFlowEvent: mockEmitFlowEvent,
  onFlowEvent: mockOnFlowEvent,
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('@/lib/repositories/workflow-repository', () => ({
  timelineRepo: { add: mockTimelineAdd },
}))

vi.mock('@nzila/db', () => ({
  db: { insert: vi.fn(() => ({ values: mockDbValues })) },
  flowDomainEvents: { id: 'id' },
}))

describe('Flow dispatch and persistence slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('event dispatcher emits and returns IDs (single + multiple)', async () => {
    const { dispatchDomainEvent, dispatchMultipleEvents } = await import('@/lib/control/dispatch/event-dispatcher')

    mockEmitFlowEvent.mockReturnValueOnce({
      id: 'evt-1',
      type: 'quote_sent',
      entity_type: 'quote',
      entity_id: 'q-1',
    })

    const id = dispatchDomainEvent({
      type: 'quote_sent',
      actor_id: 'a-1',
      org_id: 'o-1',
      entity_type: 'quote',
      entity_id: 'q-1',
      correlation_id: 'corr-1',
      metadata: { source: 'test' },
    })
    expect(id).toBe('evt-1')

    mockEmitFlowEvent
      .mockReturnValueOnce({ id: 'evt-2', type: 'quote_sent', entity_type: 'quote', entity_id: 'q-2' })
      .mockReturnValueOnce({ id: 'evt-3', type: 'quote_sent', entity_type: 'quote', entity_id: 'q-3' })

    const ids = dispatchMultipleEvents([
      { type: 'quote_sent', actor_id: 'a-1', org_id: 'o-1', entity_type: 'quote', entity_id: 'q-2' },
      { type: 'quote_sent', actor_id: 'a-1', org_id: 'o-1', entity_type: 'quote', entity_id: 'q-3' },
    ])
    expect(ids).toEqual(['evt-2', 'evt-3'])
  })

  it('audit dispatcher writes timeline event and builds description', async () => {
    const { dispatchAuditEntry } = await import('@/lib/control/dispatch/audit-dispatcher')

    const ref = await dispatchAuditEntry({
      org_id: 'o-1',
      actor_id: 'a-1',
      entity_type: 'order',
      entity_id: 'ord-1',
      action: 'order_confirmed',
      status_before: 'CREATED',
      status_after: 'CONFIRMED',
      correlation_id: 'corr-1',
    })

    expect(ref.startsWith('audit-')).toBe(true)
    expect(mockTimelineAdd).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalled()
  })

  it('side-effect dispatcher handles missing handlers, failures, throws and batches', async () => {
    const {
      registerSideEffectHandler,
      getRegisteredSideEffectTypes,
      dispatchSideEffect,
      dispatchSideEffects,
    } = await import('@/lib/control/dispatch/side-effect-dispatcher')

    const missing = await dispatchSideEffect({
      type: 'zoho_sync',
      org_id: 'o-1',
      entity_type: 'quote',
      entity_id: 'q-1',
      payload: {},
    })
    expect(missing.success).toBe(false)

    registerSideEffectHandler('zoho_sync', async () => ({ type: 'zoho_sync', success: true }))
    registerSideEffectHandler('shopify_sync', async () => {
      throw new Error('boom')
    })
    registerSideEffectHandler('canva_update', async () => ({ type: 'canva_update', success: false, error: 'bad' }))

    expect(getRegisteredSideEffectTypes()).toEqual(expect.arrayContaining(['zoho_sync', 'shopify_sync', 'canva_update']))

    const ok = await dispatchSideEffect({ type: 'zoho_sync', org_id: 'o-1', entity_type: 'q', entity_id: '1', payload: {} })
    expect(ok.success).toBe(true)

    const thrown = await dispatchSideEffect({ type: 'shopify_sync', org_id: 'o-1', entity_type: 'q', entity_id: '2', payload: {} })
    expect(thrown.success).toBe(false)
    expect(thrown.error).toBe('boom')

    const batch = await dispatchSideEffects([
      { type: 'canva_update', org_id: 'o-1', entity_type: 'q', entity_id: '3', payload: {} },
      { type: 'zoho_sync', org_id: 'o-1', entity_type: 'q', entity_id: '4', payload: {} },
    ])
    expect(batch.results).toHaveLength(2)
    expect(batch.warnings.length).toBeGreaterThan(0)
  })

  it('event persistence stores supported events and initializes listener once', async () => {
    const { persistFlowEvent, initEventPersistence, isEventPersistenceInitialized } = await import('@/lib/events/persist')

    mockDbValues.mockResolvedValue(undefined)

    const skipped = await persistFlowEvent({
      id: 'evt-x',
      type: 'unknown_event' as never,
      org_id: 'o-1',
      entity_type: 'order',
      entity_id: 'ord-1',
      actor_id: 'a-1',
      timestamp: new Date(),
      metadata: {},
    })
    expect(skipped).toBe(false)

    const persisted = await persistFlowEvent({
      id: 'evt-y',
      type: 'order_confirmed',
      org_id: 'o-1',
      entity_type: 'order',
      entity_id: 'ord-1',
      actor_id: 'a-1',
      timestamp: new Date(),
      metadata: { a: 1 },
    })
    expect(persisted).toBe(true)

    initEventPersistence()
    initEventPersistence()
    expect(isEventPersistenceInitialized()).toBe(true)
    expect(mockOnFlowEvent).toHaveBeenCalledTimes(1)
  })

  it('telemetry counters increment and expose totals', async () => {
    const {
      recordWorkflowTransitionError,
      recordEventEmissionGap,
      getWorkflowTransitionErrorCount,
      getEventEmissionGapCount,
    } = await import('@/lib/telemetry/counters')

    const startWorkflow = getWorkflowTransitionErrorCount()
    const startEventGap = getEventEmissionGapCount()

    recordWorkflowTransitionError()
    recordEventEmissionGap()
    recordEventEmissionGap()

    expect(getWorkflowTransitionErrorCount()).toBe(startWorkflow + 1)
    expect(getEventEmissionGapCount()).toBe(startEventGap + 2)
  })
})
