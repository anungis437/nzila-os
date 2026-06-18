import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateOrder,
  mockGetProducts,
  mockGetOrderById,
  mockGetProductById,
  mockWithSpan,
  mockCreateProduct,
  mockUpdateProduct,
  mockGetProductBySku,
} = vi.hoisted(() => ({
  mockCreateOrder: vi.fn(),
  mockGetProducts: vi.fn(),
  mockGetOrderById: vi.fn(),
  mockGetProductById: vi.fn(),
  mockWithSpan: vi.fn(async (_name: string, _attrs: unknown, fn: () => Promise<unknown>) => fn()),
  mockCreateProduct: vi.fn(),
  mockUpdateProduct: vi.fn(),
  mockGetProductBySku: vi.fn(),
}))

vi.mock('@/lib/shopify', () => ({
  ShopifyClient: class {
    createOrder = mockCreateOrder
    getProducts = mockGetProducts
    getOrderById = mockGetOrderById
    getProductById = mockGetProductById
  },
}))

vi.mock('@nzila/os-core/telemetry', () => ({ withSpan: mockWithSpan }))

vi.mock('@nzila/commerce-db', () => ({
  createProduct: mockCreateProduct,
  updateProduct: mockUpdateProduct,
  getProductBySku: mockGetProductBySku,
}))

describe('shopify adapter slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pushOrder creates fallback and explicit line-item payloads', async () => {
    const { createShopifyAdapter } = await import('@/lib/integrations/shopify.adapter')
    const adapter = createShopifyAdapter({ shopDomain: 'acme.myshopify.com', accessToken: 'tok' })

    mockCreateOrder.mockResolvedValueOnce({ id: 101 })
    const fallback = await adapter.pushOrder({
      id: 'ord-1',
      total_amount: 100,
      currency: 'USD',
      payment_status: 'PENDING',
    } as never)
    expect(fallback.shopifyOrderId).toBe(101)

    mockCreateOrder.mockResolvedValueOnce({ id: 102 })
    const explicit = await adapter.pushOrder(
      { id: 'ord-2', total_amount: 50, currency: 'USD', payment_status: 'PAID' } as never,
      [{ title: 'Item', quantity: 1, price: '50.00' }],
    )
    expect(explicit.shopifyOrderId).toBe(102)
  })

  it('syncProducts creates, updates, and skips products', async () => {
    const { createShopifyAdapter } = await import('@/lib/integrations/shopify.adapter')
    const adapter = createShopifyAdapter({ shopDomain: 'acme.myshopify.com', accessToken: 'tok' })

    mockGetProducts.mockResolvedValue([
      {
        id: 1,
        title: 'No price',
        variants: [{ sku: 'SKIP', price: '' }],
        status: 'active',
        tags: '',
        images: [],
        handle: 'skip',
        vendor: 'v',
        updated_at: 'now',
      },
      {
        id: 2,
        title: 'Existing',
        body_html: '<p>x</p>',
        product_type: 'Cat',
        variants: [{ sku: 'SKU-1', price: '15.5' }],
        status: 'active',
        tags: 'a,b',
        images: [{ src: 'img' }],
        handle: 'existing',
        vendor: 'v',
        updated_at: 'now',
      },
      {
        id: 3,
        title: 'New',
        variants: [{ sku: '', price: '20' }],
        status: 'draft',
        tags: '',
        images: [],
        handle: 'new-h',
        vendor: 'v',
        updated_at: 'now',
      },
    ])

    mockGetProductBySku
      .mockResolvedValueOnce({ id: 'local-1' })
      .mockResolvedValueOnce(null)

    const result = await adapter.syncProducts({ orgId: 'org-1', actorId: 'u-1' })
    expect(result.skipped).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.created).toBe(1)
    expect(mockUpdateProduct).toHaveBeenCalledTimes(1)
    expect(mockCreateProduct).toHaveBeenCalledTimes(1)
  })

  it('getFulfillmentStatus and getProduct branches', async () => {
    const { createShopifyAdapter } = await import('@/lib/integrations/shopify.adapter')
    const adapter = createShopifyAdapter({ shopDomain: 'acme.myshopify.com', accessToken: 'tok' })

    mockGetOrderById.mockResolvedValueOnce(null)
    expect(await adapter.getFulfillmentStatus(1)).toBeNull()

    mockGetOrderById.mockResolvedValueOnce({ fulfillment_status: 'fulfilled' })
    const status = await adapter.getFulfillmentStatus(2)
    expect(status?.fulfillmentStatus).toBe('fulfilled')

    mockGetProductById.mockResolvedValueOnce({ id: 55 })
    const product = await adapter.getProduct(55)
    expect(product).toEqual({ id: 55 })
  })
})
