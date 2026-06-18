import { describe, expect, it, vi } from 'vitest'

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

describe('events emitter slice', () => {
  it('emits events, handles listener errors, and supports unsubscribe', async () => {
    const {
      onFlowEvent,
      emitFlowEvent,
      emitQuoteEvent,
      emitOrderEvent,
      emitPaymentEvent,
      emitPOEvent,
      emitProductionEvent,
    } = await import('@/lib/events/emitter')

    const received: string[] = []
    const off1 = onFlowEvent((evt) => {
      received.push(evt.type)
    })
    onFlowEvent(() => {
      throw new Error('sync fail')
    })
    onFlowEvent(async () => {
      throw new Error('async fail')
    })

    const evt = emitFlowEvent({
      type: 'quote_created',
      actor_id: 'u-1',
      org_id: 'org-1',
      entity_type: 'quote',
      entity_id: '11111111-1111-4111-8111-111111111111',
      metadata: {},
    })
    expect(evt.type).toBe('quote_created')
    expect(received).toContain('quote_created')

    off1()
    emitQuoteEvent('quote_sent', 'u-1', 'org-1', '22222222-2222-4222-8222-222222222222')
    emitOrderEvent('order_created', 'u-1', 'org-1', '33333333-3333-4333-8333-333333333333')
    emitPaymentEvent('payment_received', 'u-1', 'org-1', '44444444-4444-4444-8444-444444444444')
    emitPOEvent('po_created', 'u-1', 'org-1', '55555555-5555-4555-8555-555555555555')
    emitProductionEvent('production_started', 'u-1', 'org-1', '66666666-6666-4666-8666-666666666666')

    expect(mockLogger.info).toHaveBeenCalled()
  })
})
