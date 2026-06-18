import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSelectWhere,
  mockSelectLimit,
  mockSelectOrderBy,
  mockInsertReturning,
  mockUpdateReturning,
} = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockSelectOrderBy: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateReturning: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  ilike: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  sql: vi.fn((x: TemplateStringsArray) => x.join('')),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => mockSelectWhere()),
    limit: mockSelectLimit,
    orderBy: mockSelectOrderBy,
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
    commerceCustomers: { id: 'id', orgId: 'orgId', email: 'email', name: 'name', createdAt: 'createdAt' },
    commerceOrders: { id: 'id', orgId: 'orgId', status: 'status', paymentStatus: 'paymentStatus', createdAt: 'createdAt' },
    commerceOrderLines: { orderId: 'orderId', sortOrder: 'sortOrder' },
    flowPayments: { id: 'id', orgId: 'orgId', orderId: 'orderId', status: 'status', createdAt: 'createdAt', amountPaid: 'amountPaid' },
    commercePurchaseOrders: { id: 'id', orgId: 'orgId', orderId: 'orderId', status: 'status', expectedDeliveryDate: 'expectedDeliveryDate', createdAt: 'createdAt' },
    commercePurchaseOrderLines: { purchaseOrderId: 'purchaseOrderId', sortOrder: 'sortOrder' },
    flowProductionJobs: { id: 'id', orgId: 'orgId', orderId: 'orderId', status: 'status', createdAt: 'createdAt' },
    commerceQuotes: { id: 'id', orgId: 'orgId', status: 'status', createdAt: 'createdAt' },
    commerceQuoteLines: { quoteId: 'quoteId', sortOrder: 'sortOrder' },
    commerceSuppliers: { id: 'id', orgId: 'orgId', createdAt: 'createdAt' },
    flowVendorProductLinks: { vendorId: 'vendorId', productId: 'productId', orgId: 'orgId', preferenceRank: 'preferenceRank' },
    commerceInvoices: { id: 'id', orgId: 'orgId', orderId: 'orderId', status: 'status', createdAt: 'createdAt' },
    commerceInvoiceLines: { invoiceId: 'invoiceId', sortOrder: 'sortOrder' },
  }
})

describe('repository layer slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('covers customer/order/payment repositories', async () => {
    const { customerRepo, orderRepo, paymentRepo } = await import('@/lib/repositories')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'c-1' }])
    expect(await customerRepo.findById('c-1', 'org-1')).toEqual({ id: 'c-1' })

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'c-2' }])
    expect((await customerRepo.findAll('org-1')).length).toBe(1)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'c-3' }])
    expect(await customerRepo.findByEmail('x@example.com', 'org-1')).toEqual({ id: 'c-3' })

    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'c-4' }])
    expect((await customerRepo.search('org-1', 'Jane')).length).toBe(1)

    mockInsertReturning.mockResolvedValueOnce([{ id: 'c-5' }])
    expect((await customerRepo.create({ orgId: 'org-1' } as never)).id).toBe('c-5')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'c-6' }])
    expect((await customerRepo.update('c-6', 'org-1', {} as never))?.id).toBe('c-6')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'o-1' }])
    expect(await orderRepo.findById('o-1', 'org-1')).toEqual({ id: 'o-1' })
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'o-2' }])
    expect((await orderRepo.findAll('org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'o-3' }])
    expect((await orderRepo.findByStatus('org-1', 'confirmed')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'o-4' }])
    expect((await orderRepo.findByPaymentStatus('org-1', 'PENDING')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'o-5' }])
    expect((await orderRepo.create({ orgId: 'org-1' } as never)).id).toBe('o-5')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'o-6' }])
    expect((await orderRepo.update('o-6', 'org-1', {} as never))?.id).toBe('o-6')
    mockSelectWhere.mockResolvedValueOnce([{ count: 7 }])
    expect(await orderRepo.count('org-1')).toBe(7)
    mockSelectWhere.mockResolvedValueOnce([{ count: 8 }])
    expect(await orderRepo.countByStatus('org-1', ['a'])).toBe(8)
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'ol-1' }])
    expect((await orderRepo.findLines('o-1')).length).toBe(1)
    expect((await orderRepo.insertLines([])).length).toBe(0)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'ol-2' }])
    expect((await orderRepo.insertLines([{ orderId: 'o-1' } as never])).length).toBe(1)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'p-1' }])
    expect(await paymentRepo.findById('p-1', 'org-1')).toEqual({ id: 'p-1' })
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'p-2' }])
    expect((await paymentRepo.findByOrder('o-1', 'org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'p-3' }])
    expect((await paymentRepo.findByStatus('org-1', 'paid')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'p-4' }])
    expect((await paymentRepo.create({ orgId: 'org-1' } as never)).id).toBe('p-4')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'p-5' }])
    expect((await paymentRepo.update('p-5', 'org-1', {} as never))?.id).toBe('p-5')
    mockSelectWhere.mockResolvedValueOnce([{ count: 9 }])
    expect(await paymentRepo.countBlocked('org-1')).toBe(9)
    mockSelectWhere.mockResolvedValueOnce([{ total: '10.5' }])
    expect(await paymentRepo.totalPaidForOrder('o-1')).toBe(10.5)
  })

  it('covers purchase-order/production/quote/vendor/invoice repositories', async () => {
    const {
      purchaseOrderRepo,
      productionRepo,
      quoteRepo,
      vendorRepo,
      invoiceRepo,
    } = await import('@/lib/repositories')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'po-1' }])
    expect(await purchaseOrderRepo.findById('po-1', 'org-1')).toEqual({ id: 'po-1' })
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'po-2' }])
    expect((await purchaseOrderRepo.findAll('org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'po-3' }])
    expect((await purchaseOrderRepo.findByOrder('o-1', 'org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'po-4' }])
    expect((await purchaseOrderRepo.findByStatus('org-1', 'sent')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'po-5' }])
    expect((await purchaseOrderRepo.create({ orgId: 'org-1' } as never)).id).toBe('po-5')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'po-6' }])
    expect((await purchaseOrderRepo.update('po-6', 'org-1', {} as never))?.id).toBe('po-6')
    mockSelectWhere.mockResolvedValueOnce([{ count: 1 }])
    expect(await purchaseOrderRepo.countOverdue('org-1')).toBe(1)
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'pol-1' }])
    expect((await purchaseOrderRepo.findLines('po-1')).length).toBe(1)
    expect((await purchaseOrderRepo.insertLines([])).length).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'pr-1' }])
    expect(await productionRepo.findById('pr-1', 'org-1')).toEqual({ id: 'pr-1' })
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'pr-2' }])
    expect((await productionRepo.findAll('org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'pr-3' }])
    expect((await productionRepo.findByOrder('o-1', 'org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'pr-4' }])
    expect((await productionRepo.findByStatus('org-1', 'in_production')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'pr-5' }])
    expect((await productionRepo.create({ orgId: 'org-1' } as never)).id).toBe('pr-5')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'pr-6' }])
    expect((await productionRepo.update('pr-6', 'org-1', {} as never))?.id).toBe('pr-6')
    mockSelectWhere.mockResolvedValueOnce([{ count: 2 }])
    expect(await productionRepo.countInProgress('org-1')).toBe(2)
    mockSelectWhere.mockResolvedValueOnce([{ count: 3 }])
    expect(await productionRepo.countBlocked('org-1')).toBe(3)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'q-1' }])
    expect(await quoteRepo.findById('q-1', 'org-1')).toEqual({ id: 'q-1' })
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'q-2' }])
    expect((await quoteRepo.findAll('org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'q-3' }])
    expect((await quoteRepo.findByStatus('org-1', 'draft')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'q-4' }])
    expect((await quoteRepo.create({ orgId: 'org-1' } as never)).id).toBe('q-4')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'q-5' }])
    expect((await quoteRepo.update('q-5', 'org-1', {} as never))?.id).toBe('q-5')
    mockSelectWhere.mockResolvedValueOnce([{ count: 4 }])
    expect(await quoteRepo.count('org-1')).toBe(4)
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'ql-1' }])
    expect((await quoteRepo.findLines('q-1')).length).toBe(1)
    expect((await quoteRepo.insertLines([])).length).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'v-1' }])
    expect(await vendorRepo.findById('v-1', 'org-1')).toEqual({ id: 'v-1' })
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'v-2' }])
    expect((await vendorRepo.findAll('org-1')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'v-3' }])
    expect((await vendorRepo.create({ orgId: 'org-1' } as never)).id).toBe('v-3')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'v-4' }])
    expect((await vendorRepo.update('v-4', 'org-1', {} as never))?.id).toBe('v-4')
    mockSelectWhere.mockResolvedValueOnce([{ id: 'l-1' }])
    expect((await vendorRepo.findProductLinks('v-1', 'org-1')).length).toBe(1)
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'l-2' }])
    expect((await vendorRepo.findVendorsForProduct('p-1', 'org-1')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'l-3' }])
    expect((await vendorRepo.linkProduct({ orgId: 'org-1' } as never)).id).toBe('l-3')
    mockSelectWhere.mockResolvedValueOnce([{ count: 5 }])
    expect(await vendorRepo.count('org-1')).toBe(5)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'i-1' }])
    expect(await invoiceRepo.findById('i-1', 'org-1')).toEqual({ id: 'i-1' })
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'i-2' }])
    expect((await invoiceRepo.findAll('org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'i-3' }])
    expect((await invoiceRepo.findByOrder('o-1', 'org-1')).length).toBe(1)
    mockSelectWhere.mockResolvedValueOnce([{ id: 'i-4' }])
    expect((await invoiceRepo.findByStatus('org-1', 'sent')).length).toBe(1)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'i-5' }])
    expect((await invoiceRepo.create({ orgId: 'org-1' } as never)).id).toBe('i-5')
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'i-6' }])
    expect((await invoiceRepo.update('i-6', 'org-1', {} as never))?.id).toBe('i-6')
    mockSelectWhere.mockResolvedValueOnce([{ count: 6 }])
    expect(await invoiceRepo.countOverdue('org-1')).toBe(6)
    mockSelectWhere.mockReturnValueOnce({ orderBy: mockSelectOrderBy })
    mockSelectOrderBy.mockResolvedValueOnce([{ id: 'il-1' }])
    expect((await invoiceRepo.findLines('i-1')).length).toBe(1)
    expect((await invoiceRepo.insertLines([])).length).toBe(0)
  })

  it('covers repository barrel exports', async () => {
    const repos = await import('@/lib/repositories')
    expect(repos.customerRepo).toBeTruthy()
    expect(repos.orderRepo).toBeTruthy()
    expect(repos.paymentRepo).toBeTruthy()
    expect(repos.purchaseOrderRepo).toBeTruthy()
    expect(repos.productionRepo).toBeTruthy()
    expect(repos.quoteRepo).toBeTruthy()
    expect(repos.vendorRepo).toBeTruthy()
    expect(repos.invoiceRepo).toBeTruthy()
  })

  it('covers repository null/default fallback branches', async () => {
    const {
      customerRepo,
      orderRepo,
      paymentRepo,
      productionRepo,
      quoteRepo,
      vendorRepo,
      invoiceRepo,
      purchaseOrderRepo,
    } = await import('@/lib/repositories')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await customerRepo.findById('missing', 'org-1')).toBeNull()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await customerRepo.findByEmail('missing@example.com', 'org-1')).toBeNull()

    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await customerRepo.update('missing', 'org-1', {} as never)).toBeNull()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await orderRepo.findById('missing', 'org-1')).toBeNull()
    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await orderRepo.update('missing', 'org-1', {} as never)).toBeNull()
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await orderRepo.count('org-1')).toBe(0)
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await orderRepo.countByStatus('org-1', ['missing'])).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await paymentRepo.findById('missing', 'org-1')).toBeNull()
    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await paymentRepo.update('missing', 'org-1', {} as never)).toBeNull()
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await paymentRepo.countBlocked('org-1')).toBe(0)
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await paymentRepo.totalPaidForOrder('missing')).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await productionRepo.findById('missing', 'org-1')).toBeNull()
    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await productionRepo.update('missing', 'org-1', {} as never)).toBeNull()
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await productionRepo.countInProgress('org-1')).toBe(0)
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await productionRepo.countBlocked('org-1')).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await quoteRepo.findById('missing', 'org-1')).toBeNull()
    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await quoteRepo.update('missing', 'org-1', {} as never)).toBeNull()
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await quoteRepo.count('org-1')).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await vendorRepo.findById('missing', 'org-1')).toBeNull()
    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await vendorRepo.update('missing', 'org-1', {} as never)).toBeNull()
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await vendorRepo.count('org-1')).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await invoiceRepo.findById('missing', 'org-1')).toBeNull()
    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await invoiceRepo.update('missing', 'org-1', {} as never)).toBeNull()
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await invoiceRepo.countOverdue('org-1')).toBe(0)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await purchaseOrderRepo.findById('missing', 'org-1')).toBeNull()
    mockUpdateReturning.mockResolvedValueOnce([])
    expect(await purchaseOrderRepo.update('missing', 'org-1', {} as never)).toBeNull()
    mockSelectWhere.mockResolvedValueOnce([])
    expect(await purchaseOrderRepo.countOverdue('org-1')).toBe(0)
  })
})
