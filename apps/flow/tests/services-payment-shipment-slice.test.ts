import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockEmitWorkflowAuditEvent,
  mockAttemptShipmentTransition,
  mockLogger,
  mockInsertReturning,
  mockSelectLimit,
  mockUpdateReturning,
  mockPaymentRequirementRepo,
  mockPaymentStatusRepo,
  mockPaymentEventRepo,
  mockOrderRepo,
  mockPaymentRepo,
} = vi.hoisted(() => ({
  mockEmitWorkflowAuditEvent: vi.fn(),
  mockAttemptShipmentTransition: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockInsertReturning: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockPaymentRequirementRepo: { findByQuoteId: vi.fn() },
  mockPaymentStatusRepo: { findByQuoteId: vi.fn() },
  mockPaymentEventRepo: { findByQuoteId: vi.fn() },
  mockOrderRepo: { findById: vi.fn(), update: vi.fn() },
  mockPaymentRepo: { findByOrder: vi.fn(), totalPaidForOrder: vi.fn() },
}))

vi.mock('@/lib/services/workflow-audit-service', () => ({
  emitWorkflowAuditEvent: mockEmitWorkflowAuditEvent,
}))

vi.mock('@/lib/workflows/shipment-state-machine', () => ({
  attemptShipmentTransition: mockAttemptShipmentTransition,
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: mockSelectLimit,
  }
  const insertChain = {
    values: vi.fn(() => insertChain),
    returning: mockInsertReturning,
  }
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateChain),
    returning: mockUpdateReturning,
  }
  return {
    db: {
      insert: vi.fn(() => insertChain),
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    },
    flowShipments: { id: 'id', orgId: 'orgId', orderId: 'orderId' },
  }
})

vi.mock('@/lib/repositories/workflow-repository', () => ({
  paymentRequirementRepo: mockPaymentRequirementRepo,
  paymentStatusRepo: mockPaymentStatusRepo,
  paymentEventRepo: mockPaymentEventRepo,
}))

vi.mock('@/lib/repositories', () => ({
  orderRepo: mockOrderRepo,
  paymentRepo: mockPaymentRepo,
}))

describe('Flow service slice (shipment + payment state)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shipment-service create/addTracking/markDelivered/findShipmentsByOrder', async () => {
    const { createShipment, addTracking, markDelivered } = await import('@/lib/services/shipment-service')

    mockInsertReturning.mockResolvedValue([{ id: 's-1' }])
    const created = await createShipment('ord-1', 'org-1')
    expect(created.ok).toBe(true)
    expect(created.shipmentId).toBe('s-1')

    mockSelectLimit.mockResolvedValue([{ id: 's-1', status: 'pending', orderId: 'ord-1' }])
    mockAttemptShipmentTransition.mockReturnValue({ ok: true })
    mockUpdateReturning.mockResolvedValue([{ id: 's-1', orderId: 'ord-1' }])

    const tracked = await addTracking('s-1', 'org-1', { carrier: 'DHL', trackingNumber: 'TRK' }, 'u-1')
    expect(tracked.ok).toBe(true)

    mockSelectLimit.mockResolvedValue([{ id: 's-1', status: 'shipped', orderId: 'ord-1' }])
    mockUpdateReturning.mockResolvedValue([{ id: 's-1', orderId: 'ord-1' }])
    const delivered = await markDelivered('s-1', 'org-1', 'u-1')
    expect(delivered.ok).toBe(true)
  })

  it('shipment-service handles missing shipments and invalid transitions', async () => {
    const { addTracking, markDelivered } = await import('@/lib/services/shipment-service')

    mockSelectLimit.mockResolvedValue([])
    const missing = await addTracking('s-404', 'org-1', { carrier: 'UPS', trackingNumber: 'x' }, 'u-1')
    expect(missing.ok).toBe(false)

    mockSelectLimit.mockResolvedValue([{ id: 's-1', status: 'pending', orderId: 'ord-1' }])
    mockAttemptShipmentTransition.mockReturnValue({ ok: false })
    await expect(markDelivered('s-1', 'org-1', 'u-1')).rejects.toThrow('Transition')
  })

  it('payment-state-service snapshots and canonical state helpers', async () => {
    const {
      getPaymentSnapshotForQuote,
      getPaymentSnapshotForOrder,
      isDepositMet,
      computeOrderPaymentState,
      syncOrderPaymentState,
      getOutstandingBalance,
      getPaymentBlockingReasons,
    } = await import('@/lib/services/payment-state-service')

    mockPaymentRequirementRepo.findByQuoteId.mockResolvedValue({
      depositRequired: true,
      depositAmount: 50,
      depositPercent: null,
      dueBeforeProduction: true,
    })
    mockPaymentStatusRepo.findByQuoteId.mockResolvedValue({ status: 'PARTIAL', amountDue: 200, amountPaid: 20 })
    mockPaymentEventRepo.findByQuoteId.mockResolvedValue([{ id: 'e-1', eventType: 'payment', amount: 20, createdAt: new Date() }])

    const quoteSnap = await getPaymentSnapshotForQuote('q-1')
    expect(quoteSnap?.deposit_required).toBe(true)

    mockOrderRepo.findById.mockResolvedValue({ id: 'ord-1', total: '200', paymentStatus: 'PENDING', quoteId: 'q-1' })
    mockPaymentRepo.findByOrder.mockResolvedValue([{ id: 'p-1', provider: 'stripe', amountPaid: '20', createdAt: new Date() }])
    mockPaymentRepo.totalPaidForOrder.mockResolvedValue(20)

    const orderSnap = await getPaymentSnapshotForOrder('ord-1', 'org-1')
    expect(orderSnap?.amount_due).toBe(200)
    expect(orderSnap?.amount_paid).toBe(20)

    const depositMet = await isDepositMet('q-1')
    expect(depositMet).toBe(false)

    const state = await computeOrderPaymentState('ord-1', 'org-1')
    expect(state).toBe('PARTIAL')

    const synced = await syncOrderPaymentState('ord-1', 'org-1')
    expect(synced).toBe('PARTIAL')
    expect(mockOrderRepo.update).toHaveBeenCalledWith('ord-1', 'org-1', { paymentStatus: 'PARTIAL' })

    const outstanding = await getOutstandingBalance('ord-1', 'org-1')
    expect(outstanding).toBe(180)

    const reasons = await getPaymentBlockingReasons('ord-1', 'org-1')
    expect(reasons.length).toBeGreaterThan(0)
  })
})
