import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCheckProductionReadiness,
  mockCheckProductionJobInvariants,
  mockCheckOrderInvariants,
  mockCheckPurchaseOrderInvariants,
  mockCheckCanMarkShipped,
  mockCheckCanMarkDelivered,
  mockValidateTransition,
  mockDispatchDomainEvent,
  mockDispatchAuditEntry,
  mockAddTracking,
  mockMarkShipmentDelivered,
  mockOrderRepo,
  mockProductionRepo,
  mockPurchaseOrderRepo,
} = vi.hoisted(() => ({
  mockCheckProductionReadiness: vi.fn(),
  mockCheckProductionJobInvariants: vi.fn(),
  mockCheckOrderInvariants: vi.fn(),
  mockCheckPurchaseOrderInvariants: vi.fn(),
  mockCheckCanMarkShipped: vi.fn(),
  mockCheckCanMarkDelivered: vi.fn(),
  mockValidateTransition: vi.fn(),
  mockDispatchDomainEvent: vi.fn(),
  mockDispatchAuditEntry: vi.fn(),
  mockAddTracking: vi.fn(),
  mockMarkShipmentDelivered: vi.fn(),
  mockOrderRepo: {
    findById: vi.fn(),
    update: vi.fn(),
  },
  mockProductionRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  },
  mockPurchaseOrderRepo: {
    findById: vi.fn(),
    update: vi.fn(),
    findByOrder: vi.fn(),
  },
}))

vi.mock('node:crypto', () => ({ randomUUID: vi.fn(() => 'job-1') }))
vi.mock('@/lib/commands/types', () => ({
  StartProductionCommand: { parse: (v: unknown) => v },
  CompleteProductionCommand: { parse: (v: unknown) => v },
  ShipOrderCommand: { parse: (v: unknown) => v },
  MarkOrderDeliveredCommand: { parse: (v: unknown) => v },
  MarkShipmentShippedCommand: { parse: (v: unknown) => v },
  MarkShipmentDeliveredCommand: { parse: (v: unknown) => v },
  CancelPurchaseOrderCommand: { parse: (v: unknown) => v },
  CheckProductionReadinessCommand: { parse: (v: unknown) => v },
}))
vi.mock('@/lib/repositories', () => ({
  orderRepo: mockOrderRepo,
  productionRepo: mockProductionRepo,
  purchaseOrderRepo: mockPurchaseOrderRepo,
}))
vi.mock('@/lib/control/guards/production-guard', () => ({
  checkProductionReadiness: mockCheckProductionReadiness,
}))
vi.mock('@/lib/control/guards/invariant-guard', () => ({
  checkProductionJobInvariants: mockCheckProductionJobInvariants,
  checkOrderInvariants: mockCheckOrderInvariants,
  checkPurchaseOrderInvariants: mockCheckPurchaseOrderInvariants,
}))
vi.mock('@/lib/control/guards/workflow-guard', () => ({ validateTransition: mockValidateTransition }))
vi.mock('@/lib/control/guards/shipment-guard', () => ({
  checkCanMarkShipped: mockCheckCanMarkShipped,
  checkCanMarkDelivered: mockCheckCanMarkDelivered,
}))
vi.mock('@/lib/control/dispatch/event-dispatcher', () => ({ dispatchDomainEvent: mockDispatchDomainEvent }))
vi.mock('@/lib/control/dispatch/audit-dispatcher', () => ({ dispatchAuditEntry: mockDispatchAuditEntry }))
vi.mock('@/lib/services/shipment-service', () => ({
  addTracking: mockAddTracking,
  markDelivered: mockMarkShipmentDelivered,
}))

describe('control lifecycle handlers slices', () => {
  const context = { org_id: 'org-1', correlation_id: 'corr-1' } as const

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckProductionReadiness.mockResolvedValue({ allowed: true, blockers: [] })
    mockCheckProductionJobInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockCheckOrderInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockCheckPurchaseOrderInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockCheckCanMarkShipped.mockResolvedValue({ allowed: true, blockers: [] })
    mockCheckCanMarkDelivered.mockResolvedValue({ allowed: true, blockers: [] })
    mockValidateTransition.mockReturnValue({ allowed: true })
    mockDispatchDomainEvent.mockReturnValue('evt-1')
    mockDispatchAuditEntry.mockResolvedValue('aud-1')

    mockOrderRepo.findById.mockResolvedValue({ id: 'ord-1', ref: 'ORD-1', status: 'fulfillment' })
    mockOrderRepo.update.mockResolvedValue(undefined)
    mockProductionRepo.create.mockResolvedValue(undefined)
    mockProductionRepo.findById.mockResolvedValue({ id: 'job-1', status: 'in_production' })
    mockProductionRepo.update.mockResolvedValue(undefined)
    mockPurchaseOrderRepo.findById.mockResolvedValue({ id: 'po-1', status: 'sent' })
    mockPurchaseOrderRepo.update.mockResolvedValue(undefined)
    mockPurchaseOrderRepo.findByOrder.mockResolvedValue([{ id: 'po-1', status: 'received' }])
    mockAddTracking.mockResolvedValue(undefined)
    mockMarkShipmentDelivered.mockResolvedValue(undefined)
  })

  it('covers start production blocked and success branches', async () => {
    const { startProductionHandler } = await import('@/lib/control/handlers/start-production.handler')

    mockCheckProductionReadiness.mockResolvedValueOnce({ allowed: false, blockers: ['deposit missing'] })
    const blocked = await startProductionHandler.execute(
      { order_id: 'ord-1', purchase_order_id: 'po-1', vendor_id: 'ven-1', actor_id: 'user-1' } as never,
      context as never,
    )
    expect(blocked.success).toBe(false)
    expect(blocked.errors?.[0]?.code).toBe('PRODUCTION_BLOCKED')

    const success = await startProductionHandler.execute(
      { order_id: 'ord-1', purchase_order_id: 'po-1', vendor_id: 'ven-1', actor_id: 'user-1' } as never,
      context as never,
    )
    expect(success).toMatchObject({ success: true, entity_type: 'production_job', status_after: 'IN_PRODUCTION' })
    expect(mockProductionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1', orderId: 'ord-1' }))
  })

  it('covers complete production invariant, invalid transition, and success branches', async () => {
    const { completeProductionHandler } = await import('@/lib/control/handlers/complete-production.handler')

    mockCheckProductionJobInvariants.mockResolvedValueOnce({ valid: false, violations: ['bad invariant'] })
    const inv = await completeProductionHandler.execute(
      { production_job_id: 'job-1', order_id: 'ord-1', actor_id: 'user-1' } as never,
      context as never,
    )
    expect(inv).toMatchObject({ success: false })

    mockProductionRepo.findById.mockResolvedValueOnce({ id: 'job-1', status: 'queued' })
    const badTransition = await completeProductionHandler.execute(
      { production_job_id: 'job-1', order_id: 'ord-1', actor_id: 'user-1' } as never,
      context as never,
    )
    expect(badTransition).toMatchObject({ success: false })

    const ok = await completeProductionHandler.execute(
      { production_job_id: 'job-1', order_id: 'ord-1', actor_id: 'user-1' } as never,
      context as never,
    )
    expect(ok).toMatchObject({ success: true, status_after: 'READY_TO_SHIP' })
  })

  it('covers ship and deliver order branches', async () => {
    const { shipOrderHandler } = await import('@/lib/control/handlers/ship-order.handler')
    const { markOrderDeliveredHandler } = await import('@/lib/control/handlers/mark-order-delivered.handler')

    mockCheckOrderInvariants.mockResolvedValueOnce({ valid: false, violations: ['missing lines'] })
    expect(
      await shipOrderHandler.execute({ order_id: 'ord-1', actor_id: 'user-1' } as never, context as never),
    ).toMatchObject({ success: false })

    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'not ready' })
    expect(
      await shipOrderHandler.execute({ order_id: 'ord-1', actor_id: 'user-1' } as never, context as never),
    ).toMatchObject({ success: false })

    expect(
      await shipOrderHandler.execute({ order_id: 'ord-1', actor_id: 'user-1' } as never, context as never),
    ).toMatchObject({ success: true, status_after: 'SHIPPED' })

    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'delivery blocked' })
    expect(
      await markOrderDeliveredHandler.execute({ order_id: 'ord-1', actor_id: 'user-1' } as never, context as never),
    ).toMatchObject({ success: false })

    expect(
      await markOrderDeliveredHandler.execute({ order_id: 'ord-1', actor_id: 'user-1' } as never, context as never),
    ).toMatchObject({ success: true, status_after: 'DELIVERED' })
  })

  it('covers mark shipment shipped/delivered blocked and success branches', async () => {
    const { markShipmentShippedHandler } = await import('@/lib/control/handlers/mark-shipment-shipped.handler')
    const { markShipmentDeliveredHandler } = await import('@/lib/control/handlers/mark-shipment-delivered.handler')

    mockCheckCanMarkShipped.mockResolvedValueOnce({ allowed: false, blockers: ['missing carrier'] })
    expect(
      await markShipmentShippedHandler.execute(
        { shipment_id: 'sh-1', order_id: 'ord-1', actor_id: 'user-1', carrier: 'DHL', tracking_number: 'T1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    expect(
      await markShipmentShippedHandler.execute(
        { shipment_id: 'sh-1', order_id: 'ord-1', actor_id: 'user-1', carrier: 'DHL', tracking_number: 'T1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: true, status_after: 'SHIPPED' })
    expect(mockAddTracking).toHaveBeenCalled()

    mockCheckCanMarkDelivered.mockResolvedValueOnce({ allowed: false, blockers: ['not shipped'] })
    expect(
      await markShipmentDeliveredHandler.execute(
        { shipment_id: 'sh-1', order_id: 'ord-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    expect(
      await markShipmentDeliveredHandler.execute(
        { shipment_id: 'sh-1', order_id: 'ord-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: true, status_after: 'DELIVERED' })
    expect(mockMarkShipmentDelivered).toHaveBeenCalled()
  })

  it('covers cancel purchase order and production readiness decision branches', async () => {
    const { cancelPurchaseOrderHandler } = await import('@/lib/control/handlers/cancel-purchase-order.handler')
    const { checkProductionReadinessHandler } = await import('@/lib/control/handlers/check-production-readiness.handler')

    mockCheckPurchaseOrderInvariants.mockResolvedValueOnce({ valid: false, violations: ['po invalid'] })
    expect(
      await cancelPurchaseOrderHandler.execute(
        { purchase_order_id: 'po-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'already received' })
    expect(
      await cancelPurchaseOrderHandler.execute(
        { purchase_order_id: 'po-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    expect(
      await cancelPurchaseOrderHandler.execute(
        { purchase_order_id: 'po-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: true, status_after: 'CANCELLED' })

    mockPurchaseOrderRepo.findByOrder.mockResolvedValueOnce([])
    expect(
      await checkProductionReadinessHandler.execute(
        { order_id: 'ord-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: true })

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'ord-1', ref: 'ORD-1', status: 'quote_accepted' })
    mockPurchaseOrderRepo.findByOrder.mockResolvedValueOnce([
      { id: 'po-1', status: 'received' },
      { id: 'po-2', status: 'received' },
    ])
    expect(
      await checkProductionReadinessHandler.execute(
        { order_id: 'ord-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: true, status_after: 'FULFILLMENT' })

    mockOrderRepo.findById.mockResolvedValueOnce({ id: 'ord-1', ref: 'ORD-1', status: 'fulfillment' })
    mockPurchaseOrderRepo.findByOrder.mockResolvedValueOnce([
      { id: 'po-1', status: 'received' },
      { id: 'po-2', status: 'sent' },
    ])
    expect(
      await checkProductionReadinessHandler.execute(
        { order_id: 'ord-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: true, status_after: 'fulfillment' })
  })
})
