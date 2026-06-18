import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoggerInfo,
  qSelect,
  qLimit,
  qInsertReturning,
  qUpdateReturning,
} = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  qSelect: [] as unknown[][],
  qLimit: [] as unknown[][],
  qInsertReturning: [] as unknown[][],
  qUpdateReturning: [] as unknown[][],
}))

const shiftQueue = (queue: unknown[][]) => Promise.resolve((queue.shift() ?? []) as never)

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  ilike: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, segment, index) => text + segment + (values[index] ?? ''), ''),
  ),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    orderBy: vi.fn(() => selectChain),
    limit: vi.fn(() => shiftQueue(qLimit)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      shiftQueue(qSelect).then(resolve, reject),
  }

  const insertAfterValues = {
    returning: vi.fn(() => shiftQueue(qInsertReturning)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject),
  }

  const insertChain = {
    values: vi.fn(() => insertAfterValues),
  }

  const updateAfterWhere = {
    returning: vi.fn(() => shiftQueue(qUpdateReturning)),
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

  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
      delete: vi.fn(() => deleteChain),
    },
    commerceProducts: {
      id: 'id',
      orgId: 'orgId',
      sku: 'sku',
      name: 'name',
      description: 'description',
      category: 'category',
      supplierId: 'supplierId',
      costPrice: 'costPrice',
      basePrice: 'basePrice',
      tags: 'tags',
      status: 'status',
      zohoItemId: 'zohoItemId',
      updatedAt: 'updatedAt',
    },
    commerceInventory: {
      id: 'id',
      orgId: 'orgId',
      productId: 'productId',
      currentStock: 'currentStock',
      allocatedStock: 'allocatedStock',
      availableStock: 'availableStock',
      reorderPoint: 'reorderPoint',
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
    },
    commerceStockMovements: {
      id: 'id',
      orgId: 'orgId',
      productId: 'productId',
      createdAt: 'createdAt',
    },
    commerceSuppliers: {
      id: 'id',
      name: 'name',
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

describe('inventory service slice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T00:00:00.000Z'))
    qSelect.length = 0
    qLimit.length = 0
    qInsertReturning.length = 0
    qUpdateReturning.length = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('covers create/list/update/delete and stock operations', async () => {
    const service = await import('@/lib/inventory-service')

    qLimit.push(
      [],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'prod-1', supplierId: 'sup-1' }],
      [{ id: 'inv-1', productId: 'prod-1', currentStock: 5, allocatedStock: 1, availableStock: 4, reorderPoint: 5 }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'prod-1', costPrice: '2.00' }],
      [{ id: 'inv-1', productId: 'prod-1', currentStock: 5, allocatedStock: 1, availableStock: 4, reorderPoint: 5 }],
      [{ id: 'inv-1', productId: 'prod-1', currentStock: 7, allocatedStock: 1, availableStock: 6, reorderPoint: 5 }],
      [{ id: 'inv-1', productId: 'prod-1', currentStock: 7, allocatedStock: 1, availableStock: 6, reorderPoint: 5 }],
      [{ id: 'mv-1' }],
      [],
    )

    qInsertReturning.push(
      [{ id: 'prod-1', sku: 'SKU-1', supplierId: 'sup-1', costPrice: '2.00', basePrice: '4.00' }],
      [{ id: 'inv-1', productId: 'prod-1', currentStock: 0, allocatedStock: 0, availableStock: 0, reorderPoint: 10 }],
      [{ id: 'mv-1' }],
    )

    qUpdateReturning.push([{ id: 'prod-1', name: 'Paper Plus' }])

    qSelect.push(
      [{ id: 'prod-1', sku: 'SKU-1', name: 'Paper', supplierId: 'sup-1', status: 'active', category: 'office' }],
      [{ id: 'inv-1', productId: 'prod-1', currentStock: 4, allocatedStock: 0, availableStock: 4, reorderPoint: 5 }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'prod-1', sku: 'SKU-1', name: 'Paper', supplierId: 'sup-1', status: 'active', category: 'office' }],
      [{ id: 'inv-1', productId: 'prod-1', currentStock: 4, allocatedStock: 0, availableStock: 4, reorderPoint: 5 }],
      [{ id: 'sup-1', name: 'Supplier One' }],
      [{ id: 'm-1', createdAt: new Date('2026-06-08T00:00:00.000Z') }],
    )

    const created = await service.createProduct({
      orgId: 'org-1',
      sku: 'SKU-1',
      name: 'Paper',
      supplierId: 'sup-1',
      unitCost: 2,
      unitPrice: 4,
    })

    expect(created.product.id).toBe('prod-1')
    expect(created.inventory?.productId).toBe('prod-1')

    const product = await service.getProduct('prod-1')
    expect(product?.supplier?.name).toBe('Supplier One')

    const listed = await service.listProducts({ orgId: 'org-1', search: 'Paper', lowStock: true })
    expect(listed).toHaveLength(1)

    await expect(service.updateProduct('prod-1', { name: 'Paper Plus', tags: ['office'] })).resolves.toMatchObject({ id: 'prod-1' })

    await expect(
      service.recordStockMovement({ orgId: 'org-1', productId: 'prod-1', type: 'in', quantity: 2, userId: 'user-1' }),
    ).resolves.toMatchObject({ id: 'mv-1' })

    await expect(service.reserveStock('prod-1', 100)).rejects.toThrow('Insufficient available stock')
    await expect(service.releaseReservation('prod-1', 1)).resolves.toBe(true)

    await expect(service.deleteProduct('prod-1')).resolves.toBe(true)
  })

  it('covers snapshot and Zoho sync paths', async () => {
    const service = await import('@/lib/inventory-service')

    qSelect.push(
      [
        { id: 'p1', category: 'office', costPrice: '2.00', status: 'active' },
        { id: 'p2', category: 'office', costPrice: '3.00', status: 'active' },
      ],
      [
        { id: 'i1', productId: 'p1', currentStock: 0, allocatedStock: 0, availableStock: 0, reorderPoint: 2 },
        { id: 'i2', productId: 'p2', currentStock: 1, allocatedStock: 0, availableStock: 1, reorderPoint: 2 },
      ],
    )

    qLimit.push(
      [{ id: 'mv-recent' }],
      [{ id: 'prod-z', name: 'Ink', sku: 'INK-1', description: null, basePrice: '10.00', costPrice: '6.00', zohoItemId: null }],
      [{ id: 'inv-z', productId: 'prod-z', currentStock: 9, reorderPoint: 3 }],
      [{ id: 'prod-z', name: 'Ink', sku: 'INK-1', description: null, basePrice: '10.00', costPrice: '6.00', zohoItemId: 'zi-1' }],
      [{ id: 'inv-z', productId: 'prod-z', currentStock: 9, reorderPoint: 3 }],
      [{ id: 'prod-z', zohoItemId: 'zi-1' }],
      [],
    )

    qInsertReturning.push([{ id: 'prod-new' }])
    qUpdateReturning.push([{ id: 'prod-z' }])

    const snapshot = await service.getInventorySnapshot('org-1')
    expect(snapshot.totalProducts).toBe(2)
    expect(snapshot.outOfStockCount).toBe(1)
    expect(snapshot.lowStockCount).toBe(1)
    expect(snapshot.topCategories[0]).toMatchObject({ categoryId: 'office' })

    const inventoryClient = {
      createItem: vi.fn().mockResolvedValue({ item_id: 'zi-1' }),
      updateItem: vi.fn().mockResolvedValue({ item_id: 'zi-1' }),
    }

    await expect(service.syncProductToZoho('prod-z', inventoryClient as never)).resolves.toBe('zi-1')
    await expect(service.syncProductToZoho('prod-z', inventoryClient as never)).resolves.toBe('zi-1')

    await expect(
      service.syncProductFromZoho('org-1', {
        item_id: 'zi-1',
        name: 'Ink',
        status: 'active',
        rate: 12,
        purchase_rate: 7,
        stock_on_hand: 10,
      } as never),
    ).resolves.toMatchObject({ id: 'prod-z' })

    await expect(
      service.syncProductFromZoho('org-1', {
        item_id: 'zi-2',
        sku: 'INK-2',
        name: 'Ink 2',
        status: 'inactive',
      } as never),
    ).resolves.toMatchObject({ id: 'prod-new' })
  })

  it('covers additional fallback and error branches across inventory service', async () => {
    const service = await import('@/lib/inventory-service')

    qLimit.push([{ id: 'dup-1' }])
    await expect(
      service.createProduct({ orgId: 'org-1', sku: 'SKU-1', name: 'Duplicate' }),
    ).rejects.toThrow('already exists')

    qLimit.push([{ id: 'p-no-sup', supplierId: null }], [])
    await expect(service.getProduct('p-no-sup')).resolves.toMatchObject({
      product: { id: 'p-no-sup' },
      supplier: null,
      inventory: null,
    })

    qLimit.push([])
    await expect(service.getProductBySku('org-1', 'MISSING')).resolves.toBeNull()

    qLimit.push([])
    await expect(service.updateProduct('missing-product', { name: 'Nope' })).resolves.toBeNull()

    qLimit.push([{ id: 'mv-exists' }])
    await expect(service.deleteProduct('prod-with-history')).rejects.toThrow('Cannot delete product with stock movement history')

    qLimit.push([])
    await expect(
      service.recordStockMovement({ orgId: 'org-1', productId: 'missing-product', type: 'in', quantity: 1 }),
    ).rejects.toThrow('not found')

    qLimit.push(
      [{ id: 'p-out', costPrice: '3.00' }],
      [{ id: 'inv-out', currentStock: 1, allocatedStock: 0, availableStock: 1 }],
    )
    await expect(
      service.recordStockMovement({ orgId: 'org-1', productId: 'p-out', type: 'out', quantity: 2 }),
    ).rejects.toThrow('Insufficient stock')

    qLimit.push([{ id: 'p-adj', costPrice: '4.00' }], [])
    qInsertReturning.push(
      [{ id: 'inv-adj', currentStock: 0, allocatedStock: 0, availableStock: 0 }],
      [{ id: 'mv-adj' }],
    )
    await expect(
      service.recordStockMovement({ orgId: 'org-1', productId: 'p-adj', type: 'adjustment', quantity: 7 }),
    ).resolves.toMatchObject({ id: 'mv-adj' })

    qLimit.push(
      [{ id: 'p-transfer', costPrice: '5.00' }],
      [{ id: 'inv-transfer', currentStock: 9, allocatedStock: 2, availableStock: 7 }],
    )
    qInsertReturning.push([{ id: 'mv-transfer' }])
    await expect(
      service.recordStockMovement({ orgId: 'org-1', productId: 'p-transfer', type: 'transfer', quantity: 3 }),
    ).resolves.toMatchObject({ id: 'mv-transfer' })

    qLimit.push([])
    await expect(service.reserveStock('missing-inv', 1)).rejects.toThrow('Inventory record not found')

    qLimit.push([])
    await expect(service.releaseReservation('missing-inv', 1)).rejects.toThrow('Inventory record not found')

    qSelect.push([{ id: 'p-low', supplierId: null, name: 'Low Product' }], [], [])
    await expect(service.listProducts({ orgId: 'org-1', lowStock: true })).resolves.toHaveLength(1)

    qSelect.push([])
    qLimit.push([])
    const emptySnapshot = await service.getInventorySnapshot('org-empty')
    expect(emptySnapshot.totalProducts).toBe(0)
    expect(emptySnapshot.totalValue).toBe(0)
    expect(emptySnapshot.topCategories).toEqual([])
  })

  it('covers list/update/history and reservation success branches', async () => {
    const service = await import('@/lib/inventory-service')

    qSelect.push(
      [{ id: 'p-list', supplierId: null, name: 'Paper', status: 'active', category: 'office' }],
      [{ id: 'i-list', productId: 'p-list', currentStock: 10, allocatedStock: 0, availableStock: 10, reorderPoint: 5 }],
      [{ id: 'p-low', supplierId: null, name: 'Low', status: 'active', category: 'office' }],
      [],
    )

    qLimit.push(
      [{ id: 'prod-u' }],
      [{ id: 'inv-reserve', currentStock: 10, allocatedStock: 2, availableStock: 8 }],
      [{ id: 'inv-release', currentStock: 10, allocatedStock: 5, availableStock: 5 }],
      [{ id: 'mv-h' }],
    )

    qUpdateReturning.push([{ id: 'prod-u', status: 'inactive' }])

    const filteredOut = await service.listProducts({
      orgId: 'org-1',
      status: ['active'],
      search: 'Paper',
      categoryId: 'office',
      tags: ['stationery'],
      lowStock: true,
    })
    expect(filteredOut).toEqual([])

    await expect(
      service.updateProduct('prod-u', {
        name: 'Updated Name',
        description: 'Updated Desc',
        categoryId: 'office-updated',
        supplierId: 'sup-2',
        unitCost: 1.25,
        unitPrice: 2.5,
        weight: 0,
        dimensions: undefined,
        status: 'inactive',
        tags: [],
      }),
    ).resolves.toMatchObject({ id: 'prod-u', status: 'inactive' })

    await expect(service.reserveStock('prod-r', 3, 'order', 'ord-1')).resolves.toBe(true)
    await expect(service.releaseReservation('prod-r', 2)).resolves.toBe(true)
    await expect(service.getStockHistory('prod-r')).resolves.toMatchObject([{ id: 'mv-h' }])

    const lowStockProducts = await service.getLowStockProducts('org-1')
    expect(lowStockProducts).toHaveLength(1)
  })

  it('covers stock movement out-success and invalid-type branches', async () => {
    const service = await import('@/lib/inventory-service')

    qLimit.push(
      [{ id: 'p-out-ok', costPrice: '2.00' }],
      [{ id: 'inv-out-ok', currentStock: 5, allocatedStock: 1, availableStock: 4 }],
      [{ id: 'p-invalid', costPrice: '2.00' }],
      [{ id: 'inv-invalid', currentStock: 5, allocatedStock: 1, availableStock: 4 }],
    )
    qInsertReturning.push([{ id: 'mv-out-ok' }])

    await expect(
      service.recordStockMovement({ orgId: 'org-1', productId: 'p-out-ok', type: 'out', quantity: 2 }),
    ).resolves.toMatchObject({ id: 'mv-out-ok' })

    await expect(
      service.recordStockMovement({ orgId: 'org-1', productId: 'p-invalid', type: 'invalid' as never, quantity: 1 }),
    ).rejects.toThrow('Invalid movement type')
  })

  it('covers inventory snapshot uncategorized branch and Zoho edge paths', async () => {
    const service = await import('@/lib/inventory-service')

    qSelect.push(
      [{ id: 'p-uncat', category: null, costPrice: '4.00', status: 'active' }],
      [],
    )
    qLimit.push([{ id: 'mv-recent-2' }])

    const snapshot = await service.getInventorySnapshot('org-uncat')
    expect(snapshot.totalProducts).toBe(1)
    expect(snapshot.outOfStockCount).toBe(1)
    expect(snapshot.topCategories[0]).toMatchObject({ categoryId: 'uncategorized' })

    qLimit.push([])
    await expect(
      service.syncProductToZoho(
        'missing-product',
        {
          createItem: vi.fn(),
          updateItem: vi.fn(),
        } as never,
      ),
    ).rejects.toThrow('not found')

    qLimit.push(
      [{ id: 'prod-noinv', name: 'No Inv', sku: 'NO-INV', description: null, basePrice: '5.00', costPrice: '2.00', zohoItemId: null }],
      [],
    )
    const inventoryClient = {
      createItem: vi.fn().mockResolvedValue({ item_id: 'zi-noinv' }),
      updateItem: vi.fn(),
    }

    await expect(service.syncProductToZoho('prod-noinv', inventoryClient as never)).resolves.toBe('zi-noinv')
    expect(inventoryClient.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ reorder_level: 10, stock_on_hand: 0 }),
    )

    qLimit.push([{ id: 'prod-existing' }], [])
    qUpdateReturning.push([{ id: 'prod-existing', status: 'inactive' }])
    await expect(
      service.syncProductFromZoho('org-1', {
        item_id: 'zi-existing',
        name: 'Existing',
        status: 'archived',
        purchase_rate: 1,
        rate: 2,
      } as never),
    ).resolves.toMatchObject({ id: 'prod-existing', status: 'inactive' })

    qInsertReturning.push([{ id: 'prod-created' }])
    await expect(
      service.syncProductFromZoho(
        'org-1',
        {
          item_id: 'zi-create',
          name: 'Created',
          status: 'active',
          stock_on_hand: 3,
        } as never,
        'sup-z',
      ),
    ).resolves.toMatchObject({ id: 'prod-created' })
  })

  it('covers residual branches for sku lookup, supplier filter, snapshot sorting, and rich movement metadata', async () => {
    const service = await import('@/lib/inventory-service')

    qLimit.push(
      [],
      [{ id: 'prod-rich', sku: 'RICH-1', supplierId: null, costPrice: '1.00', basePrice: '2.00' }],
      [{ id: 'inv-rich', productId: 'prod-rich', currentStock: 0, allocatedStock: 0, availableStock: 0, reorderPoint: 7 }],
      [{ id: 'prod-sku', supplierId: 'sup-22', status: 'active', category: 'office' }],
      [{ id: 'inv-sku', productId: 'prod-sku', currentStock: 3, allocatedStock: 0, availableStock: 3, reorderPoint: 2 }],
      [{ id: 'sup-22', name: 'Supplier 22' }],
      [{ id: 'p-meta', costPrice: '9.00' }],
      [{ id: 'inv-meta', currentStock: 4, allocatedStock: 1, availableStock: 3 }],
    )

    qInsertReturning.push(
      [{ id: 'prod-rich', sku: 'RICH-1', supplierId: null }],
      [{ id: 'inv-rich', productId: 'prod-rich', reorderPoint: 7 }],
      [{ id: 'mv-meta' }],
    )

    qSelect.push(
      [{ id: 'p-supplier', supplierId: 'sup-22', name: 'With Supplier', status: 'active', category: 'office' }],
      [{ id: 'i-supplier', productId: 'p-supplier', currentStock: 9, allocatedStock: 0, availableStock: 9, reorderPoint: 4 }],
      [{ id: 'sup-22', name: 'Supplier 22' }],
      [
        { id: 'cat-a', category: 'a', costPrice: '2.00', status: 'active' },
        { id: 'cat-b', category: 'b', costPrice: '5.00', status: 'active' },
      ],
      [
        { id: 'i-a', productId: 'cat-a', currentStock: 1, allocatedStock: 0, availableStock: 1, reorderPoint: 10 },
        { id: 'i-b', productId: 'cat-b', currentStock: 3, allocatedStock: 0, availableStock: 3, reorderPoint: 1 },
      ],
    )

    await expect(
      service.createProduct({
        orgId: 'org-1',
        sku: 'RICH-1',
        name: 'Rich Product',
        description: 'Detailed',
        categoryId: 'custom',
        supplierId: undefined,
        unitCost: undefined,
        unitPrice: undefined,
        weight: 1.5,
        dimensions: { length: 1, width: 2, height: 3 },
        tags: ['a', 'b'],
        reorderPoint: 7,
      }),
    ).resolves.toMatchObject({
      product: { id: 'prod-rich' },
      inventory: { reorderPoint: 7 },
    })

    const bySku = await service.getProductBySku('org-1', 'RICH-SKU')
    expect(bySku).not.toBeNull()

    const supplierFiltered = await service.listProducts({ orgId: 'org-1', supplierId: 'sup-22' })
    expect(supplierFiltered).toHaveLength(1)
    expect(supplierFiltered[0].supplier).toMatchObject({ id: 'sup-22' })

    const snapshot = await service.getInventorySnapshot('org-1')
    expect(snapshot.totalProducts).toBe(2)
    expect(snapshot.topCategories).toHaveLength(2)

    await expect(
      service.recordStockMovement({
        orgId: 'org-1',
        productId: 'p-meta',
        type: 'in',
        quantity: 2,
        reason: 'restock',
        referenceType: 'po',
        referenceId: 'po-1',
        costPerUnit: 12,
        notes: 'priority',
      }),
    ).resolves.toMatchObject({ id: 'mv-meta' })
  })

  it('covers update dimensions-object path, tags-undefined path, and Zoho rate fallbacks on existing products', async () => {
    const service = await import('@/lib/inventory-service')

    qLimit.push(
      [{ id: 'prod-dim' }],
      [{ id: 'prod-existing-rate-fallback' }],
    )
    qUpdateReturning.push(
      [{ id: 'prod-dim', name: 'Dim Updated' }],
      [{ id: 'prod-existing-rate-fallback', status: 'inactive' }],
    )

    await expect(
      service.updateProduct('prod-dim', {
        name: 'Dim Updated',
        dimensions: { length: 10, width: 20, height: 30 },
      }),
    ).resolves.toMatchObject({ id: 'prod-dim' })

    await expect(
      service.syncProductFromZoho('org-1', {
        item_id: 'zi-fallback-rates',
        name: 'Fallback Rates',
        status: 'inactive',
      } as never),
    ).resolves.toMatchObject({ id: 'prod-existing-rate-fallback', status: 'inactive' })
  })

  it('covers final list/update branch edges for empty products, supplier-map miss, name undefined, and weight conversion', async () => {
    const service = await import('@/lib/inventory-service')

    qSelect.push(
      [],
      [{ id: 'p-miss-supplier', supplierId: 'sup-miss', name: 'P', status: 'active', category: 'office' }],
      [{ id: 'i-miss-supplier', productId: 'p-miss-supplier', currentStock: 2, allocatedStock: 0, availableStock: 2, reorderPoint: 1 }],
      [],
    )

    qLimit.push(
      [{ id: 'prod-u-no-name' }],
      [{ id: 'prod-u-weight' }],
    )
    qUpdateReturning.push(
      [{ id: 'prod-u-no-name' }],
      [{ id: 'prod-u-weight' }],
    )

    await expect(service.listProducts({ orgId: 'org-empty' })).resolves.toEqual([])

    const withMissingSupplier = await service.listProducts({ orgId: 'org-1' })
    expect(withMissingSupplier).toHaveLength(1)
    expect(withMissingSupplier[0].supplier).toBeNull()

    await expect(
      service.updateProduct('prod-u-no-name', {
        description: 'desc only',
      }),
    ).resolves.toMatchObject({ id: 'prod-u-no-name' })

    await expect(
      service.updateProduct('prod-u-weight', {
        weight: 2,
      }),
    ).resolves.toMatchObject({ id: 'prod-u-weight' })
  })
})
