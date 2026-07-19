import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockQuoteRepo,
  mockOrderRepo,
  mockPaymentRepo,
  mockPaymentRequirementRepo,
  mockRevisionRepo,
  mockInvoiceRepo,
  mockPurchaseOrderRepo,
  mockVendorRepo,
  mockCheckEntityExists,
  mockCheckQuoteInvariants,
  mockCheckOrderInvariants,
  mockCheckPurchaseOrderInvariants,
  mockValidateTransition,
  mockQuoteCanBeSent,
  mockOrderCanBeConfirmed,
  mockPoCanBeSent,
  mockCheckCanGeneratePO,
  mockCanConvertQuoteToOrder,
  mockInvoiceCanBeIssued,
  mockInvoiceCanBeVoided,
  mockCheckShipmentReadiness,
  mockCreateShipment,
  mockDispatchDomainEvent,
  mockDispatchAuditEntry,
  mockDispatchSideEffect,
} = vi.hoisted(() => ({
  mockQuoteRepo: {
    create: vi.fn(),
    insertLines: vi.fn(),
    findById: vi.fn(),
    findLines: vi.fn(),
    update: vi.fn(),
  },
  mockOrderRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  },
  mockPaymentRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    totalPaidForOrder: vi.fn(),
  },
  mockPaymentRequirementRepo: {
    save: vi.fn(),
  },
  mockRevisionRepo: {
    save: vi.fn(),
  },
  mockInvoiceRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  },
  mockPurchaseOrderRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findLines: vi.fn(),
    update: vi.fn(),
  },
  mockVendorRepo: {
    findById: vi.fn(),
  },
  mockCheckEntityExists: vi.fn(),
  mockCheckQuoteInvariants: vi.fn(),
  mockCheckOrderInvariants: vi.fn(),
  mockCheckPurchaseOrderInvariants: vi.fn(),
  mockValidateTransition: vi.fn(),
  mockQuoteCanBeSent: vi.fn(),
  mockOrderCanBeConfirmed: vi.fn(),
  mockPoCanBeSent: vi.fn(),
  mockCheckCanGeneratePO: vi.fn(),
  mockCanConvertQuoteToOrder: vi.fn(),
  mockInvoiceCanBeIssued: vi.fn(),
  mockInvoiceCanBeVoided: vi.fn(),
  mockCheckShipmentReadiness: vi.fn(),
  mockCreateShipment: vi.fn(),
  mockDispatchDomainEvent: vi.fn(),
  mockDispatchAuditEntry: vi.fn(),
  mockDispatchSideEffect: vi.fn(),
}))

vi.mock('@/lib/repositories', () => ({
  quoteRepo: mockQuoteRepo,
  orderRepo: mockOrderRepo,
  paymentRepo: mockPaymentRepo,
  invoiceRepo: mockInvoiceRepo,
  purchaseOrderRepo: mockPurchaseOrderRepo,
  vendorRepo: mockVendorRepo,
}))

vi.mock('@/lib/repositories/workflow-repository', () => ({
  paymentRequirementRepo: mockPaymentRequirementRepo,
  revisionRepo: mockRevisionRepo,
}))

vi.mock('@/lib/control/guards/invariant-guard', () => ({
  checkEntityExists: mockCheckEntityExists,
  checkQuoteInvariants: mockCheckQuoteInvariants,
  checkOrderInvariants: mockCheckOrderInvariants,
  checkPurchaseOrderInvariants: mockCheckPurchaseOrderInvariants,
}))

vi.mock('@/lib/control/guards/workflow-guard', () => ({
  validateTransition: mockValidateTransition,
}))

vi.mock('@/domain/invariants', () => ({
  quoteCanBeSent: mockQuoteCanBeSent,
  orderCanBeConfirmed: mockOrderCanBeConfirmed,
  invoiceCanBeIssued: mockInvoiceCanBeIssued,
  invoiceCanBeVoided: mockInvoiceCanBeVoided,
  poCanBeSent: mockPoCanBeSent,
}))

vi.mock('@/domain/conversion-rules', () => ({
  canConvertQuoteToOrder: mockCanConvertQuoteToOrder,
}))

vi.mock('@/lib/control/guards/shipment-guard', () => ({
  checkShipmentReadiness: mockCheckShipmentReadiness,
}))

vi.mock('@/lib/control/guards/payment-guard', () => ({
  checkCanGeneratePO: mockCheckCanGeneratePO,
}))

vi.mock('@/lib/services/shipment-service', () => ({
  createShipment: mockCreateShipment,
}))

vi.mock('@/lib/control/dispatch/event-dispatcher', () => ({
  dispatchDomainEvent: mockDispatchDomainEvent,
}))

vi.mock('@/lib/control/dispatch/audit-dispatcher', () => ({
  dispatchAuditEntry: mockDispatchAuditEntry,
}))

vi.mock('@/lib/control/dispatch/side-effect-dispatcher', () => ({
  dispatchSideEffect: mockDispatchSideEffect,
}))

import { createQuoteHandler } from '@/lib/control/handlers/create-quote.handler'
import { sendQuoteHandler } from '@/lib/control/handlers/send-quote.handler'
import { acceptQuoteHandler } from '@/lib/control/handlers/accept-quote.handler'
import { convertQuoteToOrderHandler } from '@/lib/control/handlers/convert-quote-to-order.handler'
import { confirmOrderHandler } from '@/lib/control/handlers/confirm-order.handler'
import { requireDepositHandler } from '@/lib/control/handlers/require-deposit.handler'
import { recordPaymentHandler } from '@/lib/control/handlers/record-payment.handler'
import { createShipmentHandler } from '@/lib/control/handlers/create-shipment.handler'
import { requestQuoteRevisionHandler } from '@/lib/control/handlers/request-quote-revision.handler'
import { submitForReviewHandler } from '@/lib/control/handlers/submit-for-review.handler'
import { confirmPaymentHandler } from '@/lib/control/handlers/confirm-payment.handler'
import { createInvoiceHandler } from '@/lib/control/handlers/create-invoice.handler'
import { issueInvoiceHandler } from '@/lib/control/handlers/issue-invoice.handler'
import { voidInvoiceHandler } from '@/lib/control/handlers/void-invoice.handler'
import { startFulfillmentHandler } from '@/lib/control/handlers/start-fulfillment.handler'
import { completeOrderHandler } from '@/lib/control/handlers/complete-order.handler'
import { cancelOrderHandler } from '@/lib/control/handlers/cancel-order.handler'
import { markOrderDeliveredHandler } from '@/lib/control/handlers/mark-order-delivered.handler'
import { createPurchaseOrderHandler } from '@/lib/control/handlers/create-purchase-order.handler'
import { sendPurchaseOrderHandler } from '@/lib/control/handlers/send-purchase-order.handler'
import { confirmPurchaseOrderHandler } from '@/lib/control/handlers/confirm-purchase-order.handler'

const ctx = { org_id: 'org-1', actor_id: 'actor-1', correlation_id: 'corr-1' }

describe('Flow control handlers - quote slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockCheckEntityExists.mockResolvedValue({ valid: true, violations: [] })
    mockCheckQuoteInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockCheckOrderInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockCheckPurchaseOrderInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockValidateTransition.mockReturnValue({ allowed: true })
    mockQuoteCanBeSent.mockReturnValue({ valid: true, violations: [] })
    mockOrderCanBeConfirmed.mockReturnValue({ valid: true, violations: [] })
    mockPoCanBeSent.mockReturnValue({ valid: true, violations: [] })
    mockCheckCanGeneratePO.mockResolvedValue({ allowed: true, reasons: [] })
    mockCanConvertQuoteToOrder.mockReturnValue({ valid: true, violations: [] })
    mockInvoiceCanBeIssued.mockReturnValue({ valid: true, violations: [] })
    mockInvoiceCanBeVoided.mockReturnValue({ valid: true, violations: [] })
    mockCheckShipmentReadiness.mockResolvedValue({ allowed: true, blockers: [] })
    mockCreateShipment.mockResolvedValue({ shipmentId: '22222222-2222-4222-8222-222222222222' })
    mockDispatchDomainEvent.mockReturnValue('evt-1')
    mockDispatchAuditEntry.mockResolvedValue('audit-1')
    mockDispatchSideEffect.mockResolvedValue(undefined)
  })

  it('covers issue-invoice remaining not-found and default status/amount branches', async () => {
    mockInvoiceRepo.findById.mockResolvedValueOnce(null)
    await expect(
      issueInvoiceHandler.execute(
        {
          type: 'issue_invoice',
          org_id: 'org-1',
          actor_id: 'actor-1',
          invoice_id: '55555555-5555-4555-8555-555555555555',
        },
        ctx,
      ),
    ).rejects.toThrow('invoice')

    mockInvoiceRepo.findById.mockResolvedValueOnce({ id: 'inv-5', status: null, total: null })
    const defaultCoercion = await issueInvoiceHandler.execute(
      {
        type: 'issue_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        invoice_id: '55555555-5555-4555-8555-555555555555',
      },
      ctx,
    )

    expect(defaultCoercion.success).toBe(true)
    expect(defaultCoercion.status_after).toBe('SENT')
    expect(mockInvoiceCanBeIssued).toHaveBeenCalledWith({ status: 'DRAFT', amount: 0 })
    expect(mockDispatchAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        status_before: 'DRAFT',
      }),
    )
  })

  it('createQuoteHandler creates quote + lines and returns success payload', async () => {
    const result = await createQuoteHandler.execute(
      {
        type: 'create_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        customer_id: '11111111-1111-4111-8111-111111111111',
        title: 'Test Quote',
        currency: 'CAD',
        lines: [{ description: 'Line A', quantity: 2, unit_price: 100 }],
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.entity_type).toBe('quote')
    expect(result.emitted_event_ids).toEqual(['evt-1'])
    expect(result.audit_ref).toBe('audit-1')
    expect(mockQuoteRepo.create).toHaveBeenCalledTimes(1)
    expect(mockQuoteRepo.insertLines).toHaveBeenCalledTimes(1)
  })

  it('createQuoteHandler returns invariant violation when customer is missing', async () => {
    mockCheckEntityExists.mockResolvedValue({ valid: false, violations: ['customer missing'] })

    const result = await createQuoteHandler.execute(
      {
        type: 'create_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        customer_id: '11111111-1111-4111-8111-111111111111',
        title: 'Bad Quote',
        currency: 'CAD',
        lines: [{ description: 'Line A', quantity: 1, unit_price: 50 }],
      },
      ctx,
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')
    expect(mockQuoteRepo.create).not.toHaveBeenCalled()
  })

  it('sendQuoteHandler succeeds through invariant + workflow + side effects', async () => {
    mockQuoteRepo.findById.mockResolvedValue({
      id: 'q-1',
      status: 'draft',
      customerId: 'c-1',
      validUntil: null,
      total: '200',
    })
    mockQuoteRepo.findLines.mockResolvedValue([{ id: 'l-1' }])

    const result = await sendQuoteHandler.execute(
      {
        type: 'send_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.status_after).toBe('SENT_TO_CLIENT')
    expect(mockQuoteRepo.update).toHaveBeenCalledTimes(1)
    expect(mockDispatchSideEffect).toHaveBeenCalledTimes(1)
  })

  it('sendQuoteHandler returns invalid transition when workflow blocks move', async () => {
    mockQuoteRepo.findById.mockResolvedValue({
      id: 'q-1',
      status: 'accepted',
      customerId: 'c-1',
      validUntil: null,
      total: '200',
    })
    mockQuoteRepo.findLines.mockResolvedValue([{ id: 'l-1' }])
    mockValidateTransition.mockReturnValue({ allowed: false, reason: 'bad transition' })

    const result = await sendQuoteHandler.execute(
      {
        type: 'send_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('INVALID_TRANSITION')
    expect(mockQuoteRepo.update).not.toHaveBeenCalled()
  })

  it('acceptQuoteHandler succeeds and emits audit/event', async () => {
    mockQuoteRepo.findById.mockResolvedValue({ id: 'q-1', status: 'sent' })

    const result = await acceptQuoteHandler.execute(
      {
        type: 'accept_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
        customer_name: 'Customer',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.status_after).toBe('ACCEPTED')
    expect(mockQuoteRepo.update).toHaveBeenCalledTimes(1)
    expect(mockDispatchDomainEvent).toHaveBeenCalledTimes(1)
  })

  it('convertQuoteToOrderHandler creates order when conversion rules pass', async () => {
    mockQuoteRepo.findById.mockResolvedValue({
      id: 'q-1',
      status: 'accepted',
      customerId: 'c-1',
      total: '1000',
      subtotal: '900',
      taxTotal: '100',
    })
    mockQuoteRepo.findLines.mockResolvedValue([{ id: 'l-1' }, { id: 'l-2' }])

    const result = await convertQuoteToOrderHandler.execute(
      {
        type: 'convert_quote_to_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.entity_type).toBe('order')
    expect(result.status_after).toBe('CREATED')
    expect(mockOrderRepo.create).toHaveBeenCalledTimes(1)
    expect(mockDispatchDomainEvent).toHaveBeenCalledTimes(1)
  })

  it('convertQuoteToOrderHandler returns conversion blocked error', async () => {
    mockQuoteRepo.findById.mockResolvedValue({
      id: 'q-1',
      status: 'draft',
      customerId: 'c-1',
      total: '1000',
      subtotal: '900',
      taxTotal: '100',
    })
    mockQuoteRepo.findLines.mockResolvedValue([{ id: 'l-1' }])
    mockCanConvertQuoteToOrder.mockReturnValue({ valid: false, violations: ['not accepted'] })

    const result = await convertQuoteToOrderHandler.execute(
      {
        type: 'convert_quote_to_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('CONVERSION_BLOCKED')
    expect(mockOrderRepo.create).not.toHaveBeenCalled()
  })

  it('convertQuoteToOrderHandler covers invariant short-circuit and default order field coercions', async () => {
    mockCheckQuoteInvariants.mockResolvedValueOnce({ valid: false, violations: ['quote invariant failed'] })
    const invariantBlocked = await convertQuoteToOrderHandler.execute(
      {
        type: 'convert_quote_to_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )
    expect(invariantBlocked.success).toBe(false)
    expect(invariantBlocked.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockQuoteRepo.findById.mockResolvedValueOnce({
      id: 'q-1',
      status: null,
      customerId: 'c-1',
      total: null,
      subtotal: undefined,
      taxTotal: undefined,
    })
    mockQuoteRepo.findLines.mockResolvedValueOnce([{ id: 'l-1' }])

    const coerced = await convertQuoteToOrderHandler.execute(
      {
        type: 'convert_quote_to_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )

    expect(coerced.success).toBe(true)
    expect(mockCanConvertQuoteToOrder).toHaveBeenCalledWith(
      { status: undefined, customer_id: 'c-1', total_amount: 0 },
      1,
    )
    expect(mockOrderRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        subtotal: '0',
        taxTotal: '0',
        total: '0',
      }),
    )
  })

  it('confirmOrderHandler validates and transitions to CONFIRMED', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      id: 'o-1',
      status: 'created',
      customerId: 'c-1',
      total: '350',
    })

    const result = await confirmOrderHandler.execute(
      {
        type: 'confirm_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.status_after).toBe('CONFIRMED')
    expect(mockOrderRepo.update).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'org-1',
      { status: 'confirmed' },
    )
  })

  it('requireDepositHandler stores payment requirement when quote exists', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      id: 'o-1',
      status: 'confirmed',
      quoteId: 'q-1',
    })

    const result = await requireDepositHandler.execute(
      {
        type: 'require_deposit',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        deposit_required: true,
        deposit_percent: 40,
        due_before_production: true,
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.status_after).toBe('DEPOSIT_REQUIRED')
    expect(mockPaymentRequirementRepo.save).toHaveBeenCalledTimes(1)
  })

  it('recordPaymentHandler updates order payment status based on totals', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      id: 'o-1',
      status: 'confirmed',
      total: '500',
    })
    mockPaymentRepo.totalPaidForOrder.mockResolvedValue(250)

    const result = await recordPaymentHandler.execute(
      {
        type: 'record_payment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        amount: 250,
        currency: 'CAD',
        method: 'BANK_TRANSFER',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.entity_type).toBe('payment')
    expect(result.status_after).toBe('PARTIALLY_PAID')
    expect(mockPaymentRepo.create).toHaveBeenCalledTimes(1)
    expect(mockOrderRepo.update).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'org-1',
      { paymentStatus: 'PARTIALLY_PAID', status: 'fulfillment' },
    )
  })

  it('createShipmentHandler returns SHIPMENT_BLOCKED when guard fails', async () => {
    mockCheckShipmentReadiness.mockResolvedValue({
      allowed: false,
      blockers: ['production not complete'],
    })

    const result = await createShipmentHandler.execute(
      {
        type: 'create_shipment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('SHIPMENT_BLOCKED')
  })

  it('createShipmentHandler creates shipment and emits event/audit', async () => {
    const result = await createShipmentHandler.execute(
      {
        type: 'create_shipment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.entity_type).toBe('shipment')
    expect(result.status_after).toBe('PENDING')
    expect(mockCreateShipment).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'org-1',
      {},
    )
  })

  it('requestQuoteRevisionHandler records revision and transitions quote', async () => {
    mockQuoteRepo.findById.mockResolvedValue({ id: 'q-1', status: 'sent' })

    const result = await requestQuoteRevisionHandler.execute(
      {
        type: 'request_quote_revision',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
        request_message: 'Please adjust quantities',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.status_after).toBe('REVISION_REQUESTED')
    expect(mockRevisionRepo.save).toHaveBeenCalledTimes(1)
  })

  it('submitForReviewHandler moves draft quote into internal review', async () => {
    mockQuoteRepo.findById.mockResolvedValue({ id: 'q-1', status: 'draft' })

    const result = await submitForReviewHandler.execute(
      {
        type: 'submit_for_review',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.status_after).toBe('INTERNAL_REVIEW')
    expect(mockQuoteRepo.update).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'org-1',
      { status: 'reviewing' },
    )
  })

  it('confirmPaymentHandler emits payment + ready events when fully paid', async () => {
    mockPaymentRepo.findById.mockResolvedValue({ id: 'p-1', status: 'pending' })
    mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', total: '100' })
    mockPaymentRepo.totalPaidForOrder.mockResolvedValue(100)

    const result = await confirmPaymentHandler.execute(
      {
        type: 'confirm_payment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        payment_id: '44444444-4444-4444-8444-444444444444',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.status_after).toBe('PAID')
    expect(result.emitted_event_ids?.length).toBe(2)
  })

  it('createInvoiceHandler creates draft invoice for valid order', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      id: 'o-1',
      status: 'confirmed',
      total: '500',
      customerId: 'c-1',
      currency: 'CAD',
    })

    const result = await createInvoiceHandler.execute(
      {
        type: 'create_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        due_date: new Date('2026-12-01'),
      },
      ctx,
    )

    expect(result.success).toBe(true)
    expect(result.entity_type).toBe('invoice')
    expect(result.status_after).toBe('DRAFT')
    expect(mockInvoiceRepo.create).toHaveBeenCalledTimes(1)
  })

  it('issueInvoiceHandler and voidInvoiceHandler enforce domain predicates', async () => {
    mockInvoiceRepo.findById.mockResolvedValue({ id: 'inv-1', status: 'draft', total: '250' })

    const issued = await issueInvoiceHandler.execute(
      {
        type: 'issue_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        invoice_id: '55555555-5555-4555-8555-555555555555',
      },
      ctx,
    )

    expect(issued.success).toBe(true)
    expect(issued.status_after).toBe('SENT')

    mockInvoiceRepo.findById.mockResolvedValue({ id: 'inv-2', status: 'sent', total: '250' })
    const voided = await voidInvoiceHandler.execute(
      {
        type: 'void_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        invoice_id: '66666666-6666-4666-8666-666666666666',
      },
      ctx,
    )

    expect(voided.success).toBe(true)
    expect(voided.status_after).toBe('VOID')
  })

  it('start/complete/cancel order handlers transition with audit and events', async () => {
    mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', status: 'confirmed' })

    const started = await startFulfillmentHandler.execute(
      {
        type: 'start_fulfillment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(started.success).toBe(true)
    expect(started.status_after).toBe('FULFILLMENT')

    mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', status: 'fulfillment' })
    const completed = await completeOrderHandler.execute(
      {
        type: 'complete_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(completed.success).toBe(true)
    expect(completed.status_after).toBe('COMPLETED')

    mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', status: 'confirmed' })
    const cancelled = await cancelOrderHandler.execute(
      {
        type: 'cancel_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        reason: 'customer request',
      },
      ctx,
    )
    expect(cancelled.success).toBe(true)
    expect(cancelled.status_after).toBe('CANCELLED')
  })

  it('purchase-order handlers cover blocked and happy paths', async () => {
    mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', total: '500', status: 'confirmed' })
    mockVendorRepo.findById.mockResolvedValue({ id: 'v-1' })

    const created = await createPurchaseOrderHandler.execute(
      {
        type: 'create_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        vendor_id: '77777777-7777-4777-8777-777777777777',
      },
      ctx,
    )

    expect(created.success).toBe(true)
    expect(created.entity_type).toBe('purchase_order')

    mockPurchaseOrderRepo.findById.mockResolvedValue({
      id: 'po-1',
      supplierId: 'v-1',
      status: 'draft',
      total: '500',
    })
    mockPurchaseOrderRepo.findLines.mockResolvedValue([{ id: 'l-1' }])

    const sent = await sendPurchaseOrderHandler.execute(
      {
        type: 'send_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        purchase_order_id: '88888888-8888-4888-8888-888888888888',
      },
      ctx,
    )
    expect(sent.success).toBe(true)
    expect(sent.status_after).toBe('SENT')

    mockPurchaseOrderRepo.findById.mockResolvedValue({ id: 'po-1', status: 'sent' })
    const confirmed = await confirmPurchaseOrderHandler.execute(
      {
        type: 'confirm_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        purchase_order_id: '88888888-8888-4888-8888-888888888888',
      },
      ctx,
    )
    expect(confirmed.success).toBe(true)
    expect(confirmed.status_after).toBe('CONFIRMED')
  })

  it('covers additional low-branch failure paths for quote/order/po lifecycle handlers', async () => {
    mockCheckQuoteInvariants.mockResolvedValueOnce({ valid: false, violations: ['quote invariant failed'] })
    const acceptBlocked = await acceptQuoteHandler.execute(
      {
        type: 'accept_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
        customer_name: 'Customer',
      },
      ctx,
    )
    expect(acceptBlocked.success).toBe(false)
    expect(acceptBlocked.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'completed' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'already completed' })
    const cancelBlocked = await cancelOrderHandler.execute(
      {
        type: 'cancel_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        reason: 'late request',
      },
      ctx,
    )
    expect(cancelBlocked.success).toBe(false)
    expect(cancelBlocked.errors?.[0]?.code).toBe('INVALID_TRANSITION')

    mockCheckOrderInvariants.mockResolvedValueOnce({ valid: false, violations: ['order invariant failed'] })
    const completeBlocked = await completeOrderHandler.execute(
      {
        type: 'complete_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(completeBlocked.success).toBe(false)
    expect(completeBlocked.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockPurchaseOrderRepo.findById.mockResolvedValueOnce({ id: 'po-1', status: 'received' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'cannot confirm received po' })
    const confirmPoBlocked = await confirmPurchaseOrderHandler.execute(
      {
        type: 'confirm_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        purchase_order_id: '88888888-8888-4888-8888-888888888888',
      },
      ctx,
    )
    expect(confirmPoBlocked.success).toBe(false)
    expect(confirmPoBlocked.errors?.[0]?.code).toBe('INVALID_TRANSITION')

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', status: 'accepted' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'revision not allowed' })
    const revisionBlocked = await requestQuoteRevisionHandler.execute(
      {
        type: 'request_quote_revision',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
        request_message: 'Need changes',
      },
      ctx,
    )
    expect(revisionBlocked.success).toBe(false)
    expect(revisionBlocked.errors?.[0]?.code).toBe('INVALID_TRANSITION')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'completed' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'already done' })
    const startBlocked = await startFulfillmentHandler.execute(
      {
        type: 'start_fulfillment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(startBlocked.success).toBe(false)
    expect(startBlocked.errors?.[0]?.code).toBe('INVALID_TRANSITION')

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', status: 'accepted' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'review blocked' })
    const reviewBlocked = await submitForReviewHandler.execute(
      {
        type: 'submit_for_review',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )
    expect(reviewBlocked.success).toBe(false)
    expect(reviewBlocked.errors?.[0]?.code).toBe('INVALID_TRANSITION')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'created', customerId: null, total: '0' })
    mockOrderCanBeConfirmed.mockReturnValueOnce({ valid: false, violations: ['order missing customer'] })
    const confirmOrderBlocked = await confirmOrderHandler.execute(
      {
        type: 'confirm_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(confirmOrderBlocked.success).toBe(false)
    expect(confirmOrderBlocked.errors?.[0]?.code).toBe('DOMAIN_INVARIANT')

    mockPurchaseOrderRepo.findById.mockResolvedValueOnce({ id: 'po-1', supplierId: null, status: 'draft', total: '0' })
    mockPurchaseOrderRepo.findLines.mockResolvedValueOnce([])
    mockPoCanBeSent.mockReturnValueOnce({ valid: false, violations: ['missing supplier'] })
    const sendPoBlocked = await sendPurchaseOrderHandler.execute(
      {
        type: 'send_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        purchase_order_id: '88888888-8888-4888-8888-888888888888',
      },
      ctx,
    )
    expect(sendPoBlocked.success).toBe(false)
    expect(sendPoBlocked.errors?.[0]?.code).toBe('DOMAIN_INVARIANT')
  })

  it('covers alternate payment/invoice/deposit branches', async () => {
    mockPaymentRepo.findById.mockResolvedValue({ id: 'p-1', status: 'pending' })
    mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', total: '1000' })
    mockPaymentRepo.totalPaidForOrder.mockResolvedValueOnce(200)

    const partial = await confirmPaymentHandler.execute(
      {
        type: 'confirm_payment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        payment_id: '44444444-4444-4444-8444-444444444444',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(partial.success).toBe(true)
    expect(partial.status_after).toBe('PARTIALLY_PAID')
    expect(partial.emitted_event_ids?.length).toBe(1)

    mockCheckOrderInvariants.mockResolvedValueOnce({ valid: false, violations: ['order invariant failed'] })
    const createInvInvariant = await createInvoiceHandler.execute(
      {
        type: 'create_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        due_date: new Date('2026-12-01'),
      },
      ctx,
    )
    expect(createInvInvariant.success).toBe(false)
    expect(createInvInvariant.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'cancelled', total: '500', customerId: 'c-1' })
    const createInvCancelled = await createInvoiceHandler.execute(
      {
        type: 'create_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        due_date: new Date('2026-12-01'),
      },
      ctx,
    )
    expect(createInvCancelled.success).toBe(false)
    expect(createInvCancelled.errors?.[0]?.code).toBe('INVALID_STATE')

    mockInvoiceRepo.findById.mockResolvedValueOnce({ id: 'inv-3', status: 'draft', total: '0' })
    mockInvoiceCanBeIssued.mockReturnValueOnce({ valid: false, violations: ['amount must be > 0'] })
    const issueBlocked = await issueInvoiceHandler.execute(
      {
        type: 'issue_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        invoice_id: '55555555-5555-4555-8555-555555555555',
      },
      ctx,
    )
    expect(issueBlocked.success).toBe(false)
    expect(issueBlocked.errors?.[0]?.code).toBe('DOMAIN_INVARIANT')

    mockInvoiceRepo.findById.mockResolvedValueOnce({ id: 'inv-4', status: 'paid', total: '250' })
    mockInvoiceCanBeVoided.mockReturnValueOnce({ valid: false, violations: ['cannot void paid invoice'] })
    const voidBlocked = await voidInvoiceHandler.execute(
      {
        type: 'void_invoice',
        org_id: 'org-1',
        actor_id: 'actor-1',
        invoice_id: '66666666-6666-4666-8666-666666666666',
      },
      ctx,
    )
    expect(voidBlocked.success).toBe(false)
    expect(voidBlocked.errors?.[0]?.code).toBe('DOMAIN_INVARIANT')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-2', status: 'confirmed', quoteId: null })
    const depositNoQuote = await requireDepositHandler.execute(
      {
        type: 'require_deposit',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        deposit_required: true,
        deposit_percent: 25,
        due_before_production: true,
      },
      ctx,
    )
    expect(depositNoQuote.success).toBe(true)
    expect(mockPaymentRequirementRepo.save).not.toHaveBeenCalled()
  })

  it('covers not-found and fallback-transition message branches', async () => {
    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    await expect(
      acceptQuoteHandler.execute(
        {
          type: 'accept_quote',
          org_id: 'org-1',
          actor_id: 'actor-1',
          quote_id: '11111111-1111-4111-8111-111111111111',
          customer_name: 'Customer',
        },
        ctx,
      ),
    ).rejects.toThrow('quote')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      completeOrderHandler.execute(
        {
          type: 'complete_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      confirmOrderHandler.execute(
        {
          type: 'confirm_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockPurchaseOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      sendPurchaseOrderHandler.execute(
        {
          type: 'send_purchase_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          purchase_order_id: '88888888-8888-4888-8888-888888888888',
        },
        ctx,
      ),
    ).rejects.toThrow('purchase_order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'created', customerId: 'c-1', total: '50' })
    mockOrderCanBeConfirmed.mockReturnValueOnce({ valid: true, violations: [] })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const confirmBlockedFallback = await confirmOrderHandler.execute(
      {
        type: 'confirm_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(confirmBlockedFallback.success).toBe(false)
    expect(confirmBlockedFallback.errors?.[0]?.message).toContain('Cannot confirm order from status')

    mockPurchaseOrderRepo.findById.mockResolvedValueOnce({ id: 'po-1', supplierId: 'v-1', status: 'draft', total: '100' })
    mockPurchaseOrderRepo.findLines.mockResolvedValueOnce([{ id: 'l-1' }])
    mockPoCanBeSent.mockReturnValueOnce({ valid: true, violations: [] })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const sendPoFallback = await sendPurchaseOrderHandler.execute(
      {
        type: 'send_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        purchase_order_id: '88888888-8888-4888-8888-888888888888',
      },
      ctx,
    )
    expect(sendPoFallback.success).toBe(false)
    expect(sendPoFallback.errors?.[0]?.message).toContain('Cannot send PO from status')
  })

  it('covers remaining not-found and fallback branches for send/convert/deposit handlers', async () => {
    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    await expect(
      sendQuoteHandler.execute(
        {
          type: 'send_quote',
          org_id: 'org-1',
          actor_id: 'actor-1',
          quote_id: '11111111-1111-4111-8111-111111111111',
        },
        ctx,
      ),
    ).rejects.toThrow('quote')

    mockQuoteRepo.findById.mockResolvedValueOnce({
      id: 'q-1',
      status: 'draft',
      customerId: 'c-1',
      validUntil: null,
      total: '200',
    })
    mockQuoteRepo.findLines.mockResolvedValueOnce([{ id: 'l-1' }])
    mockQuoteCanBeSent.mockReturnValueOnce({ valid: true, violations: [] })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const sendFallback = await sendQuoteHandler.execute(
      {
        type: 'send_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )
    expect(sendFallback.success).toBe(false)
    expect(sendFallback.errors?.[0]?.message).toContain('Cannot transition from')

    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    await expect(
      convertQuoteToOrderHandler.execute(
        {
          type: 'convert_quote_to_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          quote_id: '11111111-1111-4111-8111-111111111111',
        },
        ctx,
      ),
    ).rejects.toThrow('quote')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      requireDepositHandler.execute(
        {
          type: 'require_deposit',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
          deposit_required: true,
          due_before_production: true,
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'created', quoteId: 'q-1' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const depositFallback = await requireDepositHandler.execute(
      {
        type: 'require_deposit',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        deposit_required: true,
        due_before_production: true,
      },
      ctx,
    )
    expect(depositFallback.success).toBe(false)
    expect(depositFallback.errors?.[0]?.message).toContain('Cannot require deposit from order status')
  })

  it('covers submit-for-review remaining invariant/not-found/fallback-message branches', async () => {
    mockCheckQuoteInvariants.mockResolvedValueOnce({ valid: false, violations: ['review invariant failed'] })
    const invariantBlocked = await submitForReviewHandler.execute(
      {
        type: 'submit_for_review',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )
    expect(invariantBlocked.success).toBe(false)
    expect(invariantBlocked.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    await expect(
      submitForReviewHandler.execute(
        {
          type: 'submit_for_review',
          org_id: 'org-1',
          actor_id: 'actor-1',
          quote_id: '11111111-1111-4111-8111-111111111111',
        },
        ctx,
      ),
    ).rejects.toThrow('quote')

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', status: 'draft' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const fallbackBlocked = await submitForReviewHandler.execute(
      {
        type: 'submit_for_review',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
      },
      ctx,
    )
    expect(fallbackBlocked.success).toBe(false)
    expect(fallbackBlocked.errors?.[0]?.message).toContain('Cannot submit for review from DRAFT')
  })

  it('covers record-payment remaining invariant/not-found/paid/fallback branches', async () => {
    mockCheckOrderInvariants.mockResolvedValueOnce({ valid: false, violations: ['payment invariant failed'] })
    const invariantBlocked = await recordPaymentHandler.execute(
      {
        type: 'record_payment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        amount: 50,
        currency: 'CAD',
        method: 'BANK_TRANSFER',
      },
      ctx,
    )
    expect(invariantBlocked.success).toBe(false)
    expect(invariantBlocked.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      recordPaymentHandler.execute(
        {
          type: 'record_payment',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
          amount: 50,
          currency: 'CAD',
          method: 'BANK_TRANSFER',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-paid', status: 'draft', total: '100' })
    mockPaymentRepo.totalPaidForOrder.mockResolvedValueOnce(100)
    const paidNoStatusChange = await recordPaymentHandler.execute(
      {
        type: 'record_payment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        amount: 100,
        currency: 'CAD',
        method: 'BANK_TRANSFER',
      },
      ctx,
    )
    expect(paidNoStatusChange.success).toBe(true)
    expect(paidNoStatusChange.status_after).toBe('PAID')
    expect(mockOrderRepo.update).toHaveBeenLastCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'org-1',
      { paymentStatus: 'PAID' },
    )

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-null-total', status: 'confirmed', total: null })
    mockPaymentRepo.totalPaidForOrder.mockResolvedValueOnce(1)
    const nullTotalFallback = await recordPaymentHandler.execute(
      {
        type: 'record_payment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        amount: 1,
        currency: 'CAD',
        method: 'BANK_TRANSFER',
      },
      ctx,
    )
    expect(nullTotalFallback.success).toBe(true)
    expect(mockPaymentRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ amountDue: '0' }),
    )
  })

  it('covers remaining lifecycle not-found and fallback transition branches', async () => {
    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    await expect(
      acceptQuoteHandler.execute(
        {
          type: 'accept_quote',
          org_id: 'org-1',
          actor_id: 'actor-1',
          quote_id: '11111111-1111-4111-8111-111111111111',
          customer_name: 'Customer',
        },
        ctx,
      ),
    ).rejects.toThrow('quote')

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', status: 'sent' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const acceptFallback = await acceptQuoteHandler.execute(
      {
        type: 'accept_quote',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
        customer_name: 'Customer',
      },
      ctx,
    )
    expect(acceptFallback.success).toBe(false)
    expect(acceptFallback.errors?.[0]?.message).toContain('Cannot accept quote from status sent')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      cancelOrderHandler.execute(
        {
          type: 'cancel_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
          reason: 'customer request',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'created' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const cancelFallback = await cancelOrderHandler.execute(
      {
        type: 'cancel_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        reason: 'customer request',
      },
      ctx,
    )
    expect(cancelFallback.success).toBe(false)
    expect(cancelFallback.errors?.[0]?.message).toContain('Cannot cancel order from status created')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      completeOrderHandler.execute(
        {
          type: 'complete_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'created' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const completeFallback = await completeOrderHandler.execute(
      {
        type: 'complete_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(completeFallback.success).toBe(false)
    expect(completeFallback.errors?.[0]?.message).toContain('Cannot complete order from status created')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      startFulfillmentHandler.execute(
        {
          type: 'start_fulfillment',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'created' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const startFallback = await startFulfillmentHandler.execute(
      {
        type: 'start_fulfillment',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(startFallback.success).toBe(false)
    expect(startFallback.errors?.[0]?.message).toContain('Cannot start fulfillment from status created')

    mockPurchaseOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      confirmPurchaseOrderHandler.execute(
        {
          type: 'confirm_purchase_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          purchase_order_id: '88888888-8888-4888-8888-888888888888',
        },
        ctx,
      ),
    ).rejects.toThrow('purchase_order')

    mockPurchaseOrderRepo.findById.mockResolvedValueOnce({ id: 'po-1', status: 'draft' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const confirmPoFallback = await confirmPurchaseOrderHandler.execute(
      {
        type: 'confirm_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        purchase_order_id: '88888888-8888-4888-8888-888888888888',
      },
      ctx,
    )
    expect(confirmPoFallback.success).toBe(false)
    expect(confirmPoFallback.errors?.[0]?.message).toContain('Cannot confirm PO from status draft')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'shipped' })
    const delivered = await markOrderDeliveredHandler.execute(
      {
        type: 'mark_order_delivered',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(delivered.success).toBe(true)
    expect(delivered.status_after).toBe('DELIVERED')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      markOrderDeliveredHandler.execute(
        {
          type: 'mark_order_delivered',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', status: 'created' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const deliveredFallback = await markOrderDeliveredHandler.execute(
      {
        type: 'mark_order_delivered',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
      },
      ctx,
    )
    expect(deliveredFallback.success).toBe(false)
    expect(deliveredFallback.errors?.[0]?.message).toContain('Cannot mark order delivered from status created')
  })

  it('covers request-quote-revision remaining invariant/not-found/fallback branches', async () => {
    mockCheckQuoteInvariants.mockResolvedValueOnce({ valid: false, violations: ['revision invariant failed'] })
    const invariantBlocked = await requestQuoteRevisionHandler.execute(
      {
        type: 'request_quote_revision',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
        request_message: 'Please revise',
      },
      ctx,
    )
    expect(invariantBlocked.success).toBe(false)
    expect(invariantBlocked.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    await expect(
      requestQuoteRevisionHandler.execute(
        {
          type: 'request_quote_revision',
          org_id: 'org-1',
          actor_id: 'actor-1',
          quote_id: '11111111-1111-4111-8111-111111111111',
          request_message: 'Please revise',
        },
        ctx,
      ),
    ).rejects.toThrow('quote')

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', status: 'accepted' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false })
    const fallbackBlocked = await requestQuoteRevisionHandler.execute(
      {
        type: 'request_quote_revision',
        org_id: 'org-1',
        actor_id: 'actor-1',
        quote_id: '11111111-1111-4111-8111-111111111111',
        request_message: 'Please revise',
      },
      ctx,
    )
    expect(fallbackBlocked.success).toBe(false)
    expect(fallbackBlocked.errors?.[0]?.message).toContain('Cannot request revision from status accepted')
  })

  it('covers create-purchase-order remaining invariant/not-found/gate/fallback branches', async () => {
    mockCheckOrderInvariants.mockResolvedValueOnce({ valid: false, violations: ['po invariant failed'] })
    const invariantBlocked = await createPurchaseOrderHandler.execute(
      {
        type: 'create_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        vendor_id: '77777777-7777-4777-8777-777777777777',
      },
      ctx,
    )
    expect(invariantBlocked.success).toBe(false)
    expect(invariantBlocked.errors?.[0]?.code).toBe('INVARIANT_VIOLATION')

    mockOrderRepo.findById.mockResolvedValueOnce(null)
    await expect(
      createPurchaseOrderHandler.execute(
        {
          type: 'create_purchase_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
          vendor_id: '77777777-7777-4777-8777-777777777777',
        },
        ctx,
      ),
    ).rejects.toThrow('order')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', total: '500', status: 'confirmed' })
    mockCheckCanGeneratePO.mockResolvedValueOnce({ allowed: false, reasons: ['deposit not cleared'] })
    const gateBlocked = await createPurchaseOrderHandler.execute(
      {
        type: 'create_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        vendor_id: '77777777-7777-4777-8777-777777777777',
      },
      ctx,
    )
    expect(gateBlocked.success).toBe(false)
    expect(gateBlocked.errors?.[0]?.code).toBe('PAYMENT_GATE_BLOCKED')
    expect(gateBlocked.errors?.[0]?.message).toContain('PO creation blocked')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', total: '500', status: 'confirmed' })
    mockVendorRepo.findById.mockResolvedValueOnce(null)
    await expect(
      createPurchaseOrderHandler.execute(
        {
          type: 'create_purchase_order',
          org_id: 'org-1',
          actor_id: 'actor-1',
          order_id: '33333333-3333-4333-8333-333333333333',
          vendor_id: '77777777-7777-4777-8777-777777777777',
        },
        ctx,
      ),
    ).rejects.toThrow('vendor')

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'o-1', total: null, status: 'confirmed' })
    mockVendorRepo.findById.mockResolvedValueOnce({ id: 'v-1' })
    const fallbackTotal = await createPurchaseOrderHandler.execute(
      {
        type: 'create_purchase_order',
        org_id: 'org-1',
        actor_id: 'actor-1',
        order_id: '33333333-3333-4333-8333-333333333333',
        vendor_id: '77777777-7777-4777-8777-777777777777',
      },
      ctx,
    )
    expect(fallbackTotal.success).toBe(true)
    expect(mockPurchaseOrderRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ total: '0', expectedDeliveryDate: null, notes: null }),
    )
  })
})
