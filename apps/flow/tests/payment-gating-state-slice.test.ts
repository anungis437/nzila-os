import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockQuoteFindById,
  mockPaymentRequirementSave,
  mockPaymentRequirementFindByQuoteId,
  mockPaymentStatusUpsertForQuote,
  mockPaymentStatusFindByQuoteId,
  mockPaymentEventSave,
  mockPaymentEventFindByQuoteId,
  mockRecordTimelineEvent,
  mockEmitWorkflowAuditEvent,
  mockOrderFindById,
  mockOrderUpdate,
  mockPaymentFindByOrder,
  mockPaymentTotalPaidForOrder,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockQuoteFindById: vi.fn(),
  mockPaymentRequirementSave: vi.fn(),
  mockPaymentRequirementFindByQuoteId: vi.fn(),
  mockPaymentStatusUpsertForQuote: vi.fn(),
  mockPaymentStatusFindByQuoteId: vi.fn(),
  mockPaymentEventSave: vi.fn(),
  mockPaymentEventFindByQuoteId: vi.fn(),
  mockRecordTimelineEvent: vi.fn(),
  mockEmitWorkflowAuditEvent: vi.fn(),
  mockOrderFindById: vi.fn(),
  mockOrderUpdate: vi.fn(),
  mockPaymentFindByOrder: vi.fn(),
  mockPaymentTotalPaidForOrder: vi.fn(),
  mockLoggerInfo: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  quoteRepo: { findById: mockQuoteFindById },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: mockLoggerInfo },
}))

vi.mock('@/lib/services/workflow-audit-service', () => ({
  emitWorkflowAuditEvent: mockEmitWorkflowAuditEvent,
}))

vi.mock('@/lib/repositories/workflow-repository', () => ({
  paymentRequirementRepo: {
    save: mockPaymentRequirementSave,
    findByQuoteId: mockPaymentRequirementFindByQuoteId,
  },
  paymentStatusRepo: {
    upsertForQuote: mockPaymentStatusUpsertForQuote,
    findByQuoteId: mockPaymentStatusFindByQuoteId,
  },
  paymentEventRepo: {
    save: mockPaymentEventSave,
    findByQuoteId: mockPaymentEventFindByQuoteId,
  },
  recordTimelineEvent: mockRecordTimelineEvent,
}))

vi.mock('@/lib/repositories', () => ({
  orderRepo: {
    findById: mockOrderFindById,
    update: mockOrderUpdate,
  },
  paymentRepo: {
    findByOrder: mockPaymentFindByOrder,
    totalPaidForOrder: mockPaymentTotalPaidForOrder,
  },
}))

describe('payment gating and payment state slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuoteFindById.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'ACCEPTED',
      total: 200,
      title: 'Quote',
      customerId: 'cust-1',
    })
    mockPaymentRequirementFindByQuoteId.mockResolvedValue(null)
    mockPaymentStatusFindByQuoteId.mockResolvedValue(null)
    mockPaymentEventFindByQuoteId.mockResolvedValue([])
    mockPaymentFindByOrder.mockResolvedValue([])
    mockPaymentTotalPaidForOrder.mockResolvedValue(0)
    mockOrderFindById.mockResolvedValue({
      id: 'order-1',
      total: 300,
      quoteId: 'quote-1',
      paymentStatus: 'PENDING',
    })
  })

  it('covers payment requirement and record/payment readiness branches', async () => {
    const gating = await import('@/lib/services/payment-gating-service')
    const quoteId = '11111111-1111-4111-8111-111111111111'

    const requirement = await gating.setPaymentRequirement(
      {
        quoteId,
        depositRequired: true,
        depositPercent: 25,
        dueBeforeProduction: true,
      } as never,
      'user-1',
      'org-1',
    )
    expect(requirement.depositRequired).toBe(true)
    expect(mockPaymentStatusUpsertForQuote).toHaveBeenCalledWith(quoteId, expect.objectContaining({ status: 'PENDING_DEPOSIT' }))

    mockQuoteFindById.mockResolvedValueOnce(null)
    await expect(
      gating.setPaymentRequirement(
        { quoteId: '11111111-1111-4111-8111-111111111112', depositRequired: true } as never,
        'user-1',
        'org-1',
      ),
    ).rejects.toThrow('Quote not found')

    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({ depositRequired: true })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({ status: 'PENDING_DEPOSIT', amountPaid: 0, amountDue: 100 })
    expect((await gating.recordPayment({ quoteId, eventType: 'payment', amount: 30 } as never, 'user-1', 'org-1')).newStatus).toBe('PARTIALLY_PAID')

    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({ depositRequired: true })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({ status: 'PENDING_DEPOSIT', amountPaid: 90, amountDue: 100 })
    expect((await gating.recordPayment({ quoteId, eventType: 'payment', amount: 20 } as never, 'user-1', 'org-1')).newStatus).toBe('PAID')

    mockQuoteFindById.mockResolvedValueOnce({ id: quoteId, status: 'DRAFT', title: 'Quote', customerId: 'cust-1', total: 1 })
    const poReadiness = await gating.evaluatePOReadiness(quoteId)
    expect(poReadiness.ready).toBe(false)
    expect(poReadiness.blockers[0]).toContain('READY_FOR_PO')

    mockQuoteFindById.mockResolvedValueOnce({ id: quoteId, status: 'READY_FOR_PO', title: 'Quote', customerId: 'cust-1', total: 1 })
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({ depositRequired: true })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({ status: 'PENDING_DEPOSIT' })
    const blocked = await gating.evaluatePOReadiness(quoteId)
    expect(blocked.paymentCleared).toBe(false)
    expect(blocked.blockers.some(b => b.includes('must be PAID'))).toBe(true)

    mockQuoteFindById.mockResolvedValueOnce({ id: quoteId, status: 'READY_FOR_PO', title: 'Quote', customerId: 'cust-1', total: 1 })
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({ depositRequired: false })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({ status: 'NOT_REQUIRED' })
    expect((await gating.evaluateProductionReadiness(quoteId, 'order-1')).ready).toBe(true)

    mockQuoteFindById.mockResolvedValueOnce({ id: quoteId, status: 'DRAFT' })
    expect((await gating.evaluateProductionReadiness(quoteId, 'order-1')).blockers.some(b => b.includes('appropriate status'))).toBe(true)
  })

  it('covers payment snapshots and state sync helpers', async () => {
    const state = await import('@/lib/services/payment-state-service')
    const quoteId = '11111111-1111-4111-8111-111111111111'

    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce(null)
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce(null)
    expect(await state.getPaymentSnapshotForQuote('11111111-1111-4111-8111-111111111113')).toBeNull()

    mockPaymentRequirementFindByQuoteId.mockResolvedValue({
      depositRequired: true,
      depositAmount: 50,
      depositPercent: 25,
      dueBeforeProduction: true,
    })
    mockPaymentStatusFindByQuoteId.mockResolvedValue({ status: 'PAID', amountDue: 200, amountPaid: 200 })
    mockPaymentEventFindByQuoteId.mockResolvedValue([{ id: 'evt-1', eventType: 'payment', amount: 50, createdAt: new Date('2024-01-01') }])
    const quoteSnapshot = await state.getPaymentSnapshotForQuote(quoteId)
    expect(quoteSnapshot?.events).toHaveLength(1)
    expect(await state.isDepositMet(quoteId)).toBe(true)
    mockOrderFindById.mockResolvedValueOnce({ id: 'order-1', total: 200, quoteId, paymentStatus: 'PENDING' })
    mockPaymentFindByOrder.mockResolvedValueOnce([])
    mockPaymentTotalPaidForOrder.mockResolvedValueOnce(200)
    expect(await state.computeOrderPaymentState('order-1', 'org-1')).toBe('PAID')

    mockOrderFindById.mockResolvedValueOnce({ id: 'order-1', total: 300, quoteId, paymentStatus: 'PENDING' })
    mockPaymentFindByOrder.mockResolvedValueOnce([{ id: 'pay-1', provider: 'stripe', amountPaid: 40, createdAt: new Date('2024-01-01') }])
    mockPaymentTotalPaidForOrder.mockResolvedValueOnce(40)
    const orderSnapshot = await state.getPaymentSnapshotForOrder('order-1', 'org-1')
    expect(orderSnapshot?.events[0]?.event_type).toBe('stripe')

    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({ depositRequired: true, depositAmount: 100, depositPercent: 25, dueBeforeProduction: false })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({ status: 'PARTIAL', amountDue: 300, amountPaid: 40 })
    expect((await state.getPaymentBlockingReasons('order-1', 'org-1')).some(reason => reason.includes('Deposit required'))).toBe(true)

    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({ depositRequired: true, depositAmount: 100, depositPercent: 25, dueBeforeProduction: true })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({ status: 'PARTIAL', amountDue: 300, amountPaid: 40 })
    expect(await state.syncOrderPaymentState('order-1', 'org-1')).toBe('PENDING_DEPOSIT')
    expect(mockOrderUpdate).toHaveBeenCalledWith('order-1', 'org-1', { paymentStatus: 'PENDING_DEPOSIT' })

    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({ depositRequired: true, depositAmount: 100, depositPercent: 25, dueBeforeProduction: true })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({ status: 'OVERDUE', amountDue: 300, amountPaid: 0 })
    expect(await state.getOutstandingBalance('order-1', 'org-1')).toBe(300)
    expect((await state.getPaymentBlockingReasons('order-1', 'org-1')).length).toBeGreaterThan(0)
  })

  it('covers remaining payment state branches for missing orders and status-specific blockers', async () => {
    const state = await import('@/lib/services/payment-state-service')

    mockOrderFindById.mockResolvedValueOnce(null)
    expect(await state.getPaymentSnapshotForOrder('missing-order', 'org-1')).toBeNull()
    mockOrderFindById.mockResolvedValueOnce(null)
    expect(await state.computeOrderPaymentState('missing-order', 'org-1')).toBe('NOT_REQUIRED')
    mockOrderFindById.mockResolvedValueOnce(null)
    expect(await state.getOutstandingBalance('missing-order', 'org-1')).toBe(0)
    mockOrderFindById.mockResolvedValueOnce(null)
    expect(await state.getPaymentBlockingReasons('missing-order', 'org-1')).toEqual([])

    mockOrderFindById.mockResolvedValueOnce({
      id: 'order-2',
      total: 300,
      quoteId: 'quote-2',
      paymentStatus: 'PENDING',
    })
    mockPaymentFindByOrder.mockResolvedValueOnce([])
    mockPaymentTotalPaidForOrder.mockResolvedValueOnce(0)
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({
      depositRequired: false,
      depositAmount: null,
      depositPercent: null,
      dueBeforeProduction: false,
    })
    expect(await state.computeOrderPaymentState('order-2', 'org-1')).toBe('NOT_REQUIRED')

    mockOrderFindById.mockResolvedValueOnce({
      id: 'order-3',
      total: 400,
      quoteId: 'quote-3',
      paymentStatus: 'PENDING',
    })
    mockPaymentFindByOrder.mockResolvedValueOnce([{ id: 'pay-3', provider: null, amountPaid: 20, createdAt: null }])
    mockPaymentTotalPaidForOrder.mockResolvedValueOnce(40)
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({
      depositRequired: true,
      depositAmount: null,
      depositPercent: 50,
      dueBeforeProduction: true,
    })
    const percentReason = await state.getPaymentBlockingReasons('order-3', 'org-1')
    expect(percentReason.some((reason) => reason.includes('Deposit required: $200.00'))).toBe(true)

    mockOrderFindById.mockResolvedValueOnce({
      id: 'order-4',
      total: 120,
      quoteId: 'quote-4',
      paymentStatus: 'OVERDUE',
    })
    mockPaymentFindByOrder.mockResolvedValueOnce([])
    mockPaymentTotalPaidForOrder.mockResolvedValueOnce(0)
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({
      depositRequired: false,
      depositAmount: null,
      depositPercent: null,
      dueBeforeProduction: false,
    })
    const overdueReasons = await state.getPaymentBlockingReasons('order-4', 'org-1')
    expect(overdueReasons).toContain('Order has overdue payment')

    mockOrderFindById.mockResolvedValueOnce({
      id: 'order-5',
      total: 120,
      quoteId: 'quote-5',
      paymentStatus: 'FAILED',
    })
    mockPaymentFindByOrder.mockResolvedValueOnce([])
    mockPaymentTotalPaidForOrder.mockResolvedValueOnce(0)
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({
      depositRequired: false,
      depositAmount: null,
      depositPercent: null,
      dueBeforeProduction: false,
    })
    const failedReasons = await state.getPaymentBlockingReasons('order-5', 'org-1')
    expect(failedReasons).toContain('Order has a failed payment requiring resolution')
  })
})
