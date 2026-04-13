/**
 * @nzila/secrets — KeyVaultClient comprehensive tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the Azure SDK dynamic imports — use vi.hoisted so mocks survive vi.mock hoisting
const { mockGetSecret, mockSetSecret, MockSecretClient, MockDefaultAzureCredential } = vi.hoisted(() => {
  const mockGetSecret = vi.fn()
  const mockSetSecret = vi.fn()
  return {
    mockGetSecret,
    mockSetSecret,
    // Must use regular function (not arrow) so `new` works
    MockSecretClient: vi.fn().mockImplementation(function (this: any) {
      this.getSecret = mockGetSecret
      this.setSecret = mockSetSecret
    }),
    MockDefaultAzureCredential: vi.fn(),
  }
})

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: MockDefaultAzureCredential,
}))

vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: MockSecretClient,
}))

import { KeyVaultClient, getSecret, setSecret } from '../keyvault'

describe('KeyVaultClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses config with defaults', () => {
    const client = new KeyVaultClient({ vaultUrl: 'https://myvault.vault.azure.net' })
    expect(client).toBeDefined()
  })

  it('throws on invalid vaultUrl', () => {
    expect(() => new KeyVaultClient({ vaultUrl: 'not-a-url' })).toThrow()
  })

  describe('get', () => {
    it('returns cached value when not expired', async () => {
      const client = new KeyVaultClient({ vaultUrl: 'https://myvault.vault.azure.net' })

      // First call — populates cache via Key Vault
      mockGetSecret.mockResolvedValueOnce({ value: 'secret-val' })
      const val1 = await client.get('my-secret')
      expect(val1).toBe('secret-val')

      // Second call — should use cache (no new getSecret call)
      const val2 = await client.get('my-secret')
      expect(val2).toBe('secret-val')
      expect(mockGetSecret).toHaveBeenCalledTimes(1)
    })

    it('refetches from Key Vault when cache expires', async () => {
      const client = new KeyVaultClient({
        vaultUrl: 'https://myvault.vault.azure.net',
        cacheTtlMs: 1, // 1ms TTL — will expire immediately
      })

      mockGetSecret.mockResolvedValueOnce({ value: 'v1' })
      await client.get('my-secret')

      // Wait for cache to expire
      await new Promise((r) => setTimeout(r, 10))

      mockGetSecret.mockResolvedValueOnce({ value: 'v2' })
      const val = await client.get('my-secret')
      expect(val).toBe('v2')
      expect(mockGetSecret).toHaveBeenCalledTimes(2)
    })

    it('falls back to env var in development when Key Vault fails', async () => {
      const client = new KeyVaultClient({
        vaultUrl: 'https://myvault.vault.azure.net',
        environment: 'development',
      })

      mockGetSecret.mockRejectedValueOnce(new Error('KV unavailable'))
      vi.stubEnv('MY_SECRET', 'env-value')

      const val = await client.get('my-secret')
      expect(val).toBe('env-value')

      vi.unstubAllEnvs()
    })

    it('converts secret name to env var format: dashes to underscores, uppercased', async () => {
      const client = new KeyVaultClient({
        vaultUrl: 'https://myvault.vault.azure.net',
        environment: 'development',
      })

      mockGetSecret.mockRejectedValueOnce(new Error('fail'))
      vi.stubEnv('DB_CONNECTION_STRING', 'pg://localhost')

      const val = await client.get('db-connection-string')
      expect(val).toBe('pg://localhost')

      vi.unstubAllEnvs()
    })

    it('does NOT fall back to env in production', async () => {
      const client = new KeyVaultClient({
        vaultUrl: 'https://myvault.vault.azure.net',
        environment: 'production',
      })

      mockGetSecret.mockRejectedValueOnce(new Error('fail'))
      vi.stubEnv('MY_SECRET', 'should-not-use')

      const val = await client.get('my-secret')
      expect(val).toBeUndefined()

      vi.unstubAllEnvs()
    })

    it('returns undefined when Key Vault returns no value', async () => {
      const client = new KeyVaultClient({
        vaultUrl: 'https://myvault.vault.azure.net',
        environment: 'production',
      })

      mockGetSecret.mockResolvedValueOnce({ value: undefined })
      const val = await client.get('empty-secret')
      expect(val).toBeUndefined()
    })

    it('handles Key Vault client creation failure gracefully', async () => {
      // Reset mock to simulate import failure
      MockSecretClient.mockImplementationOnce(() => {
        throw new Error('import failed')
      })

      const client = new KeyVaultClient({
        vaultUrl: 'https://myvault.vault.azure.net',
        environment: 'development',
      })

      vi.stubEnv('FALLBACK_KEY', 'fallback')
      const val = await client.get('fallback-key')
      expect(val).toBe('fallback')

      vi.unstubAllEnvs()
    })
  })

  describe('invalidate', () => {
    it('removes a specific secret from cache', async () => {
      const client = new KeyVaultClient({ vaultUrl: 'https://myvault.vault.azure.net' })

      mockGetSecret.mockResolvedValueOnce({ value: 'cached-val' })
      await client.get('my-secret')

      client.invalidate('my-secret')

      // Next get should call Key Vault again
      mockGetSecret.mockResolvedValueOnce({ value: 'new-val' })
      const val = await client.get('my-secret')
      expect(val).toBe('new-val')
      expect(mockGetSecret).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearCache', () => {
    it('clears all cached secrets', async () => {
      const client = new KeyVaultClient({ vaultUrl: 'https://myvault.vault.azure.net' })

      mockGetSecret.mockResolvedValueOnce({ value: 'a' })
      await client.get('secret-a')

      mockGetSecret.mockResolvedValueOnce({ value: 'b' })
      await client.get('secret-b')

      client.clearCache()

      // Both should re-fetch
      mockGetSecret.mockResolvedValueOnce({ value: 'a2' })
      const valA = await client.get('secret-a')
      expect(valA).toBe('a2')
      expect(mockGetSecret).toHaveBeenCalledTimes(3)
    })
  })
})

// ── getSecret standalone function ───────────────────────────────────────────

describe('getSecret (standalone)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to env var when no AZURE_KEY_VAULT_URL', async () => {
    vi.stubEnv('AZURE_KEY_VAULT_URL', '')
    vi.stubEnv('MY_SECRET', 'env-secret')

    // When AZURE_KEY_VAULT_URL is falsy, return env var directly
    const val = await getSecret('my-secret')
    expect(val).toBe('env-secret')
  })

  it('returns undefined when no vault URL and no matching env', async () => {
    vi.stubEnv('AZURE_KEY_VAULT_URL', '')

    const val = await getSecret('nonexistent-secret')
    expect(val).toBeUndefined()
  })

  it('uses Key Vault when URL is set', async () => {
    vi.stubEnv('AZURE_KEY_VAULT_URL', 'https://myvault.vault.azure.net')
    vi.stubEnv('NODE_ENV', 'production')

    mockGetSecret.mockResolvedValueOnce({ value: 'kv-value' })
    const val = await getSecret('my-secret')
    expect(val).toBe('kv-value')
  })
})

// ── setSecret standalone function ───────────────────────────────────────────

describe('setSecret (standalone)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws when no AZURE_KEY_VAULT_URL', async () => {
    vi.stubEnv('AZURE_KEY_VAULT_URL', '')

    await expect(setSecret('key', 'value')).rejects.toThrow(
      'AZURE_KEY_VAULT_URL is required',
    )
  })

  it('sets secret in Key Vault', async () => {
    vi.stubEnv('AZURE_KEY_VAULT_URL', 'https://myvault.vault.azure.net')
    mockSetSecret.mockResolvedValueOnce({})

    await setSecret('my-secret', 'my-value')

    expect(MockSecretClient).toHaveBeenCalled()
    expect(mockSetSecret).toHaveBeenCalledWith('my-secret', 'my-value')
  })

  it('wraps Azure SDK errors with context', async () => {
    vi.stubEnv('AZURE_KEY_VAULT_URL', 'https://myvault.vault.azure.net')
    mockSetSecret.mockRejectedValueOnce(new Error('Forbidden'))

    await expect(setSecret('my-secret', 'val')).rejects.toThrow(
      'Failed to set secret my-secret: Forbidden',
    )
  })

  it('wraps non-Error throws with context', async () => {
    vi.stubEnv('AZURE_KEY_VAULT_URL', 'https://myvault.vault.azure.net')
    mockSetSecret.mockRejectedValueOnce('unknown error')

    await expect(setSecret('my-secret', 'val')).rejects.toThrow(
      'Failed to set secret my-secret: Unknown error',
    )
  })
})
