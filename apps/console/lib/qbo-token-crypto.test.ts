import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptToken, decryptToken } from './qbo-token-crypto'

// 32-byte DEK for tests (hex)
const TEST_DEK = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
const env = process.env as Record<string, string | undefined>

describe('qbo-token-crypto', () => {
  let origKey: string | undefined
  let origKv: string | undefined
  let origNodeEnv: string | undefined

  beforeEach(() => {
    origKey = env.QBO_TOKEN_ENCRYPTION_KEY
    origKv = env.AZURE_KEYVAULT_URL
    origNodeEnv = env.NODE_ENV
  })

  afterEach(() => {
    if (origKey === undefined) delete env.QBO_TOKEN_ENCRYPTION_KEY
    else env.QBO_TOKEN_ENCRYPTION_KEY = origKey
    if (origKv === undefined) delete env.AZURE_KEYVAULT_URL
    else env.AZURE_KEYVAULT_URL = origKv
    if (origNodeEnv === undefined) delete env.NODE_ENV
    else env.NODE_ENV = origNodeEnv
  })

  it('round-trips tokens through encrypt→decrypt', () => {
    env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const plaintext = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token'

    const encrypted = encryptToken(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted.startsWith('enc:v1:')).toBe(true)

    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for same plaintext (random IV)', () => {
    env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const plaintext = 'same-token-value'

    const a = encryptToken(plaintext)
    const b = encryptToken(plaintext)
    expect(a).not.toBe(b) // different IVs
  })

  it('returns plaintext when no key is set', () => {
    delete env.QBO_TOKEN_ENCRYPTION_KEY
    delete env.AZURE_KEYVAULT_URL
    const plaintext = 'access-token-abc'

    expect(encryptToken(plaintext)).toBe(plaintext)
  })

  it('decrypts legacy plaintext (no enc: prefix) as-is', () => {
    env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const legacy = 'old-plaintext-token'

    expect(decryptToken(legacy)).toBe(legacy)
  })

  it('throws on decrypt when key is missing but token is encrypted', () => {
    env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const encrypted = encryptToken('secret')

    // Remove key
    delete env.QBO_TOKEN_ENCRYPTION_KEY
    expect(() => decryptToken(encrypted)).toThrow('Cannot decrypt token')
  })

  it('rejects malformed encrypted strings', () => {
    env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK

    expect(() => decryptToken('enc:v1:only-one-part')).toThrow('Malformed encrypted token')
  })

  it('falls back to plaintext when key length is invalid', () => {
    env.QBO_TOKEN_ENCRYPTION_KEY = 'deadbeef'
    const plaintext = 'access-token-invalid-key'

    expect(encryptToken(plaintext)).toBe(plaintext)
  })

  it('falls back to plaintext when key vault URL is set but local key is missing', () => {
    env.AZURE_KEYVAULT_URL = 'https://example.vault.azure.net'
    delete env.QBO_TOKEN_ENCRYPTION_KEY

    expect(encryptToken('token')).toBe('token')
  })

  it('throws in production when no encryption key is configured', () => {
    delete env.QBO_TOKEN_ENCRYPTION_KEY
    delete env.AZURE_KEYVAULT_URL
    env.NODE_ENV = 'production'

    expect(() => encryptToken('token')).toThrow('QBO_TOKEN_ENCRYPTION_KEY')
  })

  it('uses local key when key vault URL is set', () => {
    env.AZURE_KEYVAULT_URL = 'https://example.vault.azure.net'
    env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK

    const encrypted = encryptToken('vault-backed-token')
    expect(encrypted.startsWith('enc:v1:')).toBe(true)
    expect(decryptToken(encrypted)).toBe('vault-backed-token')
  })
})
