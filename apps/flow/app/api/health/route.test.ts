import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkDb: vi.fn().mockResolvedValue(true),
  checkBlob: vi.fn().mockResolvedValue(true),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.checkDb },
}))

vi.mock('drizzle-orm', () => ({
  sql: (strs: TemplateStringsArray) => strs[0],
}))

vi.mock('@nzila/blob', () => ({
  container: () => ({ getProperties: mocks.checkBlob }),
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
    mocks.checkBlob.mockResolvedValue(true)
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

  it('returns degraded when storage check fails', async () => {
    mocks.checkBlob.mockRejectedValue(new Error('blob failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks.storage).toBe('fail')
  })

  it('includes build metadata', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('app')
    expect(body.app).toBe('flow')
  })
})
