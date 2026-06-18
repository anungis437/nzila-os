import { beforeEach, describe, expect, it, vi } from 'vitest'

const { qLimit } = vi.hoisted(() => ({ qLimit: [] as unknown[][] }))

const shiftQueue = () => Promise.resolve((qLimit.shift() ?? []) as never)

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => shiftQueue()),
  }

  return {
    db: {
      select: vi.fn(() => selectChain),
    },
    commerceShopifyCredentials: {
      shopDomain: 'shopDomain',
    },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
}))

describe('shopify credential lookup slice', () => {
  beforeEach(() => {
    qLimit.length = 0
  })

  it('returns credentials when found and null when missing', async () => {
    const mod = await import('@/lib/shopify/credential-lookup')

    qLimit.push([{ id: 'cred-1', shopDomain: 'a.example.myshopify.com' }])
    await expect(mod.findShopifyCredentialsByDomain('a.example.myshopify.com')).resolves.toMatchObject({
      id: 'cred-1',
    })

    qLimit.push([])
    await expect(mod.findShopifyCredentialsByDomain('missing.example.myshopify.com')).resolves.toBeNull()
  })
})
