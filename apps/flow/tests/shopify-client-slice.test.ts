import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response
}

function fail(status: number, body: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: body }),
    text: async () => body,
  } as Response
}

describe('shopify client slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('covers product/order/customer methods and request composition', async () => {
    const { ShopifyClient } = await import('@/lib/shopify/client')
    const client = new ShopifyClient({ shopDomain: 'https://acme.myshopify.com/', accessToken: 'tok', scopes: 'read_products' })

    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(okJson({ products: [{ id: 1 }] }))
      .mockResolvedValueOnce(okJson({ product: { id: 2 } }))
      .mockResolvedValueOnce(okJson({ product: { id: 3 } }))
      .mockResolvedValueOnce(okJson({ product: { id: 4 } }))
      .mockResolvedValueOnce(okJson({ orders: [{ id: 5 }] }))
      .mockResolvedValueOnce(okJson({ order: { id: 6 } }))
      .mockResolvedValueOnce(okJson({ order: { id: 7 } }))
      .mockResolvedValueOnce(okJson({ customers: [{ id: 8 }] }))
      .mockResolvedValueOnce(okJson({ customer: { id: 9 } }))
      .mockResolvedValueOnce(okJson({ customers: [{ id: 10 }] }))

    expect((await client.getProducts({ limit: 2, since_id: 1, updated_at_min: '2026-01-01' })).length).toBe(1)
    expect(await client.getProductById(2)).toEqual({ id: 2 })
    expect(await client.createProduct({ title: 'P' } as never)).toEqual({ id: 3 })
    expect(await client.updateProduct(4, { title: 'U' } as never)).toEqual({ id: 4 })

    expect((await client.getOrders({ limit: 3, status: 'any' })).length).toBe(1)
    expect(await client.getOrderById(6)).toEqual({ id: 6 })
    expect(await client.createOrder({ line_items: [{ title: 'L', quantity: 1, price: '10.00' }] } as never)).toEqual({ id: 7 })

    expect((await client.getCustomers({ limit: 4 })).length).toBe(1)
    expect(await client.getCustomerById(9)).toEqual({ id: 9 })
    expect((await client.searchCustomers('john@example.com')).length).toBe(1)

    const firstCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(firstCall?.[0]).toContain('https://acme.myshopify.com/admin/api/2024-01/products.json?')
  })

  it('returns null for get-by-id methods on API errors and throws for direct operations', async () => {
    const { ShopifyClient } = await import('@/lib/shopify/client')
    const client = new ShopifyClient({ shopDomain: 'acme.myshopify.com', accessToken: 'tok', scopes: 'read_products' })

    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(fail(404, 'missing product'))
      .mockResolvedValueOnce(fail(404, 'missing order'))
      .mockResolvedValueOnce(fail(404, 'missing customer'))
      .mockResolvedValueOnce(fail(500, 'create failed'))

    expect(await client.getProductById(999)).toBeNull()
    expect(await client.getOrderById(999)).toBeNull()
    expect(await client.getCustomerById(999)).toBeNull()
    await expect(client.createProduct({ title: 'X' } as never)).rejects.toThrow('Shopify API error 500')
  })

  it('covers empty-query branches for list methods', async () => {
    const { ShopifyClient } = await import('@/lib/shopify/client')
    const client = new ShopifyClient({ shopDomain: 'https://acme.myshopify.com/', accessToken: 'tok', scopes: 'read_products' })

    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(okJson({ products: [] }))
      .mockResolvedValueOnce(okJson({ orders: [] }))
      .mockResolvedValueOnce(okJson({ customers: [] }))

    await expect(client.getProducts()).resolves.toEqual([])
    await expect(client.getOrders()).resolves.toEqual([])
    await expect(client.getCustomers()).resolves.toEqual([])

    const productCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const orderCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1]
    const customerCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[2]

    expect(productCall?.[0]).toContain('/products.json?')
    expect(orderCall?.[0]).toContain('/orders.json?')
    expect(customerCall?.[0]).toContain('/customers.json?')
    expect(productCall?.[1]).toEqual(expect.objectContaining({ method: 'GET' }))
    expect((productCall?.[1] as RequestInit | undefined)?.body).toBeUndefined()
  })
})
