/**
 * @nzila/commerce-services — Saga Integration Tests
 *
 * Tests for the quote-to-order and order-to-invoice saga definitions.
 * Uses mocked ports and the real InMemoryEventBus + SagaOrchestrator.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  InMemoryEventBus,
  createDomainEvent,
  createSagaOrchestrator,
  CommerceEventTypes,
} from '@nzila/commerce-events'
import type { SagaContext } from '@nzila/commerce-events'
import { QuoteStatus, OrderStatus, InvoiceStatus, PricingTier } from '@nzila/commerce-core/enums'
import {
  createQuoteToOrderSaga,
  type QuoteToOrderPorts,
  type QuoteToOrderData,
} from './quote-to-order'
import {
  createOrderToInvoiceSaga,
  type OrderToInvoicePorts,
  type OrderToInvoiceData,
} from './order-to-invoice'
import type { QuoteEntity, QuoteLineEntity } from '../quote-service'
import type { OrderEntity, OrderLineEntity } from '../order-service'
import type { InvoiceEntity } from '../invoice-service'

// ── Mock Factories ──────────────────────────────────────────────────────────

function mockQuote(overrides?: Partial<QuoteEntity>): QuoteEntity {
  return {
    id: 'q-1',
    orgId: 'org-1',
    ref: 'QUO-001',
    customerId: 'cust-1',
    opportunityId: null,
    status: QuoteStatus.ACCEPTED,
    pricingTier: PricingTier.STANDARD,
    currentVersion: 1,
    currency: 'CAD',
    subtotal: '100.00',
    taxTotal: '14.97',
    total: '114.97',
    validUntil: null,
    notes: null,
    createdBy: 'actor-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function mockQuoteLines(): QuoteLineEntity[] {
  return [
    {
      id: 'ql-1',
      quoteId: 'q-1',
      description: 'Gift Box A',
      sku: 'SKU-A',
      quantity: 2,
      unitPrice: '25.00',
      discount: '0',
      lineTotal: '50.00',
      sortOrder: 0,
    },
    {
      id: 'ql-2',
      quoteId: 'q-1',
      description: 'Gift Box B',
      sku: 'SKU-B',
      quantity: 1,
      unitPrice: '50.00',
      discount: '0',
      lineTotal: '50.00',
      sortOrder: 1,
    },
  ]
}

function mockOrder(overrides?: Partial<OrderEntity>): OrderEntity {
  return {
    id: 'ord-1',
    orgId: 'org-1',
    ref: 'ORD-001',
    customerId: 'cust-1',
    quoteId: 'q-1',
    quoteVersionId: '1',
    status: OrderStatus.CONFIRMED,
    subtotal: '100.00',
    discountTotal: '0',
    taxTotal: '14.97',
    grandTotal: '114.97',
    lockedSnapshot: '{}',
    createdBy: 'actor-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function mockOrderLines(): OrderLineEntity[] {
  return [
    {
      id: 'ol-1',
      orderId: 'ord-1',
      itemName: 'Gift Box A',
      itemSku: 'SKU-A',
      quantity: 2,
      unitPrice: '25.00',
      lineTotal: '50.00',
      sortOrder: 0,
    },
    {
      id: 'ol-2',
      orderId: 'ord-1',
      itemName: 'Gift Box B',
      itemSku: 'SKU-B',
      quantity: 1,
      unitPrice: '50.00',
      lineTotal: '50.00',
      sortOrder: 1,
    },
  ]
}

function mockInvoice(overrides?: Partial<InvoiceEntity>): InvoiceEntity {
  return {
    id: 'inv-1',
    orgId: 'org-1',
    ref: 'INV-001',
    orderId: 'ord-1',
    customerId: 'cust-1',
    status: InvoiceStatus.DRAFT,
    subtotal: '100.00',
    taxTotal: '14.97',
    grandTotal: '114.97',
    amountPaid: '0',
    amountDue: '114.97',
    dueDate: null,
    issuedAt: null,
    paidAt: null,
    createdBy: 'actor-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUOTE-TO-ORDER SAGA
// ═══════════════════════════════════════════════════════════════════════════

describe('quote-to-order saga', () => {
  let ports: QuoteToOrderPorts
  let bus: InMemoryEventBus

  beforeEach(() => {
    bus = new InMemoryEventBus()
    ports = {
      getQuoteById: vi.fn().mockResolvedValue(mockQuote()),
      getQuoteLines: vi.fn().mockResolvedValue(mockQuoteLines()),
      createOrder: vi.fn().mockResolvedValue({
        ok: true as const,
        data: mockOrder({ id: 'new-ord-1', status: OrderStatus.CREATED }),
        auditEntries: [],
      }),
    }
  })

  // ── Definition ────────────────────────────────────────────────────────

  it('has correct name and triggerEvent', () => {
    const saga = createQuoteToOrderSaga(ports)
    expect(saga.name).toBe('quote-to-order')
    expect(saga.triggerEvent).toBe(CommerceEventTypes.QUOTE_ACCEPTED)
  })

  it('has 2 steps: lock-quote-snapshot and create-order', () => {
    const saga = createQuoteToOrderSaga(ports)
    expect(saga.steps).toHaveLength(2)
    expect(saga.steps[0]!.name).toBe('lock-quote-snapshot')
    expect(saga.steps[1]!.name).toBe('create-order')
  })

  // ── Happy Path ────────────────────────────────────────────────────────

  it('happy path — locks quote and creates order (completed)', async () => {
    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-1',
      correlationId: 'corr-1',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'q-1' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('completed')
    expect(execution.stepsCompleted).toEqual(['lock-quote-snapshot', 'create-order'])
  })

  it('shares quote data between steps via context', async () => {
    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-1',
      correlationId: 'corr-1',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'q-1' },
    }

    await orchestrator.execute(saga, ctx)

    // Step 1 stored the quote and lines in context.data
    expect(ctx.data.quote).toBeDefined()
    expect(ctx.data.quote!.id).toBe('q-1')
    expect(ctx.data.quoteLines).toHaveLength(2)
    // Step 2 stored the created order
    expect(ctx.data.order).toBeDefined()
    expect(ctx.data.order!.id).toBe('new-ord-1')
  })

  it('passes correct order input derived from quote data', async () => {
    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-1',
      correlationId: 'corr-1',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'q-1' },
    }

    await orchestrator.execute(saga, ctx)

    expect(ports.createOrder).toHaveBeenCalledTimes(1)
    const callArgs = (ports.createOrder as ReturnType<typeof vi.fn>).mock.calls[0]!
    const input = callArgs[1] as Record<string, unknown>
    expect(input.customerId).toBe('cust-1')
    expect(input.quoteId).toBe('q-1')
    expect(input.subtotal).toBe(100)
    expect(input.taxTotal).toBe(14.97)
    expect(input.grandTotal).toBe(114.97)
    expect((input.lines as unknown[]).length).toBe(2)
  })

  // ── Failure Scenarios ─────────────────────────────────────────────────

  it('fails when quote not found', async () => {
    ;(ports.getQuoteById as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-1',
      correlationId: 'corr-1',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'nonexistent' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('compensated')
    expect(execution.error).toContain('not found')
    expect(execution.stepsCompleted).toEqual([])
  })

  it('fails when quote is not in accepted status', async () => {
    ;(ports.getQuoteById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQuote({ status: QuoteStatus.DRAFT }),
    )

    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-1',
      correlationId: 'corr-1',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'q-1' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('compensated')
    expect(execution.error).toContain('not accepted')
  })

  it('compensates lock-quote-snapshot when order creation fails', async () => {
    ;(ports.createOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'DB connection failed',
      code: 'DB_ERROR',
    })

    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-1',
      correlationId: 'corr-1',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'q-1' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('compensated')
    expect(execution.stepsCompleted).toEqual(['lock-quote-snapshot'])
    expect(execution.stepsCompensated).toEqual(['lock-quote-snapshot'])
    expect(execution.error).toContain('create-order')
  })

  it('OrgContext carries orgId from saga context (org isolation)', async () => {
    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-1',
      correlationId: 'corr-1',
      orgId: 'org-42',
      actorId: 'actor-7',
      data: { quoteId: 'q-1' },
    }

    await orchestrator.execute(saga, ctx)

    const getQuoteCall = (ports.getQuoteById as ReturnType<typeof vi.fn>).mock.calls[0]!
    const orgCtx = getQuoteCall[0] as Record<string, unknown>
    expect(orgCtx.orgId).toBe('org-42')
    expect(orgCtx.actorId).toBe('actor-7')
    expect(orgCtx.requestId).toBe('corr-1')
  })

  it('create-order compensate flags order when one was created', async () => {
    const saga = createQuoteToOrderSaga(ports)
    const createOrderStep = saga.steps[1]!

    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-q-comp',
      correlationId: 'corr-q-comp',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'q-1', order: mockOrder({ id: 'ord-comp-1' }) },
    }

    const result = await createOrderStep.compensate(ctx)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ orderId: 'ord-comp-1', action: 'flagged_for_review' })
  })

  it('create-order compensate is no-op when order was not created', async () => {
    const saga = createQuoteToOrderSaga(ports)
    const createOrderStep = saga.steps[1]!

    const ctx: SagaContext<QuoteToOrderData> = {
      sagaId: 'saga-q-comp-2',
      correlationId: 'corr-q-comp-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { quoteId: 'q-1' },
    }

    const result = await createOrderStep.compensate(ctx)
    expect(result.ok).toBe(true)
    expect(result.data).toBeNull()
  })

  // ── Event-Driven Trigger ──────────────────────────────────────────────

  it('auto-triggers via quote.accepted event on the bus', async () => {
    const saga = createQuoteToOrderSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    orchestrator.register(saga)

    const event = createDomainEvent(
      CommerceEventTypes.QUOTE_ACCEPTED,
      { quoteId: 'q-1' },
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-event-1' },
    )

    await bus.emitAndWait(event)

    const executions = orchestrator.executions()
    expect(executions).toHaveLength(1)
    expect(executions[0]!.status).toBe('completed')
    expect(executions[0]!.sagaName).toBe('quote-to-order')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ORDER-TO-INVOICE SAGA
// ═══════════════════════════════════════════════════════════════════════════

describe('order-to-invoice saga', () => {
  let ports: OrderToInvoicePorts
  let bus: InMemoryEventBus

  beforeEach(() => {
    bus = new InMemoryEventBus()
    ports = {
      getOrderById: vi.fn().mockResolvedValue(mockOrder()),
      getOrderLines: vi.fn().mockResolvedValue(mockOrderLines()),
      createInvoice: vi.fn().mockResolvedValue({
        ok: true as const,
        data: mockInvoice(),
        auditEntries: [],
      }),
      cancelInvoice: vi.fn(),
    }
  })

  // ── Definition ────────────────────────────────────────────────────────

  it('has correct name and triggerEvent', () => {
    const saga = createOrderToInvoiceSaga(ports)
    expect(saga.name).toBe('order-to-invoice')
    expect(saga.triggerEvent).toBe(CommerceEventTypes.ORDER_CONFIRMED)
  })

  it('has 2 steps: fetch-order and create-invoice', () => {
    const saga = createOrderToInvoiceSaga(ports)
    expect(saga.steps).toHaveLength(2)
    expect(saga.steps[0]!.name).toBe('fetch-order')
    expect(saga.steps[1]!.name).toBe('create-invoice')
  })

  // ── Happy Path ────────────────────────────────────────────────────────

  it('happy path — fetches order and creates invoice (completed)', async () => {
    const saga = createOrderToInvoiceSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-2',
      correlationId: 'corr-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'ord-1' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('completed')
    expect(execution.stepsCompleted).toEqual(['fetch-order', 'create-invoice'])
  })

  it('passes correct invoice input derived from order data', async () => {
    const saga = createOrderToInvoiceSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-2',
      correlationId: 'corr-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'ord-1' },
    }

    await orchestrator.execute(saga, ctx)

    expect(ports.createInvoice).toHaveBeenCalledTimes(1)
    const callArgs = (ports.createInvoice as ReturnType<typeof vi.fn>).mock.calls[0]!
    const input = callArgs[1] as Record<string, unknown>
    expect(input.orderId).toBe('ord-1')
    expect(input.customerId).toBe('cust-1')
    expect(input.subtotal).toBe(100)
    expect(input.taxTotal).toBe(14.97)
    expect(input.grandTotal).toBe(114.97)
    expect(input.dueDays).toBe(30)
    expect((input.lines as unknown[]).length).toBe(2)
  })

  it('shares order data between steps via context', async () => {
    const saga = createOrderToInvoiceSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-2',
      correlationId: 'corr-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'ord-1' },
    }

    await orchestrator.execute(saga, ctx)

    expect(ctx.data.order).toBeDefined()
    expect(ctx.data.order!.id).toBe('ord-1')
    expect(ctx.data.orderLines).toHaveLength(2)
    expect(ctx.data.invoice).toBeDefined()
    expect(ctx.data.invoice!.id).toBe('inv-1')
  })

  // ── Failure Scenarios ─────────────────────────────────────────────────

  it('fails when order not found', async () => {
    ;(ports.getOrderById as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const saga = createOrderToInvoiceSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-2',
      correlationId: 'corr-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'nonexistent' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('compensated')
    expect(execution.error).toContain('not found')
    expect(execution.stepsCompleted).toEqual([])
  })

  it('fails when order is not in confirmed status', async () => {
    ;(ports.getOrderById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrder({ status: OrderStatus.CREATED }),
    )

    const saga = createOrderToInvoiceSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-2',
      correlationId: 'corr-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'ord-1' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('compensated')
    expect(execution.error).toContain('not confirmed')
  })

  it('compensates fetch-order when invoice creation fails', async () => {
    ;(ports.createInvoice as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'DB error',
      code: 'DB_ERROR',
    })

    const saga = createOrderToInvoiceSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-2',
      correlationId: 'corr-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'ord-1' },
    }

    const execution = await orchestrator.execute(saga, ctx)

    expect(execution.status).toBe('compensated')
    expect(execution.stepsCompleted).toEqual(['fetch-order'])
    expect(execution.stepsCompensated).toEqual(['fetch-order'])
    expect(execution.error).toContain('create-invoice')
  })

  // ── Compensation ──────────────────────────────────────────────────────

  it('create-invoice compensate calls cancelInvoice when invoice was created', async () => {
    const saga = createOrderToInvoiceSaga(ports)
    const invoiceStep = saga.steps[1]!
    const invoice = mockInvoice()

    // Simulate context after step 2 succeeded
    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-comp',
      correlationId: 'corr-comp',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'ord-1', invoice },
    }

    const result = await invoiceStep.compensate(ctx)

    expect(result.ok).toBe(true)
    expect(ports.cancelInvoice).toHaveBeenCalledTimes(1)
    const cancelCall = (ports.cancelInvoice as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(cancelCall[1]).toBe(invoice)
    expect(cancelCall[2]).toContain('Saga compensation')
  })

  it('create-invoice compensate is no-op when no invoice was created', async () => {
    const saga = createOrderToInvoiceSaga(ports)
    const invoiceStep = saga.steps[1]!

    const ctx: SagaContext<OrderToInvoiceData> = {
      sagaId: 'saga-comp-2',
      correlationId: 'corr-comp-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      data: { orderId: 'ord-1' },
    }

    const result = await invoiceStep.compensate(ctx)

    expect(result.ok).toBe(true)
    expect(ports.cancelInvoice).not.toHaveBeenCalled()
  })

  // ── Event-Driven Trigger ──────────────────────────────────────────────

  it('auto-triggers via order.confirmed event on the bus', async () => {
    const saga = createOrderToInvoiceSaga(ports)
    const orchestrator = createSagaOrchestrator(bus)
    orchestrator.register(saga)

    const event = createDomainEvent(
      CommerceEventTypes.ORDER_CONFIRMED,
      { orderId: 'ord-1' },
      { orgId: 'org-1', actorId: 'actor-1', correlationId: 'corr-event-2' },
    )

    await bus.emitAndWait(event)

    const executions = orchestrator.executions()
    expect(executions).toHaveLength(1)
    expect(executions[0]!.status).toBe('completed')
    expect(executions[0]!.sagaName).toBe('order-to-invoice')
  })
})
