import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { qSelect, qLimit, qInsertReturning, qUpdateReturning, mockLoggerInfo } = vi.hoisted(() => ({
  qSelect: [] as unknown[][],
  qLimit: [] as unknown[][],
  qInsertReturning: [] as unknown[][],
  qUpdateReturning: [] as unknown[][],
  mockLoggerInfo: vi.fn(),
}))

const shiftQueue = (queue: unknown[][]) => Promise.resolve((queue.shift() ?? []) as never)

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  ilike: vi.fn(() => ({})),
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
    commerceSuppliers: {
      id: 'id',
      orgId: 'orgId',
      name: 'name',
      status: 'status',
      contactName: 'contactName',
      email: 'email',
      tags: 'tags',
      rating: 'rating',
      leadTimeDays: 'leadTimeDays',
      zohoVendorId: 'zohoVendorId',
      updatedAt: 'updatedAt',
    },
    commercePurchaseOrders: {
      id: 'id',
      supplierId: 'supplierId',
      total: 'total',
      createdAt: 'createdAt',
      status: 'status',
      sentAt: 'sentAt',
      actualDeliveryDate: 'actualDeliveryDate',
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

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_PAYMENT_POLICY: {
    defaultPaymentTerms: 'NET 30',
    defaultLeadTimeDays: 14,
  },
}))

describe('supplier service slice', () => {
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

  it('covers CRUD and Zoho sync branches', async () => {
    const service = await import('@/lib/supplier-service')

    qInsertReturning.push(
      [{ id: 'sup-1', name: 'Alpha Supply', status: 'active' }],
      [{ id: 'sup-new', name: 'New Vendor' }],
    )

    qLimit.push(
      [{ id: 'sup-1', name: 'Alpha Supply', leadTimeDays: 10, rating: '4.5', status: 'active' }],
      [{ id: 'sup-1', name: 'Alpha Supply', leadTimeDays: 10, rating: '4.5', status: 'active' }],
      [{ id: 'sup-1', name: 'Alpha Supply', leadTimeDays: 10, rating: '4.5', status: 'active' }],
      [{ id: 'sup-1', name: 'Alpha Supply', leadTimeDays: 10, rating: '4.5', status: 'active' }],
      [{ id: 'sup-dummy' }],
      [{ id: 'po-existing' }],
      [{ id: 'sup-z1', name: 'Zeta One', zohoVendorId: null, paymentTerms: 'NET 30', email: 'a@b.c', phone: '555' }],
      [{ id: 'sup-z2', name: 'Zeta Two', zohoVendorId: 'vz-2', paymentTerms: 'NET 15', email: 'x@y.z', phone: '444' }],
      [{ id: 'sup-existing', name: 'Existing', zohoVendorId: 'vz-3' }],
      [],
    )

    qSelect.push(
      [
        {
          id: 'po-1',
          supplierId: 'sup-1',
          total: '100.00',
          status: 'received',
          sentAt: new Date('2026-06-01T00:00:00.000Z'),
          actualDeliveryDate: new Date('2026-06-06T00:00:00.000Z'),
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
      [{ id: 'sup-1', name: 'Alpha Supply', leadTimeDays: 10, rating: '4.5', status: 'active' }],
      [{ id: 'po-1', supplierId: 'sup-1', total: '100.00', status: 'received', createdAt: new Date('2026-06-01T00:00:00.000Z'), sentAt: new Date('2026-06-01T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-06T00:00:00.000Z') }],
    )

    qUpdateReturning.push(
      [{ id: 'sup-1', name: 'Alpha Updated' }],
      [{ id: 'sup-1', name: 'Alpha Name Only' }],
      [{ id: 'sup-1', name: 'Alpha Contact Only' }],
      [{ id: 'sup-existing', name: 'Existing Updated' }],
    )

    const created = await service.createSupplier({ orgId: 'org-1', name: 'Alpha Supply' })
    expect(created.id).toBe('sup-1')

    const fetched = await service.getSupplier('sup-1')
    expect(fetched?.stats.totalPOs).toBe(1)
    expect(fetched?.stats.averageLeadTime).toBe(5)

    const listed = await service.listSuppliers({ orgId: 'org-1', search: 'Alpha' })
    expect(listed).toHaveLength(1)

    await expect(service.updateSupplier('sup-1', { name: 'Alpha Updated', rating: 4.2 })).resolves.toMatchObject({
      id: 'sup-1',
    })

    await expect(service.updateSupplier('sup-1', { name: 'Alpha Name Only' })).resolves.toMatchObject({
      id: 'sup-1',
    })

    await expect(service.updateSupplier('sup-1', { contactName: 'Alpha Contact Only' })).resolves.toMatchObject({
      id: 'sup-1',
    })

    await expect(service.deleteSupplier('sup-1')).rejects.toThrow('Cannot delete supplier with existing purchase orders')

    const booksClient = {
      createVendor: vi.fn().mockResolvedValue({ vendor_id: 'vz-1' }),
      updateVendor: vi.fn().mockResolvedValue({ vendor_id: 'vz-2' }),
    }

    await expect(service.syncSupplierToZoho('sup-z1', booksClient as never)).resolves.toBe('vz-1')
    await expect(service.syncSupplierToZoho('sup-z2', booksClient as never)).resolves.toBe('vz-2')

    await expect(
      service.syncSupplierFromZoho('org-1', {
        vendor_id: 'vz-3',
        contact_name: 'Existing Updated',
        payment_terms: 45,
      } as never),
    ).resolves.toMatchObject({ id: 'sup-existing' })

    await expect(
      service.syncSupplierFromZoho('org-1', {
        vendor_id: 'vz-4',
        contact_name: 'New Vendor',
        payment_terms: 30,
      } as never),
    ).resolves.toMatchObject({ id: 'sup-new' })
  })

  it('covers manual and balanced ranking strategies', async () => {
    const service = await import('@/lib/supplier-service')

    qSelect.push(
      [
        { id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 },
        { id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 },
      ],
      [{ id: 'po-a1', supplierId: 'sup-a', total: '50.00', status: 'received', createdAt: new Date('2026-06-01T00:00:00.000Z'), sentAt: new Date('2026-06-01T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-03T00:00:00.000Z') }],
      [{ id: 'po-b1', supplierId: 'sup-b', total: '100.00', status: 'received', createdAt: new Date('2026-06-02T00:00:00.000Z'), sentAt: new Date('2026-06-02T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-08T00:00:00.000Z') }],
      [
        { id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 },
        { id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 },
      ],
      [{ id: 'po-a1', supplierId: 'sup-a', total: '50.00', status: 'received', createdAt: new Date('2026-06-01T00:00:00.000Z'), sentAt: new Date('2026-06-01T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-03T00:00:00.000Z') }],
      [{ id: 'po-b1', supplierId: 'sup-b', total: '100.00', status: 'received', createdAt: new Date('2026-06-02T00:00:00.000Z'), sentAt: new Date('2026-06-02T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-08T00:00:00.000Z') }],
    )

    qLimit.push(
      [{ id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 }],
      [{ id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 }],
      [{ id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 }],
      [{ id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 }],
    )

    const manual = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: ['sup-b'],
      supplierSelectionStrategy: 'MANUAL',
      qualityWeight: 0.3,
      leadTimeWeight: 0.3,
      costWeight: 0.4,
    })

    expect(manual[0].supplier.id).toBe('sup-b')
    expect(manual[0].isPreferred).toBe(true)

    const balanced = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: ['sup-a'],
      supplierSelectionStrategy: 'BALANCED',
      qualityWeight: 0.3,
      leadTimeWeight: 0.3,
      costWeight: 0.4,
    })

    expect(balanced).toHaveLength(2)
    expect(balanced[0].score).toBeGreaterThanOrEqual(balanced[1].score)
  })

  it('allows deleting a supplier without purchase orders', async () => {
    const service = await import('@/lib/supplier-service')

    qLimit.push([])
    await expect(service.deleteSupplier('sup-empty')).resolves.toBe(true)
  })

  it('covers missing supplier paths and LOWEST_COST/FASTEST ranking branches', async () => {
    const service = await import('@/lib/supplier-service')

    qLimit.push([], [], [])
    await expect(service.getSupplier('missing-supplier')).resolves.toBeNull()
    await expect(service.updateSupplier('missing-supplier', { name: 'X' })).resolves.toBeNull()
    await expect(
      service.syncSupplierToZoho('missing-supplier', { createVendor: vi.fn(), updateVendor: vi.fn() } as never),
    ).rejects.toThrow('not found')

    qSelect.push([])
    const emptyRank = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: [],
      supplierSelectionStrategy: 'LOWEST_COST',
      qualityWeight: 0.3,
      leadTimeWeight: 0.3,
      costWeight: 0.4,
    })
    expect(emptyRank).toEqual([])

    qSelect.push(
      [
        { id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 },
        { id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 },
      ],
      [{ id: 'po-a1', supplierId: 'sup-a', total: '20.00', status: 'received', createdAt: new Date('2026-06-01T00:00:00.000Z'), sentAt: new Date('2026-06-01T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-08T00:00:00.000Z') }],
      [{ id: 'po-b1', supplierId: 'sup-b', total: '100.00', status: 'received', createdAt: new Date('2026-06-02T00:00:00.000Z'), sentAt: new Date('2026-06-02T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-04T00:00:00.000Z') }],
    )
    qLimit.push(
      [{ id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 }],
      [{ id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 }],
    )

    const lowestCost = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: [],
      supplierSelectionStrategy: 'LOWEST_COST',
      qualityWeight: 0.3,
      leadTimeWeight: 0.3,
      costWeight: 0.4,
    })
    expect(lowestCost[0].supplier.id).toBe('sup-a')

    qSelect.push(
      [
        { id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 },
        { id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 },
      ],
      [{ id: 'po-a2', supplierId: 'sup-a', total: '50.00', status: 'received', createdAt: new Date('2026-06-01T00:00:00.000Z'), sentAt: new Date('2026-06-01T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-08T00:00:00.000Z') }],
      [{ id: 'po-b2', supplierId: 'sup-b', total: '50.00', status: 'received', createdAt: new Date('2026-06-02T00:00:00.000Z'), sentAt: new Date('2026-06-02T00:00:00.000Z'), actualDeliveryDate: new Date('2026-06-03T00:00:00.000Z') }],
    )
    qLimit.push(
      [{ id: 'sup-a', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 8 }],
      [{ id: 'sup-b', name: 'Beta', status: 'active', rating: '5.0', leadTimeDays: 12 }],
    )

    const fastest = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: [],
      supplierSelectionStrategy: 'FASTEST',
      qualityWeight: 0.3,
      leadTimeWeight: 0.3,
      costWeight: 0.4,
    })
    expect(fastest[0].supplier.id).toBe('sup-b')
  })

  it('covers comprehensive update fields, list null-skip branch, and zoho import fallbacks', async () => {
    const service = await import('@/lib/supplier-service')

    qLimit.push([{ id: 'sup-full', name: 'Full Supplier', status: 'active' }])
    qUpdateReturning.push([{ id: 'sup-full', name: 'Renamed Supplier', status: 'blocked' }])
    await expect(
      service.updateSupplier('sup-full', {
        name: 'Renamed Supplier',
        contactName: 'Contact Name',
        email: 'supplier@example.com',
        phone: '555-0101',
        address: { city: 'Montreal' },
        paymentTerms: 'NET 60',
        leadTimeDays: 21,
        rating: 4.6,
        status: 'blocked',
        notes: 'updated',
        tags: ['priority'],
      }),
    ).resolves.toMatchObject({ id: 'sup-full', status: 'blocked' })

    qSelect.push([{ id: 'sup-maybe', name: 'Maybe Supplier', status: 'active' }])
    qLimit.push([])
    await expect(service.listSuppliers({ orgId: 'org-1', tags: ['priority'] })).resolves.toEqual([])

    qLimit.push([])
    qInsertReturning.push([{ id: 'sup-fallback', name: 'Unknown', paymentTerms: 'NET 30' }])
    await expect(
      service.syncSupplierFromZoho('org-1', {
        vendor_id: 'z-fallback',
      } as never),
    ).resolves.toMatchObject({ id: 'sup-fallback', name: 'Unknown' })
  })

  it('covers ranking default fallbacks and zoho update unknown-name branch', async () => {
    const service = await import('@/lib/supplier-service')

    qLimit.push([{ id: 'sup-u', name: 'Existing Unknown', zohoVendorId: 'vz-u' }])
    qUpdateReturning.push([{ id: 'sup-u', name: 'Unknown' }])
    await expect(
      service.syncSupplierFromZoho('org-1', {
        vendor_id: 'vz-u',
      } as never),
    ).resolves.toMatchObject({ id: 'sup-u', name: 'Unknown' })

    qSelect.push(
      [
        { id: 'sup-r1', name: 'Rank One', status: 'active', rating: null, leadTimeDays: null },
        { id: 'sup-r2', name: 'Rank Two', status: 'active', rating: null, leadTimeDays: null },
      ],
      [],
      [],
    )
    qLimit.push(
      [{ id: 'sup-r1', name: 'Rank One', status: 'active', rating: null, leadTimeDays: null }],
      [{ id: 'sup-r2', name: 'Rank Two', status: 'active', rating: null, leadTimeDays: null }],
    )

    const ranked = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: ['sup-r1'],
      supplierSelectionStrategy: 'BALANCED',
      qualityWeight: 0.4,
      leadTimeWeight: 0.3,
      costWeight: 0.3,
    })

    expect(ranked).toHaveLength(2)
    expect(ranked.find((entry) => entry.supplier.id === 'sup-r1')?.isPreferred).toBe(true)
  })

  it('covers supplier delta branches for status filter normalization, Zoho null fields, and ranking edge math', async () => {
    const service = await import('@/lib/supplier-service')

    qSelect.push(
      [{ id: 'sup-one', name: 'Solo', status: 'active', rating: '4.0', leadTimeDays: 10 }],
      [],
    )
    qLimit.push([{ id: 'sup-one', name: 'Solo', status: 'active', rating: '4.0', leadTimeDays: 10 }])
    await expect(service.listSuppliers({ orgId: 'org-1', status: 'active' })).resolves.toHaveLength(1)

    qLimit.push([{ id: 'sup-null', name: 'Null Contact', email: null, phone: null, paymentTerms: null, zohoVendorId: null }])
    await expect(
      service.syncSupplierToZoho('sup-null', { createVendor: vi.fn().mockResolvedValue({ vendor_id: 'vz-null' }), updateVendor: vi.fn() } as never),
    ).resolves.toBe('vz-null')

    qSelect.push(
      [
        { id: 'sup-m1', name: 'Bravo', status: 'active', rating: '4.0', leadTimeDays: 9 },
        { id: 'sup-m2', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 9 },
      ],
      [],
      [],
    )
    qLimit.push(
      [{ id: 'sup-m1', name: 'Bravo', status: 'active', rating: '4.0', leadTimeDays: 9 }],
      [{ id: 'sup-m2', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 9 }],
    )

    const manualTie = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: ['sup-m1', 'sup-m2'],
      supplierSelectionStrategy: 'MANUAL',
      qualityWeight: 0.3,
      leadTimeWeight: 0.3,
      costWeight: 0.4,
    })
    expect(manualTie.map((r) => r.supplier.id)).toEqual(['sup-m2', 'sup-m1'])

    qSelect.push(
      [
        { id: 'sup-n1', name: 'NaN One', status: 'active', rating: '3.0', leadTimeDays: 10 },
        { id: 'sup-n2', name: 'NaN Two', status: 'active', rating: '4.0', leadTimeDays: 8 },
      ],
      [{ id: 'po-n1', supplierId: 'sup-n1', total: 'abc', status: 'received', createdAt: new Date('2026-06-01T00:00:00.000Z') }],
      [{ id: 'po-n2', supplierId: 'sup-n2', total: '10.00', status: 'received', createdAt: new Date('2026-06-02T00:00:00.000Z') }],
    )
    qLimit.push(
      [{ id: 'sup-n1', name: 'NaN One', status: 'active', rating: '3.0', leadTimeDays: 10 }],
      [{ id: 'sup-n2', name: 'NaN Two', status: 'active', rating: '4.0', leadTimeDays: 8 }],
    )

    const balancedEdge = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: [],
      supplierSelectionStrategy: 'BALANCED',
      qualityWeight: 0.4,
      leadTimeWeight: 0.3,
      costWeight: 0.3,
    })
    expect(balancedEdge).toHaveLength(2)
  })

  it('covers supplier residual branches for status-array filters and manual preference comparator', async () => {
    const service = await import('@/lib/supplier-service')

    qSelect.push(
      [
        { id: 'sup-sa', name: 'Status A', status: 'active', rating: '4.0', leadTimeDays: 10 },
        { id: 'sup-sb', name: 'Status B', status: 'blocked', rating: '3.5', leadTimeDays: 12 },
      ],
      [],
      [],
    )
    qLimit.push(
      [{ id: 'sup-sa', name: 'Status A', status: 'active', rating: '4.0', leadTimeDays: 10 }],
      [{ id: 'sup-sb', name: 'Status B', status: 'blocked', rating: '3.5', leadTimeDays: 12 }],
    )
    await expect(service.listSuppliers({ orgId: 'org-1', status: ['active', 'blocked'] })).resolves.toHaveLength(2)

    qSelect.push(
      [
        { id: 'sup-p1', name: 'Zulu', status: 'active', rating: '4.0', leadTimeDays: 10 },
        { id: 'sup-p2', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 10 },
      ],
      [],
      [],
    )
    qLimit.push(
      [{ id: 'sup-p1', name: 'Zulu', status: 'active', rating: '4.0', leadTimeDays: 10 }],
      [{ id: 'sup-p2', name: 'Alpha', status: 'active', rating: '4.0', leadTimeDays: 10 }],
    )

    const manual = await service.rankSuppliers('org-1', {
      orgId: 'org-1',
      preferredSupplierIds: ['sup-p1'],
      supplierSelectionStrategy: 'MANUAL',
      qualityWeight: 0.3,
      leadTimeWeight: 0.3,
      costWeight: 0.4,
    })
    expect(manual[0].supplier.id).toBe('sup-p1')
  })
})
