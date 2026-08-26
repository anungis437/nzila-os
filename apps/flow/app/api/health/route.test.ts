import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkDb: vi.fn().mockResolvedValue(true),
  container: vi.fn(),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.checkDb },
}))

vi.mock('drizzle-orm', () => ({
  sql: (strs: TemplateStringsArray) => strs[0],
}))

vi.mock('@nzila/blob', () => ({
  container: mocks.container,
}))

// Mock global fetch for Shopify API check
global.fetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => '',
})) as unknown as typeof fetch

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.checkDb.mockResolvedValue(true)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.SHOPIFY_SHOP_DOMAIN
    delete process.env.SHOPIFY_ACCESS_TOKEN
    delete process.env.ZOHO_CLIENT_ID
    delete process.env.CANVA_API_KEY
  })

  it('returns degraded when external services arent configured', async () => {
    delete process.env.SHOPIFY_SHOP_DOMAIN
    delete process.env.SHOPIFY_ACCESS_TOKEN
    delete process.env.ZOHO_CLIENT_ID
    delete process.env.CANVA_API_KEY

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks).toHaveProperty('process')
    expect(body.checks).toHaveProperty('db')
    expect(body.checks).not.toHaveProperty('storage')
    expect(mocks.container).not.toHaveBeenCalled()
  })

  it('returns degraded when db check fails', async () => {
    mocks.checkDb.mockRejectedValue(new Error('db failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks.db).toBe('fail')
  })

  it('returns healthy when all configured dependency checks pass', async () => {
    process.env.SHOPIFY_SHOP_DOMAIN = 'shop.example'
    process.env.SHOPIFY_ACCESS_TOKEN = 'shop-token'
    process.env.ZOHO_CLIENT_ID = 'zoho-client'
    process.env.CANVA_API_KEY = 'canva-key'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks.shopify).toBe('ok')
    expect(body.checks.zoho).toBe('ok')
    expect(body.checks.canva).toBe('ok')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://shop.example/admin/api/2024-01/shop.json',
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-Shopify-Access-Token': 'shop-token' },
      }),
    )
  })

  it('marks Shopify failed when the configured health fetch throws', async () => {
    process.env.SHOPIFY_SHOP_DOMAIN = 'shop.example'
    process.env.SHOPIFY_ACCESS_TOKEN = 'shop-token'
    process.env.ZOHO_CLIENT_ID = 'zoho-client'
    process.env.CANVA_API_KEY = 'canva-key'
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('shopify unavailable'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks.shopify).toBe('fail')
    expect(body.checks.zoho).toBe('ok')
    expect(body.checks.canva).toBe('ok')
  })

  it('includes build metadata', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('app')
    expect(body.app).toBe('flow')
  })
})
