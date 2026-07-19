import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSelectWhere,
  mockSelectOrderBy,
  mockSelectLimit,
  mockInsertReturning,
  mockUpdateReturning,
  mockAttemptOrderTransition,
  mockCalculateTaxes,
} = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  mockSelectOrderBy: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockAttemptOrderTransition: vi.fn(),
  mockCalculateTaxes: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  ne: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, segment, index) => text + segment + (values[index] ?? ''), ''),
  ),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: mockSelectWhere,
    orderBy: mockSelectOrderBy,
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
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    },
    commerceCustomers: {
      id: 'id',
      name: 'name',
      orgId: 'orgId',
    },
    commerceInventory: {
      id: 'id',
      allocatedStock: 'allocatedStock',
      availableStock: 'availableStock',
      currentStock: 'currentStock',
      productId: 'productId',
      updatedAt: 'updatedAt',
    },
    commerceMandateAllocations: {
      id: 'id',
      notes: 'notes',
      orderId: 'orderId',
      orgId: 'orgId',
      expectedFulfillmentDate: 'expectedFulfillmentDate',
      priority: 'priority',
      productId: 'productId',
      quantityAllocated: 'quantityAllocated',
      quantityFulfilled: 'quantityFulfilled',
      quantityReserved: 'quantityReserved',
      status: 'status',
      inventoryId: 'inventoryId',
      updatedAt: 'updatedAt',
    },
    commerceOrderLines: {
      description: 'description',
      discount: 'discount',
      lineTotal: 'lineTotal',
      orderId: 'orderId',
      quantity: 'quantity',
      sortOrder: 'sortOrder',
      sku: 'sku',
      unitPrice: 'unitPrice',
    },
    commerceOrders: {
      createdAt: 'createdAt',
      createdBy: 'createdBy',
      customerId: 'customerId',
      id: 'id',
      metadata: 'metadata',
      notes: 'notes',
      orgId: 'orgId',
      quoteId: 'quoteId',
      ref: 'ref',
      status: 'status',
      subtotal: 'subtotal',
      taxTotal: 'taxTotal',
      total: 'total',
      updatedAt: 'updatedAt',
      currency: 'currency',
      shippingAddress: 'shippingAddress',
      billingAddress: 'billingAddress',
    },
    commerceProducts: {
      id: 'id',
      name: 'name',
      orgId: 'orgId',
      sku: 'sku',
    },
    commerceStockMovements: {
      id: 'id',
    },
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/lib/workflows/order-workflow', () => ({
  attemptOrderTransition: mockAttemptOrderTransition,
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_SETTINGS: {
    currency: 'CAD',
    orderPrefix: 'MOCA',
  },
}))

vi.mock('@nzila/platform-commerce-org/pricing', () => ({
  calculateTaxes: mockCalculateTaxes,
}))

describe('production service slice', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T00:00:00.000Z'))
    vi.clearAllMocks()
    mockSelectWhere.mockReset()
    mockSelectOrderBy.mockReset()
    mockSelectLimit.mockReset()
    mockInsertReturning.mockReset()
    mockUpdateReturning.mockReset()
    mockAttemptOrderTransition.mockReset()
    mockCalculateTaxes.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('covers createOrder and getOrder', async () => {
    const { createOrder, getOrder } = await import('@/lib/production-service')

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ ref: 'MOCA-2026-0003' }])
    mockInsertReturning
      .mockResolvedValueOnce([
        {
          id: 'order-1',
          ref: 'MOCA-2026-0004',
          orgId: 'org-1',
          customerId: 'cust-1',
          status: 'created',
        },
      ])
      .mockResolvedValueOnce([{ id: 'line-1' }, { id: 'line-2' }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cust-1', name: 'Acme Ltd' }])
    mockCalculateTaxes.mockReturnValue({ totalTax: '1.50', totalWithTax: '16.50' })

    const created = await createOrder({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [
        { productId: 'p-1', description: 'Widget', sku: 'W-1', quantity: 2, unitPrice: 5 },
        { productId: 'p-2', description: 'Gadget', quantity: 1, unitPrice: 10, discount: 10 },
      ],
      userId: 'user-1',
    })

    expect(created.order.ref).toBe('MOCA-2026-0004')
    expect(created.customer).toEqual({ id: 'cust-1', name: 'Acme Ltd' })
    expect(created.lines).toHaveLength(2)
    expect(mockCalculateTaxes).toHaveBeenCalledWith(19, expect.any(Object))

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-1', customerId: 'cust-1' }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cust-1', name: 'Acme Ltd' }])
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'line-1' }])
    mockSelectWhere.mockResolvedValueOnce([{ id: 'alloc-1' }])

    await expect(getOrder('order-1')).resolves.toMatchObject({
      order: { id: 'order-1' },
      customer: { id: 'cust-1' },
      lines: [{ id: 'line-1' }],
      allocations: [{ id: 'alloc-1' }],
    })
  })

  it('covers lifecycle transitions and validation failures', async () => {
    const {
      confirmOrder,
      startFulfillment,
      markOrderShipped,
      completeOrder,
      cancelOrder,
    } = await import('@/lib/production-service')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-1', ref: 'MOCA-2026-0004', status: 'created' }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: true })
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'order-1', status: 'confirmed' }])
    await expect(confirmOrder('order-1')).resolves.toMatchObject({ status: 'confirmed' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-1', ref: 'MOCA-2026-0004', status: 'confirmed' }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: true })
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'order-1', status: 'fulfillment' }])
    await expect(startFulfillment('order-1')).resolves.toMatchObject({ status: 'fulfillment' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-1', ref: 'MOCA-2026-0004', status: 'fulfillment', metadata: {} }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: true })
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'order-1', status: 'shipped' }])
    await expect(
      markOrderShipped('order-1', { carrier: 'UPS', trackingNumber: '1Z123' }),
    ).resolves.toMatchObject({ status: 'shipped' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-1', ref: 'MOCA-2026-0004', status: 'delivered' }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: true })
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'order-1', status: 'completed' }])
    await expect(completeOrder('order-1')).resolves.toMatchObject({ status: 'completed' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-1', ref: 'MOCA-2026-0004', status: 'confirmed', metadata: {} }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: true })
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'order-1', status: 'cancelled' }])
    await expect(cancelOrder('order-1', 'customer request')).resolves.toMatchObject({ status: 'cancelled' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-err', ref: 'MOCA-2026-0004', status: 'created' }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: false })
    await expect(confirmOrder('order-err')).rejects.toThrow('order')
  })

  it('covers allocation flows', async () => {
    const { allocateInventory, fulfillAllocation, cancelAllocation } = await import('@/lib/production-service')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'product-1', name: 'Widget', sku: 'W-1' }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'inv-1', productId: 'product-1', availableStock: 3, allocatedStock: 2, currentStock: 10 }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-1', orgId: 'org-1' }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'alloc-1', status: 'reserved', quantityAllocated: 3, quantityReserved: 5, quantityFulfilled: 0 }])

    await expect(
      allocateInventory({ orderId: 'order-1', productId: 'product-1', quantity: 5, priority: 'high' }),
    ).resolves.toMatchObject({ status: 'reserved' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'alloc-1',
        orgId: 'org-1',
        orderId: 'order-1',
        productId: 'product-1',
        inventoryId: 'inv-1',
        quantityAllocated: 4,
        quantityFulfilled: 1,
        quantityReserved: 5,
        status: 'allocated',
      },
    ])
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'alloc-1', status: 'allocated', quantityFulfilled: 2 }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'stock-1' }])
    await expect(fulfillAllocation('alloc-1', 1)).resolves.toMatchObject({ status: 'allocated' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'alloc-2',
        inventoryId: 'inv-1',
        quantityAllocated: 4,
        quantityFulfilled: 1,
        status: 'allocated',
      },
    ])
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'alloc-2', status: 'cancelled' }])
    await expect(cancelAllocation('alloc-2')).resolves.toMatchObject({ status: 'cancelled' })
  })

  it('covers dashboard and listing queries', async () => {
    const { getProductionDashboard, listOrders } = await import('@/lib/production-service')

    mockSelectWhere.mockResolvedValueOnce([
      { id: 'order-1', customerId: 'cust-1', createdAt: new Date('2026-06-01T00:00:00.000Z'), ref: 'MOCA-2026-0001', status: 'confirmed' },
      { id: 'order-2', customerId: 'cust-2', createdAt: new Date('2026-06-03T00:00:00.000Z'), ref: 'MOCA-2026-0002', status: 'fulfillment' },
      { id: 'order-3', customerId: 'cust-3', createdAt: new Date('2026-06-05T00:00:00.000Z'), ref: 'MOCA-2026-0003', status: 'needs_attention' },
    ])
    mockSelectWhere.mockResolvedValueOnce([
      {
        id: 'alloc-1',
        orderId: 'order-1',
        productId: 'product-1',
        quantityReserved: 5,
        quantityAllocated: 3,
        quantityFulfilled: 1,
        status: 'allocated',
        priority: 'high',
        expectedFulfillmentDate: new Date('2026-06-15T00:00:00.000Z'),
      },
      {
        id: 'alloc-2',
        orderId: 'order-2',
        productId: 'product-2',
        quantityReserved: 2,
        quantityAllocated: 2,
        quantityFulfilled: 2,
        status: 'fulfilled',
        priority: 'medium',
        expectedFulfillmentDate: new Date('2026-06-10T00:00:00.000Z'),
      },
    ])
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'product-1', name: 'Widget', sku: 'W-1' },
      { id: 'product-2', name: 'Gadget', sku: 'G-1' },
    ])
    mockSelectWhere.mockResolvedValueOnce([
      { productId: 'product-1', availableStock: 8 },
      { productId: 'product-2', availableStock: 2 },
    ])
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'cust-1', name: 'Acme' },
      { id: 'cust-2', name: 'Bravo' },
      { id: 'cust-3', name: 'Charlie' },
    ])

    await expect(getProductionDashboard('org-1')).resolves.toMatchObject({
      summary: {
        totalOrders: 3,
        ordersInFulfillment: 1,
        ordersNeedingAttention: 1,
        totalAllocations: 2,
        shortages: 1,
        pendingFulfillments: 1,
      },
      schedule: [
        expect.objectContaining({ orderId: 'order-1', quantityShortage: 2 }),
        expect.objectContaining({ orderId: 'order-2', quantityShortage: 0 }),
      ],
      criticalShortages: [
        expect.objectContaining({ productId: 'product-1', shortageQty: 2, affectedOrders: 1 }),
      ],
      upcomingDeadlines: [
        expect.objectContaining({ orderId: 'order-2', daysRemaining: 2 }),
        expect.objectContaining({ orderId: 'order-1', daysRemaining: 7 }),
      ],
    })

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([
      { id: 'order-1', customerId: 'cust-1', status: 'confirmed' },
    ])
    mockSelectWhere.mockResolvedValueOnce([{ id: 'line-1', orderId: 'order-1' }])
    mockSelectWhere.mockResolvedValueOnce([{ id: 'alloc-1', orderId: 'order-1' }])
    mockSelectWhere.mockResolvedValueOnce([{ id: 'cust-1', name: 'Acme' }])

    await expect(
      listOrders({ orgId: 'org-1', status: ['confirmed', 'fulfillment'], search: 'Acme' }),
    ).resolves.toEqual([
      {
        order: { id: 'order-1', customerId: 'cust-1', status: 'confirmed' },
        customer: { id: 'cust-1', name: 'Acme' },
        lines: [{ id: 'line-1', orderId: 'order-1' }],
        allocations: [{ id: 'alloc-1', orderId: 'order-1' }],
      },
    ])
  })

  it('covers additional not-found and no-op failure branches', async () => {
    const {
      getOrder,
      startFulfillment,
      allocateInventory,
      fulfillAllocation,
      cancelAllocation,
    } = await import('@/lib/production-service')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(getOrder('missing-order')).resolves.toBeNull()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(startFulfillment('missing-order')).rejects.toThrow('Order not found')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(
      allocateInventory({ orderId: 'order-1', productId: 'missing-product', quantity: 1 }),
    ).rejects.toThrow('Product missing-product not found')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'product-2' }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(
      allocateInventory({ orderId: 'order-1', productId: 'product-2', quantity: 1 }),
    ).rejects.toThrow('No inventory record for product product-2')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'product-3' }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      { id: 'inv-3', productId: 'product-3', availableStock: 5, allocatedStock: 0 },
    ])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(
      allocateInventory({ orderId: 'missing-order', productId: 'product-3', quantity: 1 }),
    ).rejects.toThrow('Order missing-order not found')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(fulfillAllocation('missing-alloc', 1)).rejects.toThrow('Allocation missing-alloc not found')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'alloc-noop',
        quantityAllocated: 2,
        quantityFulfilled: 2,
      },
    ])
    await expect(fulfillAllocation('alloc-noop', 1)).rejects.toThrow('No items available to fulfill')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(cancelAllocation('missing-cancel')).rejects.toThrow('Allocation not found or already fulfilled')
  })

  it('covers empty dashboard/list branches and invalid lifecycle transitions', async () => {
    const { getProductionDashboard, listOrders, startFulfillment, markOrderShipped, completeOrder, cancelOrder } = await import('@/lib/production-service')

    mockSelectWhere.mockResolvedValueOnce([])
    await expect(getProductionDashboard('org-empty')).resolves.toMatchObject({
      summary: {
        totalOrders: 0,
        ordersInFulfillment: 0,
        ordersNeedingAttention: 0,
        totalAllocations: 0,
        shortages: 0,
        pendingFulfillments: 0,
      },
      schedule: [],
      criticalShortages: [],
      upcomingDeadlines: [],
    })

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([])
    await expect(listOrders({ orgId: 'org-empty' })).resolves.toEqual([])

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'order-2', customerId: 'cust-2', status: 'created' }])
    mockSelectWhere.mockResolvedValueOnce([{ id: 'line-2', orderId: 'order-2' }])
    mockSelectWhere.mockResolvedValueOnce([{ id: 'alloc-2', orderId: 'order-2' }])
    mockSelectWhere.mockResolvedValueOnce([{ id: 'cust-2', name: 'Bravo' }])
    await expect(
      listOrders({
        orgId: 'org-1',
        status: 'confirmed',
        customerId: 'cust-2',
        dateFrom: new Date('2026-06-01T00:00:00.000Z'),
        dateTo: new Date('2026-06-30T00:00:00.000Z'),
      }),
    ).resolves.toHaveLength(1)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-10', ref: 'MOCA-2026-0010', status: 'created' }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: false })
    await expect(startFulfillment('order-10')).rejects.toThrow('order')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-11', ref: 'MOCA-2026-0011', status: 'confirmed', metadata: {} }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: false })
    await expect(markOrderShipped('order-11', { carrier: 'UPS' })).rejects.toThrow('order')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-12', ref: 'MOCA-2026-0012', status: 'shipped' }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: false })
    await expect(completeOrder('order-12')).rejects.toThrow('order')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-13', ref: 'MOCA-2026-0013', status: 'confirmed', metadata: {} }])
    mockAttemptOrderTransition.mockReturnValueOnce({ ok: false })
    await expect(cancelOrder('order-13', 'oops')).rejects.toThrow('order')
  })

  it('covers auto-allocation default priority and list detail fallbacks', async () => {
    const service = await import('@/lib/production-service')
    vi.spyOn(service, 'allocateInventory').mockRejectedValueOnce(new Error('allocation failed'))

    mockSelectWhere
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ orderBy: mockSelectOrderBy })
      .mockResolvedValueOnce([])
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ limit: mockSelectLimit })

    mockSelectOrderBy.mockResolvedValueOnce([
      { sku: null, quantity: 1 },
      { sku: 'SKU-A', quantity: 2 },
      { sku: 'SKU-B', quantity: 1 },
      { sku: 'SKU-C', quantity: 3 },
    ])

    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'order-auto', orgId: 'org-1', customerId: 'cust-1', status: 'confirmed' }])
      .mockResolvedValueOnce([{ id: 'cust-1', name: 'Customer One' }])
      .mockResolvedValueOnce([{ id: 'prod-a' }])
      .mockResolvedValueOnce([{ id: 'existing-a' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'prod-c' }])
      .mockResolvedValueOnce([])

    await expect(service.autoAllocateOrder('order-auto')).resolves.toEqual([])

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([
      { id: 'order-fallback', customerId: 'cust-missing', status: 'confirmed' },
    ])
    mockSelectWhere.mockResolvedValueOnce([])
    mockSelectWhere.mockResolvedValueOnce([])
    mockSelectWhere.mockResolvedValueOnce([])

    await expect(service.listOrders({ orgId: 'org-1' })).resolves.toEqual([
      {
        order: { id: 'order-fallback', customerId: 'cust-missing', status: 'confirmed' },
        customer: undefined,
        lines: [],
        allocations: [],
      },
    ])
  })

  it('covers remaining transition guards and dashboard fallback branches', async () => {
    const {
      createOrder,
      confirmOrder,
      markOrderShipped,
      completeOrder,
      cancelOrder,
      allocateInventory,
      fulfillAllocation,
      autoAllocateOrder,
      getProductionDashboard,
    } = await import('@/lib/production-service')

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(confirmOrder('missing-confirm')).rejects.toThrow('Order not found')

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    mockInsertReturning.mockResolvedValueOnce([
      { id: 'order-new-1', ref: 'MOCA-2026-0001', orgId: 'org-1', customerId: 'cust-1', status: 'created' },
    ])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'line-new-1' }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cust-1', name: 'Customer One' }])
    mockCalculateTaxes.mockReturnValue({ totalTax: '0.00', totalWithTax: '10.00' })
    await expect(
      createOrder({
        orgId: 'org-1',
        customerId: 'cust-1',
        userId: 'u-1',
        lines: [{ productId: 'p1', description: 'Desc', quantity: 1, unitPrice: 10 }],
      }),
    ).resolves.toMatchObject({ order: { id: 'order-new-1' } })

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ ref: 'BROKEN-ORDER-REF' }])
    mockInsertReturning.mockResolvedValueOnce([
      { id: 'order-new-2', ref: 'MOCA-2026-0001', orgId: 'org-1', customerId: 'cust-1', status: 'created' },
    ])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'line-new-2' }])
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cust-1', name: 'Customer One' }])
    mockCalculateTaxes.mockReturnValue({ totalTax: '0.00', totalWithTax: '10.00' })
    await expect(
      createOrder({
        orgId: 'org-1',
        customerId: 'cust-1',
        userId: 'u-1',
        lines: [{ productId: 'p1', description: 'Desc', quantity: 1, unitPrice: 10 }],
      }),
    ).resolves.toMatchObject({ order: { id: 'order-new-2' } })

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(markOrderShipped('missing-ship')).rejects.toThrow('Order not found')

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(completeOrder('missing-complete')).rejects.toThrow('Order not found')

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(cancelOrder('missing-cancel-2')).rejects.toThrow('Order not found')

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'prod-def', orgId: 'org-1' }])
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      { id: 'inv-def', productId: 'prod-def', availableStock: 3, allocatedStock: 0 },
    ])
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-def', orgId: 'org-1', status: 'confirmed' }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'alloc-def', status: 'reserved' }])
    await expect(
      allocateInventory({ orderId: 'order-def', productId: 'prod-def', quantity: 5 }),
    ).resolves.toMatchObject({ id: 'alloc-def' })

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'prod-full', orgId: 'org-1' }])
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      { id: 'inv-full', productId: 'prod-full', availableStock: 9, allocatedStock: 0 },
    ])
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'order-full', orgId: 'org-1', status: 'confirmed' }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'alloc-full', status: 'allocated' }])
    await expect(
      allocateInventory({ orderId: 'order-full', productId: 'prod-full', quantity: 5 }),
    ).resolves.toMatchObject({ id: 'alloc-full' })

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'alloc-partial',
        orgId: 'org-1',
        orderId: 'order-def',
        productId: 'prod-def',
        inventoryId: 'inv-def',
        quantityAllocated: 5,
        quantityFulfilled: 1,
        quantityReserved: 10,
      },
    ])
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'alloc-partial', status: 'allocated' }])
    await expect(fulfillAllocation('alloc-partial', 1)).resolves.toMatchObject({ id: 'alloc-partial' })

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'alloc-fullfill',
        orgId: 'org-1',
        orderId: 'order-full',
        productId: 'prod-full',
        inventoryId: 'inv-full',
        quantityAllocated: 5,
        quantityFulfilled: 0,
        quantityReserved: 5,
      },
    ])
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'alloc-fullfill', status: 'fulfilled' }])
    await expect(fulfillAllocation('alloc-fullfill', 5)).resolves.toMatchObject({ id: 'alloc-fullfill' })

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(autoAllocateOrder('missing-auto')).rejects.toThrow('not found')

    mockSelectWhere
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ limit: mockSelectLimit })
      .mockReturnValueOnce({ orderBy: mockSelectOrderBy })
      .mockResolvedValueOnce([])
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'order-invalid', customerId: 'cust-1', orgId: 'org-1', status: 'created' }])
      .mockResolvedValueOnce([{ id: 'cust-1', name: 'Customer One' }])
    mockSelectOrderBy.mockResolvedValueOnce([])
    await expect(autoAllocateOrder('order-invalid')).rejects.toThrow('must be confirmed or in fulfillment')

    mockSelectWhere.mockResolvedValueOnce([
      {
        id: 'order-1',
        ref: 'MOCA-2026-0201',
        customerId: 'cust-none',
        status: 'confirmed',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        id: 'order-2',
        ref: 'MOCA-2026-0202',
        customerId: 'cust-none',
        status: 'confirmed',
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ])
    mockSelectWhere.mockResolvedValueOnce([
      {
        orderId: 'order-missing',
        productId: 'prod-shared',
        quantityReserved: 5,
        quantityAllocated: 2,
        quantityFulfilled: 0,
        priority: 'high',
        status: 'reserved',
        expectedFulfillmentDate: null,
      },
      {
        orderId: 'order-1',
        productId: 'prod-shared',
        quantityReserved: 3,
        quantityAllocated: 1,
        quantityFulfilled: 0,
        priority: 'low',
        status: 'reserved',
        expectedFulfillmentDate: null,
      },
    ])
    mockSelectWhere.mockResolvedValueOnce([])
    mockSelectWhere.mockResolvedValueOnce([])
    mockSelectWhere.mockResolvedValueOnce([])

    const dashboard = await getProductionDashboard('org-1')
    expect(dashboard.schedule.length).toBe(2)
    expect(dashboard.schedule[0]).toMatchObject({ productName: '', sku: '', stockAvailable: 0 })
    expect(dashboard.criticalShortages[0]).toMatchObject({ productId: 'prod-shared', affectedOrders: 2 })
    expect(dashboard.upcomingDeadlines.find((d) => d.orderId === 'order-2')?.percentComplete).toBe(0)
  })
})
