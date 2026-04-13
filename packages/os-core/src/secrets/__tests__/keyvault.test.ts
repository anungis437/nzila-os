import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSecret, clearSecretCache, prewarmSecret } from '../keyvault'

// Don't import the real Azure SDK
vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: vi.fn(),
}))
vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
}))

describe('keyvault', () => {
  beforeEach(() => {
    clearSecretCache()
    delete process.env.KEY_VAULT_URI
    delete process.env.NODE_ENV
    delete process.env.MY_SECRET
    delete process.env.DATABASE_URL
  })

  describe('getSecret — env fallback', () => {
    it('resolves kebab-case to UPPER_SNAKE_CASE env var', async () => {
      process.env.MY_SECRET = 'val123'
      const result = await getSecret('my-secret')
      expect(result.value).toBe('val123')
    })

    it('caches the result for subsequent calls', async () => {
      process.env.DATABASE_URL = 'postgres://...'
      const r1 = await getSecret('database-url')
      const r2 = await getSecret('database-url')
      expect(r1).toBe(r2) // same reference = cache hit
    })

    it('throws when secret not found and no env var', async () => {
      await expect(getSecret('nonexistent')).rejects.toThrow('Secret "nonexistent" not found')
    })
  })

  describe('clearSecretCache', () => {
    it('clears the cache so next call re-reads env', async () => {
      process.env.MY_SECRET = 'original'
      await getSecret('my-secret')
      
      process.env.MY_SECRET = 'updated'
      clearSecretCache()
      const result = await getSecret('my-secret')
      expect(result.value).toBe('updated')
    })
  })

  describe('prewarmSecret', () => {
    it('makes the secret available immediately', async () => {
      prewarmSecret('api-key', 'pre-warmed-value')
      const result = await getSecret('api-key')
      expect(result.value).toBe('pre-warmed-value')
    })
  })
})
