import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogger,
  mockGetCustomers,
  mockGetOrders,
  mockGetOrgSettings,
  mockSelectLimit,
  mockSelectWhere,
  mockInsertReturning,
  mockInsertValues,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockGetCustomers: vi.fn(),
  mockGetOrders: vi.fn(),
  mockGetOrgSettings: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockInsertValues: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('@/lib/shopify/client', () => ({
  ShopifyClient: class {
    getCustomers = mockGetCustomers
    getOrders = mockGetOrders
  },
}))

vi.mock('@nzila/platform-commerce-org/service', () => ({
  getOrgSettings: mockGetOrgSettings,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => mockSelectWhere()),
    limit: mockSelectLimit,
  }
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateChain),
  }
  const insertChain = {
    values: mockInsertValues,
    returning: mockInsertReturning,
  }

  mockInsertValues.mockImplementation(() => insertChain)

  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
      insert: vi.fn(() => insertChain),
    },
    commerceCustomers: { id: 'id' },
    commerceQuotes: { id: 'id' },
    commerceShopifyCredentials: { orgId: 'orgId', isActive: 'isActive' },
    commerceShopifySyncRecords: {
      orgId: 'orgId',
      entityType: 'entityType',
      shopifyId: 'shopifyId',
      nzilaRecordId: 'nzilaRecordId',
      lastSyncedAt: 'lastSyncedAt',
      syncStatus: 'syncStatus',
    },
  }
})

describe('shopify sync service slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockGetOrgSettings.mockResolvedValue({ currency: 'USD' })
  })

  it('fromOrg returns null without active credentials', async () => {
    const { ShopifySyncService } = await import('@/lib/shopify/sync-service')
    mockSelectLimit.mockResolvedValueOnce([])

    const service = await ShopifySyncService.fromOrg('org-1')
    expect(service).toBeNull()
  })

  it('syncCustomers updates existing and creates new customer', async () => {
    const { ShopifySyncService } = await import('@/lib/shopify/sync-service')

    mockSelectLimit
      .mockResolvedValueOnce([
        {
          shopDomain: 'acme.myshopify.com',
          accessToken: 'tok',
          scopes: ['read_customers'],
          webhookSecret: 'sec',
        },
      ])
      .mockResolvedValueOnce([{ lastSyncedAt: new Date('2025-01-01') }])
      .mockResolvedValueOnce([{ nzilaRecordId: 'cust-1' }])
      .mockResolvedValueOnce([])

    mockGetCustomers.mockResolvedValue([
      {
        id: 1,
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        phone: '111',
        default_address: null,
      },
      {
        id: 2,
        first_name: 'Grace',
        last_name: 'Hopper',
        email: 'grace@example.com',
        phone: '222',
        default_address: null,
      },
    ])

    mockInsertReturning.mockResolvedValueOnce([{ id: 'cust-2' }])

    const service = await ShopifySyncService.fromOrg('org-1')
    expect(service).toBeTruthy()

    const result = await service!.syncCustomers()
    expect(result.recordsProcessed).toBe(2)
    expect(result.recordsUpdated).toBe(1)
    expect(result.recordsCreated).toBe(1)
  })

  it('syncOrders handles update/create and top-level client error', async () => {
    const { ShopifySyncService } = await import('@/lib/shopify/sync-service')

    mockSelectLimit
      .mockResolvedValueOnce([
        {
          shopDomain: 'acme.myshopify.com',
          accessToken: 'tok',
          scopes: ['read_orders'],
          webhookSecret: 'sec',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ nzilaRecordId: 'quote-1' }])
      .mockResolvedValueOnce([{ nzilaRecordId: 'cust-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    mockGetOrders.mockResolvedValue([
      {
        id: 10,
        order_number: 10,
        financial_status: 'paid',
        fulfillment_status: null,
        currency: 'USD',
        subtotal_price: '100',
        total_tax: '10',
        total_price: '110',
        note: 'ok',
        name: '#10',
        customer: { id: 1 },
      },
      {
        id: 11,
        order_number: 11,
        financial_status: 'pending',
        fulfillment_status: null,
        currency: 'USD',
        subtotal_price: '50',
        total_tax: '5',
        total_price: '55',
        note: null,
        name: '#11',
        customer: { id: 999 },
      },
    ])

    mockInsertReturning.mockResolvedValueOnce([{ id: 'quote-2' }])

    const service = await ShopifySyncService.fromOrg('org-1')
    const ok = await service!.syncOrders()
    expect(ok.recordsProcessed).toBe(2)
    expect(ok.recordsUpdated + ok.recordsCreated).toBe(2)

    mockSelectLimit.mockResolvedValueOnce([])
    mockGetOrders.mockRejectedValueOnce(new Error('shopify down'))
    const errored = await service!.syncOrders()
    expect(errored.errors.length).toBeGreaterThan(0)
  })

  it('covers customer top-level failure and order per-record failure branches', async () => {
    const { ShopifySyncService } = await import('@/lib/shopify/sync-service')

    mockSelectLimit.mockResolvedValueOnce([
      {
        shopDomain: 'acme.myshopify.com',
        accessToken: 'tok',
        scopes: ['read_customers', 'read_orders'],
        webhookSecret: 'sec',
      },
    ])

    const service = await ShopifySyncService.fromOrg('org-1')
    expect(service).toBeTruthy()

    mockSelectLimit.mockResolvedValueOnce([])
    mockGetCustomers.mockRejectedValueOnce(new Error('customers offline'))
    const customerFail = await service!.syncCustomers()
    expect(customerFail.recordsProcessed).toBe(0)
    expect(customerFail.errors.length).toBe(1)

    mockSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockGetOrders.mockResolvedValueOnce([
      {
        id: 99,
        order_number: 99,
        financial_status: 'pending',
        fulfillment_status: null,
        currency: 'USD',
        subtotal_price: '10',
        total_tax: '1',
        total_price: '11',
        note: null,
        name: '#99',
        customer: null,
      },
    ])
    mockInsertReturning.mockRejectedValueOnce(new Error('insert quote failed'))

    const orderFail = await service!.syncOrders()
    expect(orderFail.recordsProcessed).toBe(1)
    expect(orderFail.recordsFailed).toBe(1)
    expect(orderFail.errors[0].errorMessage).toContain('Failed to sync order 99')
  })

  it('covers customer per-record failure and order fallback mapping branches', async () => {
    const { ShopifySyncService } = await import('@/lib/shopify/sync-service')

    mockSelectLimit.mockResolvedValueOnce([
      {
        shopDomain: 'acme.myshopify.com',
        accessToken: 'tok',
        scopes: ['read_customers', 'read_orders'],
        webhookSecret: 'sec',
      },
    ])

    const service = await ShopifySyncService.fromOrg('org-1')
    expect(service).toBeTruthy()

    mockSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockGetCustomers.mockResolvedValueOnce([
      {
        id: 201,
        first_name: '',
        last_name: '',
        email: 'first@example.com',
        phone: '111',
        default_address: {
          address1: '1 Main',
          address2: 'Suite 2',
          city: 'Montreal',
          province: 'QC',
          zip: 'H1H1H1',
          country: 'CA',
        },
      },
      {
        id: 202,
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        phone: '222',
        default_address: null,
      },
    ])
    mockInsertReturning.mockRejectedValueOnce(new Error('insert customer failed')).mockResolvedValueOnce([{ id: 'cust-202' }])

    const customerResult = await service!.syncCustomers()
    expect(customerResult.recordsProcessed).toBe(2)
    expect(customerResult.recordsFailed).toBe(1)
    expect(customerResult.recordsCreated).toBe(1)

    mockSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockGetOrders.mockResolvedValueOnce([
      {
        id: 301,
        order_number: 301,
        financial_status: 'mystery_status',
        fulfillment_status: null,
        currency: undefined,
        subtotal_price: '40',
        total_tax: '4',
        total_price: '44',
        note: 'fallback',
        name: '#301',
        customer: { id: 999 },
      },
    ])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'quote-301' }])

    const orderResult = await service!.syncOrders()
    expect(orderResult.recordsProcessed).toBe(1)
    expect(orderResult.recordsCreated).toBe(1)

    const quoteInsertPayload = mockInsertValues.mock.calls
      .map((c) => c[0])
      .find((v) => v && typeof v === 'object' && 'ref' in (v as Record<string, unknown>))
    expect(quoteInsertPayload).toMatchObject({
      status: 'draft',
      currency: 'USD',
      customerId: '',
      ref: 'SHOP-301',
    })
  })

  it('covers unknown-error catch branches for customer and order sync', async () => {
    const { ShopifySyncService } = await import('@/lib/shopify/sync-service')

    mockSelectLimit.mockResolvedValueOnce([
      {
        shopDomain: 'acme.myshopify.com',
        accessToken: 'tok',
        scopes: ['read_customers', 'read_orders'],
        webhookSecret: 'sec',
      },
    ])

    const service = await ShopifySyncService.fromOrg('org-1')
    expect(service).toBeTruthy()

    mockSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockGetCustomers.mockResolvedValueOnce([
      {
        id: 401,
        first_name: 'Unknown',
        last_name: 'Customer',
        email: 'u@example.com',
        phone: '555',
        default_address: null,
      },
    ])
    mockInsertReturning.mockRejectedValueOnce('insert failed')

    const customerRecordUnknown = await service!.syncCustomers()
    expect(customerRecordUnknown.recordsProcessed).toBe(1)
    expect(customerRecordUnknown.recordsFailed).toBe(1)
    expect(customerRecordUnknown.errors[0].errorMessage).toContain('Unknown error')

    mockSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockGetOrders.mockResolvedValueOnce([
      {
        id: 402,
        order_number: 402,
        financial_status: 'pending',
        fulfillment_status: null,
        currency: 'USD',
        subtotal_price: '10',
        total_tax: '1',
        total_price: '11',
        note: null,
        name: '#402',
        customer: null,
      },
    ])
    mockInsertReturning.mockRejectedValueOnce({ reason: 'bad insert' })

    const orderRecordUnknown = await service!.syncOrders()
    expect(orderRecordUnknown.recordsProcessed).toBe(1)
    expect(orderRecordUnknown.recordsFailed).toBe(1)
    expect(orderRecordUnknown.errors[0].errorMessage).toContain('Unknown error')

    mockSelectLimit.mockResolvedValueOnce([])
    mockGetCustomers.mockRejectedValueOnce(123 as never)
    const customerTopUnknown = await service!.syncCustomers()
    expect(customerTopUnknown.errors[0].errorMessage).toBe('Unknown error')

    mockSelectLimit.mockResolvedValueOnce([])
    mockGetOrders.mockRejectedValueOnce({ down: true } as never)
    const orderTopUnknown = await service!.syncOrders()
    expect(orderTopUnknown.errors[0].errorMessage).toBe('Unknown error')
  })
})
