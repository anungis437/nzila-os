import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoggerInfo,
  mockAttemptPOTransition,
  mockSelect,
  mockLimit,
  mockInsertReturning,
  mockUpdateReturning,
} = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockAttemptPOTransition: vi.fn(),
  mockSelect: [] as unknown[][],
  mockLimit: [] as unknown[][],
  mockInsertReturning: [] as unknown[][],
  mockUpdateReturning: [] as unknown[][],
}))

const shiftQueue = (queue: unknown[][]) => Promise.resolve((queue.shift() ?? []) as never)

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, segment, index) => text + segment + (values[index] ?? ''), ''),
  ),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    leftJoin: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    orderBy: vi.fn(() => selectChain),
    limit: vi.fn(() => shiftQueue(mockLimit)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      shiftQueue(mockSelect).then(resolve, reject),
  }

  const insertAfterValues = {
    returning: vi.fn(() => shiftQueue(mockInsertReturning)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject),
  }

  const insertChain = {
    values: vi.fn(() => insertAfterValues),
  }

  const updateAfterWhere = {
    returning: vi.fn(() => shiftQueue(mockUpdateReturning)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject),
  }

  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateAfterWhere),
  }

  const deleteChain = {
    where: vi.fn(() => Promise.resolve(undefined)),
  }

  const tx = {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
  }

  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
      delete: vi.fn(() => deleteChain),
      transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
    commercePurchaseOrders: {
      id: 'id',
      orgId: 'orgId',
      supplierId: 'supplierId',
      ref: 'ref',
      status: 'status',
      createdAt: 'createdAt',
      notes: 'notes',
      total: 'total',
      shippingCost: 'shippingCost',
      subtotal: 'subtotal',
      expectedDeliveryDate: 'expectedDeliveryDate',
      updatedAt: 'updatedAt',
      zohoPoId: 'zohoPoId',
    },
    commercePurchaseOrderLines: {
      id: 'id',
      orgId: 'orgId',
      purchaseOrderId: 'purchaseOrderId',
      productId: 'productId',
      description: 'description',
      sku: 'sku',
      quantity: 'quantity',
      unitCost: 'unitCost',
      lineTotal: 'lineTotal',
      sortOrder: 'sortOrder',
      quantityReceived: 'quantityReceived',
      orderId: 'orderId',
    },
    commerceSuppliers: {
      id: 'id',
      name: 'name',
    },
    commerceInventory: {
      id: 'id',
      orgId: 'orgId',
      productId: 'productId',
      currentStock: 'currentStock',
      allocatedStock: 'allocatedStock',
      availableStock: 'availableStock',
      reorderPoint: 'reorderPoint',
    },
    commerceStockMovements: {
      id: 'id',
    },
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/workflows/po-workflow', () => ({
  attemptPOTransition: mockAttemptPOTransition,
}))

vi.mock('@/lib/workflows/errors', () => ({
  InvalidWorkflowTransitionError: class InvalidWorkflowTransitionError extends Error {
    constructor(entity: string, from: string, to: string) {
      super(`${entity}:${from}->${to}`)
    }
  },
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_SETTINGS: {
    poPrefix: 'PO',
  },
}))

describe('po service slice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T00:00:00.000Z'))
    mockSelect.length = 0
    mockLimit.length = 0
    mockInsertReturning.length = 0
    mockUpdateReturning.length = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('covers create/get/list/update/send/cancel flows', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push(
      [{ ref: 'PO-2026-007' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'draft', shippingCost: '5.00', subtotal: '25.00', ref: 'PO-2026-008', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'draft', shippingCost: '5.00', subtotal: '25.00', ref: 'PO-2026-008', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'draft', shippingCost: '5.00', subtotal: '25.00', ref: 'PO-2026-008', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'sent', shippingCost: '5.00', subtotal: '25.00', ref: 'PO-2026-008', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'sent', shippingCost: '5.00', subtotal: '25.00', ref: 'PO-2026-008', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'sent', shippingCost: '5.00', subtotal: '25.00', ref: 'PO-2026-008', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
    )

    mockSelect.push(
      [{ id: 'line-1', purchaseOrderId: 'po-1', sortOrder: 0 }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'draft', createdAt: new Date('2026-06-08T00:00:00.000Z') }],
      [{ id: 'line-1', purchaseOrderId: 'po-1', sortOrder: 0 }],
      [{ id: 'po-1', supplierId: 'sup-1', status: 'draft', createdAt: new Date('2026-06-08T00:00:00.000Z') }],
      [{ id: 'line-1', purchaseOrderId: 'po-1', sortOrder: 0 }],
      [{ id: 'line-1', purchaseOrderId: 'po-1', sortOrder: 0 }],
      [{ id: 'line-1', purchaseOrderId: 'po-1', sortOrder: 0 }],
      [{ id: 'line-1', purchaseOrderId: 'po-1', sortOrder: 0 }],
    )

    mockInsertReturning.push(
      [
        {
          id: 'po-1',
          ref: 'PO-2026-008',
          supplierId: 'sup-1',
          status: 'draft',
          orgId: 'org-1',
          shippingCost: '5.00',
          subtotal: '25.00',
          total: '30.00',
        },
      ],
      [{ id: 'line-1' }],
    )

    const created = await service.createPurchaseOrder({
      orgId: 'org-1',
      supplierId: 'sup-1',
      createdBy: 'user-1',
      shippingCost: 5,
      lines: [{ description: 'Paper', quantity: 10, unitCost: 2.5 }],
    })

    expect(created.po.ref).toBe('PO-2026-008')
    expect(created.lines).toHaveLength(1)
    expect(created.supplier?.name).toBe('Supplier One')

    const fetched = await service.getPurchaseOrder('po-1')
    expect(fetched?.lines).toHaveLength(1)

    const listed = await service.listPurchaseOrders({ orgId: 'org-1', search: 'PO-2026' })
    expect(listed).toHaveLength(1)

    const updated = await service.updatePurchaseOrder('po-1', { shippingCost: 7 })
    expect(updated?.po.id).toBe('po-1')

    mockAttemptPOTransition.mockReturnValueOnce({ ok: true })
    await expect(service.sendPurchaseOrder('po-1')).resolves.toMatchObject({ po: { status: 'sent' } })

    mockAttemptPOTransition.mockReturnValueOnce({ ok: false })
    await expect(service.cancelPurchaseOrder('po-1')).rejects.toThrow('purchase-order')
  })

  it('covers sync and summary analytics', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push(
      [
        {
          id: 'po-z',
          supplierId: 'sup-z',
          ref: 'PO-2026-099',
          createdAt: new Date('2026-06-08T00:00:00.000Z'),
          expectedDeliveryDate: new Date('2026-06-15T00:00:00.000Z'),
          zohoPoId: null,
        },
      ],
      [{ id: 'sup-z', name: 'Zeta Supplier', zohoVendorId: 'vendor-1' }],
      [
        {
          id: 'po-z',
          supplierId: 'sup-z',
          ref: 'PO-2026-099',
          createdAt: new Date('2026-06-08T00:00:00.000Z'),
          expectedDeliveryDate: new Date('2026-06-15T00:00:00.000Z'),
          zohoPoId: 'zpo-1',
        },
      ],
      [{ id: 'sup-z', name: 'Zeta Supplier', zohoVendorId: 'vendor-1' }],
    )

    mockSelect.push(
      [{ id: 'line-z', description: 'Ink', quantity: 2, unitCost: '10.00', lineTotal: '20.00', purchaseOrderId: 'po-z', sortOrder: 0 }],
      [{ id: 'line-z', description: 'Ink', quantity: 2, unitCost: '10.00', lineTotal: '20.00', purchaseOrderId: 'po-z', sortOrder: 0 }],
      [
        {
          po: { id: 'po-a', status: 'sent', total: '100.00', supplierId: 'sup-z' },
          supplier: { id: 'sup-z', name: 'Zeta Supplier' },
        },
        {
          po: { id: 'po-b', status: 'received', total: '50.00', supplierId: 'sup-z' },
          supplier: { id: 'sup-z', name: 'Zeta Supplier' },
        },
      ],
    )

    const booksClient = {
      createPurchaseOrder: vi.fn().mockResolvedValue({ purchaseorder_id: 'zpo-1' }),
      updatePurchaseOrder: vi.fn().mockResolvedValue({ purchaseorder_id: 'zpo-1' }),
    }

    await expect(service.syncPOToZoho('po-z', booksClient as never)).resolves.toBe('zpo-1')
    await expect(service.syncPOToZoho('po-z', booksClient as never)).resolves.toBe('zpo-1')

    const summary = await service.getPOSummary('org-1')
    expect(summary.totalPOs).toBe(2)
    expect(summary.totalValue).toBe(150)
    expect(summary.byStatus.sent.count).toBe(1)
    expect(summary.byStatus.received.count).toBe(1)
    expect(summary.topSuppliers[0]).toMatchObject({ supplierId: 'sup-z', poCount: 2, totalValue: 150 })
  })

  it('covers cancel success and supplier-less summary branches', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push(
      [{ id: 'po-cancel', supplierId: 'sup-cancel', status: 'sent', shippingCost: '0.00', subtotal: '10.00', ref: 'PO-2026-900', orgId: 'org-1' }],
      [{ id: 'sup-cancel', name: 'Cancel Supplier' }],
      [{ id: 'po-cancel', supplierId: 'sup-cancel', status: 'sent', shippingCost: '0.00', subtotal: '10.00', ref: 'PO-2026-900', orgId: 'org-1' }],
      [{ id: 'sup-cancel', name: 'Cancel Supplier' }],
    )
    mockSelect.push(
      [{ id: 'line-cancel', purchaseOrderId: 'po-cancel', sortOrder: 0 }],
      [{ id: 'line-cancel', purchaseOrderId: 'po-cancel', sortOrder: 0 }],
    )
    mockAttemptPOTransition.mockReturnValueOnce({ ok: true })

    await expect(service.cancelPurchaseOrder('po-cancel')).resolves.toMatchObject({ po: { id: 'po-cancel' } })

    mockSelect.push([
      {
        po: { id: 'po-nosup', status: 'draft', total: '25.00', supplierId: 'sup-nosup' },
        supplier: null,
      },
    ])

    const summary = await service.getPOSummary('org-1')
    expect(summary.totalPOs).toBe(1)
    expect(summary.topSuppliers).toHaveLength(0)
  })

  it('covers receive line guard rails and inventory side effects', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push([])
    await expect(service.receivePOLine({ lineId: 'missing', quantityReceived: 1, receivedBy: 'u-1' })).rejects.toThrow(
      'PO line missing not found',
    )

    mockLimit.push(
      [{ id: 'line-1', purchaseOrderId: 'po-1', orgId: 'org-1', productId: 'prod-1', quantity: 5, quantityReceived: 0 }],
      [],
    )
    await expect(service.receivePOLine({ lineId: 'line-1', quantityReceived: 1, receivedBy: 'u-1' })).rejects.toThrow(
      'PO not found for line line-1',
    )

    mockLimit.push(
      [{ id: 'line-2', purchaseOrderId: 'po-2', orgId: 'org-1', productId: 'prod-1', quantity: 5, quantityReceived: 0 }],
      [{ id: 'po-2', ref: 'PO-2026-500', status: 'draft' }],
    )
    await expect(service.receivePOLine({ lineId: 'line-2', quantityReceived: 1, receivedBy: 'u-1' })).rejects.toThrow(
      'Cannot receive items for PO in draft status',
    )

    mockLimit.push(
      [{ id: 'line-3', purchaseOrderId: 'po-3', orgId: 'org-1', productId: 'prod-1', quantity: 2, quantityReceived: 1 }],
      [{ id: 'po-3', ref: 'PO-2026-501', status: 'sent' }],
    )
    await expect(service.receivePOLine({ lineId: 'line-3', quantityReceived: 2, receivedBy: 'u-1' })).rejects.toThrow(
      'Cannot receive more than ordered quantity (2)',
    )

    mockLimit.push(
      [{ id: 'line-4', purchaseOrderId: 'po-4', orgId: 'org-1', productId: 'prod-2', quantity: 3, quantityReceived: 1 }],
      [{ id: 'po-4', ref: 'PO-2026-502', status: 'partial_received' }],
      [],
      [{ id: 'line-4', purchaseOrderId: 'po-4', quantity: 3, quantityReceived: 3 }],
    )
    mockInsertReturning.push([{ id: 'inv-2', orgId: 'org-1', productId: 'prod-2', currentStock: 0, allocatedStock: 0, availableStock: 0, reorderPoint: 5 }])
    mockSelect.push([{ id: 'line-4', quantity: 3, quantityReceived: 1 }])

    await expect(
      service.receivePOLine({ lineId: 'line-4', quantityReceived: 2, receivedBy: 'u-1', notes: 'dock received' }),
    ).resolves.toMatchObject({ id: 'line-4', quantityReceived: 3 })
  })

  it('covers receive line no-product and inventory-existing stock status branches', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push(
      [{ id: 'line-np', purchaseOrderId: 'po-np', orgId: 'org-1', productId: null, quantity: 5, quantityReceived: 0 }],
      [{ id: 'po-np', ref: 'PO-2026-700', status: 'sent' }],
      [{ id: 'line-np', purchaseOrderId: 'po-np', quantity: 5, quantityReceived: 0 }],
    )
    mockSelect.push([{ id: 'line-np', quantity: 5, quantityReceived: 0 }])

    await expect(
      service.receivePOLine({ lineId: 'line-np', quantityReceived: 0, receivedBy: 'u-2', notes: 'no-op receive' }),
    ).resolves.toMatchObject({ id: 'line-np', quantityReceived: 0 })

    mockLimit.push(
      [{ id: 'line-out', purchaseOrderId: 'po-out', orgId: 'org-1', productId: 'prod-out', quantity: 10, quantityReceived: 0 }],
      [{ id: 'po-out', ref: 'PO-2026-701', status: 'sent' }],
      [{ id: 'inv-out', orgId: 'org-1', productId: 'prod-out', currentStock: 1, allocatedStock: 5, availableStock: -4, reorderPoint: 2 }],
      [{ id: 'line-out', purchaseOrderId: 'po-out', quantity: 10, quantityReceived: 2 }],
    )
    mockSelect.push([{ id: 'line-out', quantity: 10, quantityReceived: 0 }])

    await expect(
      service.receivePOLine({ lineId: 'line-out', quantityReceived: 2, receivedBy: 'u-2', notes: 'short shipment' }),
    ).resolves.toMatchObject({ id: 'line-out', quantityReceived: 2 })

    mockLimit.push(
      [{ id: 'line-in', purchaseOrderId: 'po-in', orgId: 'org-1', productId: 'prod-in', quantity: 10, quantityReceived: 0 }],
      [{ id: 'po-in', ref: 'PO-2026-702', status: 'sent' }],
      [{ id: 'inv-in', orgId: 'org-1', productId: 'prod-in', currentStock: 10, allocatedStock: 1, availableStock: 9, reorderPoint: 3 }],
      [{ id: 'line-in', purchaseOrderId: 'po-in', quantity: 10, quantityReceived: 2 }],
    )
    mockSelect.push([{ id: 'line-in', quantity: 10, quantityReceived: 0 }])

    await expect(
      service.receivePOLine({ lineId: 'line-in', quantityReceived: 2, receivedBy: 'u-2', notes: 'healthy stock' }),
    ).resolves.toMatchObject({ id: 'line-in', quantityReceived: 2 })
  })

  it('covers missing and invalid transition/sync guard branches', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push([])
    await expect(service.getPurchaseOrder('po-missing')).resolves.toBeNull()

    mockLimit.push([])
    await expect(service.updatePurchaseOrder('po-missing', { notes: 'noop' })).resolves.toBeNull()

    mockLimit.push(
      [{ id: 'po-closed', supplierId: 'sup-1', status: 'received', shippingCost: '0.00', subtotal: '10.00', ref: 'PO-2026-800', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
    )
    mockSelect.push([{ id: 'line-closed', purchaseOrderId: 'po-closed', sortOrder: 0 }])
    await expect(service.updatePurchaseOrder('po-closed', { notes: 'should fail' })).rejects.toThrow(
      'Cannot update PO in received status',
    )

    mockLimit.push([])
    await expect(service.sendPurchaseOrder('po-send-missing')).resolves.toBeNull()

    mockLimit.push(
      [{ id: 'po-send-invalid', supplierId: 'sup-1', status: 'draft', shippingCost: '0.00', subtotal: '10.00', ref: 'PO-2026-801', orgId: 'org-1' }],
      [{ id: 'sup-1', name: 'Supplier One' }],
    )
    mockSelect.push([{ id: 'line-send-invalid', purchaseOrderId: 'po-send-invalid', sortOrder: 0 }])
    mockAttemptPOTransition.mockReturnValueOnce({ ok: false })
    await expect(service.sendPurchaseOrder('po-send-invalid')).rejects.toThrow('purchase-order')

    mockLimit.push([])
    await expect(service.cancelPurchaseOrder('po-cancel-missing')).resolves.toBeNull()

    await expect(service.syncPOToZoho('po-sync-missing', { createPurchaseOrder: vi.fn(), updatePurchaseOrder: vi.fn() } as never)).rejects.toThrow(
      'PO po-sync-missing not found',
    )

    mockLimit.push(
      [{ id: 'po-no-vendor', supplierId: 'sup-nv', status: 'draft', ref: 'PO-2026-802', createdAt: new Date('2026-06-08T00:00:00.000Z'), expectedDeliveryDate: null, zohoPoId: null }],
      [{ id: 'sup-nv', name: 'No Vendor', zohoVendorId: null }],
    )
    mockSelect.push([{ id: 'line-no-vendor', description: 'Paper', quantity: 1, unitCost: '5.00', lineTotal: '5.00', purchaseOrderId: 'po-no-vendor', sortOrder: 0 }])

    await expect(
      service.syncPOToZoho('po-no-vendor', { createPurchaseOrder: vi.fn(), updatePurchaseOrder: vi.fn() } as never),
    ).rejects.toThrow('not linked to Zoho')
  })

  it('covers no-seed ref generation and filtered list branches', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push(
      [],
      [{ id: 'sup-x', name: 'Supplier X' }],
      [{ id: 'sup-x', name: 'Supplier X' }],
    )
    mockInsertReturning.push(
      [
        {
          id: 'po-x',
          ref: 'PO-2026-001',
          supplierId: 'sup-x',
          orgId: 'org-1',
          shippingCost: '0.00',
          subtotal: '10.00',
          total: '10.00',
        },
      ],
      [{ id: 'line-x', purchaseOrderId: 'po-x', sortOrder: 0 }],
    )

    const created = await service.createPurchaseOrder({
      orgId: 'org-1',
      supplierId: 'sup-x',
      createdBy: 'user-x',
      lines: [{ description: 'Widget', quantity: 2, unitCost: 5 }],
    })
    expect(created.po.ref).toBe('PO-2026-001')

    mockSelect.push(
      [
        {
          id: 'po-x',
          supplierId: 'sup-x',
          createdAt: new Date('2026-06-08T00:00:00.000Z'),
          status: 'draft',
        },
      ],
      [{ id: 'line-x', purchaseOrderId: 'po-x', sortOrder: 0 }],
    )

    const listed = await service.listPurchaseOrders({
      orgId: 'org-1',
      status: ['draft', 'sent'],
      supplierId: 'sup-x',
      fromDate: new Date('2026-01-01T00:00:00.000Z'),
      toDate: new Date('2026-12-31T00:00:00.000Z'),
    })

    expect(listed).toHaveLength(1)
    expect(listed[0].supplier?.id).toBe('sup-x')
  })

  it('covers PO delta branches for nullish fields, defaults, and dated summary filters', async () => {
    const service = await import('@/lib/po-service')

    mockLimit.push(
      [{ id: 'po-u', supplierId: 'sup-u', status: 'draft', shippingCost: '7.00', subtotal: '13.00', ref: 'PO-2026-900', orgId: 'org-1' }],
      [{ id: 'sup-u', name: 'Supplier U' }],
      [{ id: 'po-u', supplierId: 'sup-u', status: 'sent', shippingCost: '7.00', subtotal: '7.00', ref: 'PO-2026-900', orgId: 'org-1' }],
      [{ id: 'sup-u', name: 'Supplier U' }],
    )
    mockSelect.push(
      [{ id: 'line-old', purchaseOrderId: 'po-u', sortOrder: 0 }],
      [{ id: 'line-new', purchaseOrderId: 'po-u', sortOrder: 0, quantity: 2 }],
    )

    await expect(
      service.updatePurchaseOrder('po-u', {
        lines: [{ description: 'No refs', quantity: 2, unitCost: 3.5 }],
        expectedDeliveryDate: new Date('2026-06-30T00:00:00.000Z'),
        notes: 'line refresh',
        status: 'sent',
      }),
    ).resolves.toMatchObject({ po: { id: 'po-u' } })

    mockSelect.push([
      {
        id: 'po-list-one',
        supplierId: 'sup-u',
        createdAt: new Date('2026-06-08T00:00:00.000Z'),
        status: 'draft',
      },
    ], [{ id: 'line-list', purchaseOrderId: 'po-list-one', sortOrder: 0 }])
    mockLimit.push([{ id: 'sup-u', name: 'Supplier U' }])
    await expect(service.listPurchaseOrders({ orgId: 'org-1', status: 'draft' })).resolves.toHaveLength(1)

    mockLimit.push(
      [{ id: 'line-r', purchaseOrderId: 'po-r', orgId: 'org-1', productId: 'prod-r', quantity: 5, quantityReceived: 0 }],
      [{ id: 'po-r', ref: 'PO-2026-901', status: 'sent' }],
      [{ id: 'inv-r', orgId: 'org-1', productId: 'prod-r', currentStock: 0, allocatedStock: 0, availableStock: 0, reorderPoint: 1 }],
      [{ id: 'line-r', purchaseOrderId: 'po-r', quantity: 5, quantityReceived: 1 }],
    )
    mockSelect.push([
      { id: 'line-r', quantity: 5, quantityReceived: 0 },
      { id: 'line-other', quantity: 2, quantityReceived: 0 },
    ])
    await expect(
      service.receivePOLine({ lineId: 'line-r', quantityReceived: 1, receivedBy: 'u-r' }),
    ).resolves.toMatchObject({ id: 'line-r', quantityReceived: 1 })

    mockLimit.push(
      [{ id: 'po-nosup', supplierId: 'sup-missing', ref: 'PO-2026-902', createdAt: new Date('2026-06-08T00:00:00.000Z'), expectedDeliveryDate: null, zohoPoId: null }],
      [],
    )
    mockSelect.push([{ id: 'line-nosup', description: undefined, quantity: 1, unitCost: '2.00', lineTotal: '2.00', purchaseOrderId: 'po-nosup', sortOrder: 0 }])
    await expect(
      service.syncPOToZoho('po-nosup', { createPurchaseOrder: vi.fn(), updatePurchaseOrder: vi.fn() } as never),
    ).rejects.toThrow('sup-missing')

    mockLimit.push(
      [{ id: 'po-desc', supplierId: 'sup-z', ref: 'PO-2026-903', createdAt: new Date('2026-06-08T00:00:00.000Z'), expectedDeliveryDate: null, zohoPoId: null }],
      [{ id: 'sup-z', name: 'Supplier Z', zohoVendorId: 'vz-900' }],
    )
    mockSelect.push([{ id: 'line-desc', description: undefined, quantity: 1, unitCost: '2.00', lineTotal: '2.00', purchaseOrderId: 'po-desc', sortOrder: 0 }])
    await expect(
      service.syncPOToZoho('po-desc', { createPurchaseOrder: vi.fn().mockResolvedValue({ purchaseorder_id: 'zpo-900' }), updatePurchaseOrder: vi.fn() } as never),
    ).resolves.toBe('zpo-900')

    mockSelect.push([])
    await expect(
      service.getPOSummary(
        'org-1',
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T00:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ totalPOs: 0, totalValue: 0 })
  })
})
