import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRevalidatePath,
  mockResolveOrgContext,
  mockExecuteCommandV2,
  mockCreateOrder,
  mockGetOrder,
  mockListOrders,
  mockAllocateInventory,
  mockFulfillAllocation,
  mockCancelAllocation,
  mockAutoAllocateOrder,
  mockGetProductionDashboard,
} = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockExecuteCommandV2: vi.fn(),
  mockCreateOrder: vi.fn(),
  mockGetOrder: vi.fn(),
  mockListOrders: vi.fn(),
  mockAllocateInventory: vi.fn(),
  mockFulfillAllocation: vi.fn(),
  mockCancelAllocation: vi.fn(),
  mockAutoAllocateOrder: vi.fn(),
  mockGetProductionDashboard: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgContext: mockResolveOrgContext,
}))

vi.mock('@/lib/control/control-adapter', () => ({
  executeCommandV2: mockExecuteCommandV2,
}))

vi.mock('@/lib/production-service', () => ({
  createOrder: mockCreateOrder,
  getOrder: mockGetOrder,
  listOrders: mockListOrders,
  allocateInventory: mockAllocateInventory,
  fulfillAllocation: mockFulfillAllocation,
  cancelAllocation: mockCancelAllocation,
  autoAllocateOrder: mockAutoAllocateOrder,
  getProductionDashboard: mockGetProductionDashboard,
}))

vi.mock('@nzila/db', () => ({
  commerceOrders: {},
  commerceMandateAllocations: {},
}))

describe('production actions slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'user-1' })
  })

  it('covers create/get/list success and not-found branches', async () => {
    const actions = await import('@/lib/production-actions')

    mockCreateOrder.mockResolvedValue({ id: 'ord-1' })
    const created = await actions.createOrderAction({
      customerId: 'cust-1',
      lines: [{ productId: 'prod-1', description: 'Gift Box', quantity: 2, unitPrice: 100 }],
      notes: 'priority',
    })
    expect(created).toMatchObject({ success: true, data: { id: 'ord-1' } })
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', userId: 'user-1' }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/orders')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/production')

    mockGetOrder.mockResolvedValueOnce(null)
    const missing = await actions.getOrderAction('ord-missing')
    expect(missing).toMatchObject({ success: false, error: 'Order not found' })

    mockGetOrder.mockResolvedValueOnce({ id: 'ord-2' })
    const found = await actions.getOrderAction('ord-2')
    expect(found).toMatchObject({ success: true, data: { id: 'ord-2' } })

    mockListOrders.mockResolvedValue([{ id: 'ord-3' }])
    const listed = await actions.listOrdersAction({
      status: 'created',
      customerId: 'cust-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      search: 'gift',
    })
    expect(listed).toMatchObject({ success: true, data: [{ id: 'ord-3' }] })
    expect(mockListOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        customerId: 'cust-1',
        search: 'gift',
        dateFrom: expect.any(Date),
        dateTo: expect.any(Date),
      }),
    )
  })

  it('covers create/list/get failure branches', async () => {
    const actions = await import('@/lib/production-actions')

    mockCreateOrder.mockRejectedValueOnce(new Error('create exploded'))
    await expect(actions.createOrderAction({ customerId: 'c', lines: [] })).resolves.toMatchObject({
      success: false,
      error: 'create exploded',
    })

    mockGetOrder.mockRejectedValueOnce(new Error('get exploded'))
    await expect(actions.getOrderAction('ord-1')).resolves.toMatchObject({
      success: false,
      error: 'get exploded',
    })

    mockListOrders.mockRejectedValueOnce(new Error('list exploded'))
    await expect(actions.listOrdersAction()).resolves.toMatchObject({
      success: false,
      error: 'list exploded',
    })
  })

  it('covers command actions success and failure branches', async () => {
    const actions = await import('@/lib/production-actions')

    mockExecuteCommandV2.mockResolvedValueOnce({ success: false, error: 'cannot confirm' })
    await expect(actions.confirmOrderAction('ord-1')).resolves.toMatchObject({
      success: false,
      error: 'cannot confirm',
    })

    mockExecuteCommandV2.mockResolvedValueOnce({ success: true })
    await expect(actions.startFulfillmentAction('ord-1')).resolves.toMatchObject({ success: true })

    mockExecuteCommandV2.mockResolvedValueOnce({ success: true })
    await expect(
      actions.markOrderShippedAction('ord-2', { carrier: 'DHL', trackingNumber: 'T123' }),
    ).resolves.toMatchObject({ success: true })

    mockExecuteCommandV2.mockResolvedValueOnce({ success: true })
    await expect(actions.completeOrderAction('ord-3')).resolves.toMatchObject({ success: true })

    mockExecuteCommandV2.mockResolvedValueOnce({ success: true })
    await expect(actions.cancelOrderAction('ord-4', 'customer request')).resolves.toMatchObject({ success: true })

    expect(mockExecuteCommandV2).toHaveBeenCalledWith(expect.objectContaining({ type: 'confirm_order', order_id: 'ord-1' }))
    expect(mockExecuteCommandV2).toHaveBeenCalledWith(expect.objectContaining({ type: 'start_fulfillment', order_id: 'ord-1' }))
    expect(mockExecuteCommandV2).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ship_order',
        order_id: 'ord-2',
        notes: 'carrier=DHL; tracking=T123',
      }),
    )
    expect(mockExecuteCommandV2).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete_order', order_id: 'ord-3' }))
    expect(mockExecuteCommandV2).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cancel_order', order_id: 'ord-4', reason: 'customer request' }),
    )
  })

  it('covers allocation and dashboard actions across success/failure branches', async () => {
    const actions = await import('@/lib/production-actions')

    mockAllocateInventory.mockResolvedValueOnce({ id: 'alloc-1' })
    await expect(
      actions.allocateInventoryAction({
        orderId: 'ord-1',
        productId: 'prod-1',
        quantity: 10,
        expectedFulfillmentDate: '2026-02-10',
      }),
    ).resolves.toMatchObject({ success: true, data: { id: 'alloc-1' } })
    expect(mockAllocateInventory).toHaveBeenCalledWith(
      expect.objectContaining({ expectedFulfillmentDate: expect.any(Date) }),
    )

    mockAllocateInventory.mockRejectedValueOnce(new Error('allocation exploded'))
    await expect(
      actions.allocateInventoryAction({ orderId: 'ord-1', productId: 'prod-1', quantity: 10 }),
    ).resolves.toMatchObject({ success: false, error: 'allocation exploded' })

    mockFulfillAllocation.mockResolvedValueOnce({ id: 'alloc-2' })
    await expect(actions.fulfillAllocationAction('alloc-2', 4)).resolves.toMatchObject({
      success: true,
      data: { id: 'alloc-2' },
    })

    mockFulfillAllocation.mockRejectedValueOnce(new Error('fulfill exploded'))
    await expect(actions.fulfillAllocationAction('alloc-3', 2)).resolves.toMatchObject({
      success: false,
      error: 'fulfill exploded',
    })

    mockCancelAllocation.mockResolvedValueOnce({ id: 'alloc-4' })
    await expect(actions.cancelAllocationAction('alloc-4')).resolves.toMatchObject({
      success: true,
      data: { id: 'alloc-4' },
    })

    mockCancelAllocation.mockRejectedValueOnce(new Error('cancel exploded'))
    await expect(actions.cancelAllocationAction('alloc-5')).resolves.toMatchObject({
      success: false,
      error: 'cancel exploded',
    })

    mockAutoAllocateOrder.mockResolvedValueOnce([{ id: 'alloc-6' }])
    await expect(actions.autoAllocateOrderAction('ord-2', 'high')).resolves.toMatchObject({
      success: true,
      data: [{ id: 'alloc-6' }],
    })

    mockAutoAllocateOrder.mockRejectedValueOnce(new Error('auto exploded'))
    await expect(actions.autoAllocateOrderAction('ord-3')).resolves.toMatchObject({
      success: false,
      error: 'auto exploded',
    })

    mockGetProductionDashboard.mockResolvedValueOnce({ backlog: [] })
    await expect(actions.getProductionDashboardAction()).resolves.toMatchObject({
      success: true,
      data: { backlog: [] },
    })

    mockGetProductionDashboard.mockRejectedValueOnce(new Error('dashboard exploded'))
    await expect(actions.getProductionDashboardAction()).resolves.toMatchObject({
      success: false,
      error: 'dashboard exploded',
    })
  })

  it('covers non-Error fallback messages across action catch blocks', async () => {
    const actions = await import('@/lib/production-actions')

    mockCreateOrder.mockRejectedValueOnce('not-an-error')
    await expect(actions.createOrderAction({ customerId: 'c', lines: [] })).resolves.toMatchObject({
      success: false,
      error: 'Failed to create order',
    })

    mockGetOrder.mockRejectedValueOnce('not-an-error')
    await expect(actions.getOrderAction('ord-x')).resolves.toMatchObject({
      success: false,
      error: 'Failed to get order',
    })

    mockListOrders.mockRejectedValueOnce('not-an-error')
    await expect(actions.listOrdersAction()).resolves.toMatchObject({
      success: false,
      error: 'Failed to list orders',
    })

    mockAllocateInventory.mockRejectedValueOnce('not-an-error')
    await expect(
      actions.allocateInventoryAction({ orderId: 'ord-x', productId: 'prod-x', quantity: 1 }),
    ).resolves.toMatchObject({ success: false, error: 'Failed to allocate inventory' })

    mockFulfillAllocation.mockRejectedValueOnce('not-an-error')
    await expect(actions.fulfillAllocationAction('alloc-x', 1)).resolves.toMatchObject({
      success: false,
      error: 'Failed to fulfill allocation',
    })

    mockCancelAllocation.mockRejectedValueOnce('not-an-error')
    await expect(actions.cancelAllocationAction('alloc-x')).resolves.toMatchObject({
      success: false,
      error: 'Failed to cancel allocation',
    })

    mockAutoAllocateOrder.mockRejectedValueOnce('not-an-error')
    await expect(actions.autoAllocateOrderAction('ord-x')).resolves.toMatchObject({
      success: false,
      error: 'Failed to auto-allocate order',
    })

    mockGetProductionDashboard.mockRejectedValueOnce('not-an-error')
    await expect(actions.getProductionDashboardAction()).resolves.toMatchObject({
      success: false,
      error: 'Failed to get production dashboard',
    })
  })
})
