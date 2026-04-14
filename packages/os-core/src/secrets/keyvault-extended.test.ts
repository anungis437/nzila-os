/**
 * Extended tests for secrets/keyvault.ts — fetchFromKeyVault, prewarmSecret, clearSecretCache
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('keyvault extended', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  async function loadModule() {
    return import('./keyvault') as Promise<typeof import('./keyvault')>
  }

  describe('prewarmSecret', () => {
    it('pre-warms a secret into the cache', async () => {
      const { prewarmSecret, getSecret, clearSecretCache } = await loadModule()
      prewarmSecret('my-test-secret', 'pre-warmed-value')

      const secret = await getSecret('my-test-secret')
      expect(secret.value).toBe('pre-warmed-value')

      clearSecretCache()
    })
  })

  describe('clearSecretCache', () => {
    it('clears all cached secrets', async () => {
      const { prewarmSecret, clearSecretCache, getSecret } = await loadModule()

      prewarmSecret('cached-secret', 'value-1')
      clearSecretCache()

      // After clearing, the secret should not be in cache
      // Set an env var so the fallback works
      process.env.CACHED_SECRET = 'env-value'
      const secret = await getSecret('cached-secret')
      expect(secret.value).toBe('env-value')
      delete process.env.CACHED_SECRET
    })
  })

  describe('getSecret from cache', () => {
    it('returns cached secret on second call', async () => {
      const { prewarmSecret, getSecret, clearSecretCache } = await loadModule()

      prewarmSecret('repeat-secret', 'cached')
      const first = await getSecret('repeat-secret')
      const second = await getSecret('repeat-secret')
      expect(first.value).toBe(second.value)

      clearSecretCache()
    })
  })

  describe('getSecret env fallback', () => {
    it('falls back to environment variable in dev', async () => {
      ;(process.env as any).NODE_ENV = 'development'
      process.env.DATABASE_URL = 'postgres://localhost:5432/test'

      const { getSecret, clearSecretCache } = await loadModule()
      const secret = await getSecret('database-url')
      expect(secret.value).toBe('postgres://localhost:5432/test')

      clearSecretCache()
      delete process.env.DATABASE_URL
    })

    it('converts dashes to underscores for env var lookup', async () => {
      ;(process.env as any).NODE_ENV = 'test'
      process.env.MY_API_KEY = 'test-key-123'

      const { getSecret, clearSecretCache } = await loadModule()
      const secret = await getSecret('my-api-key')
      expect(secret.value).toBe('test-key-123')

      clearSecretCache()
      delete process.env.MY_API_KEY
    })

    it('throws when secret not found anywhere', async () => {
      ;(process.env as any).NODE_ENV = 'test'
      delete process.env.KEY_VAULT_URI

      const { getSecret, clearSecretCache } = await loadModule()
      await expect(getSecret('non-existent-secret-xyz')).rejects.toThrow(/not found/)
      clearSecretCache()
    })
  })

  describe('getSecret with Key Vault', () => {
    it('fetches from Key Vault in production when KEY_VAULT_URI is set', async () => {
      ;(process.env as any).NODE_ENV = 'production'
      process.env.KEY_VAULT_URI = 'https://my-vault.vault.azure.net/'

      vi.doMock('@azure/keyvault-secrets', () => ({
        SecretClient: class {
          getSecret = vi.fn().mockResolvedValue({
            value: 'vault-secret-value',
            properties: { expiresOn: undefined, version: '1' },
          })
        },
      }))
      vi.doMock('@azure/identity', () => ({
        DefaultAzureCredential: class {},
      }))

      const { getSecret, clearSecretCache } = await loadModule()
      const secret = await getSecret('my-vault-secret')
      expect(secret.value).toBe('vault-secret-value')

      clearSecretCache()
    })

    it('throws when @azure/keyvault-secrets is not installed', async () => {
      ;(process.env as any).NODE_ENV = 'production'
      process.env.KEY_VAULT_URI = 'https://my-vault.vault.azure.net/'

      vi.doMock('@azure/keyvault-secrets', () => {
        throw new Error('MODULE_NOT_FOUND')
      })

      const { getSecret, clearSecretCache } = await loadModule()
      await expect(getSecret('some-secret')).rejects.toThrow(/not installed/)
      clearSecretCache()
    })

    it('throws when Key Vault secret has no value', async () => {
      ;(process.env as any).NODE_ENV = 'production'
      process.env.KEY_VAULT_URI = 'https://my-vault.vault.azure.net/'

      vi.doMock('@azure/keyvault-secrets', () => ({
        SecretClient: class {
          getSecret = vi.fn().mockResolvedValue({
            value: undefined,
            properties: { expiresOn: undefined, version: '1' },
          })
        },
      }))
      vi.doMock('@azure/identity', () => ({
        DefaultAzureCredential: class {},
      }))

      const { getSecret, clearSecretCache } = await loadModule()
      await expect(getSecret('empty-secret')).rejects.toThrow(/has no value/)
      clearSecretCache()
    })
  })
})
