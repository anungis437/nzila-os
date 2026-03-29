import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptToken, decryptToken } from './qbo-token-crypto'

// 32-byte DEK for tests (hex)
const TEST_DEK = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'

describe('qbo-token-crypto', () => {
  let origKey: string | undefined
  let origKv: string | undefined

  beforeEach(() => {
    origKey = process.env.QBO_TOKEN_ENCRYPTION_KEY
    origKv = process.env.AZURE_KEYVAULT_URL
  })

  afterEach(() => {
    if (origKey === undefined) delete process.env.QBO_TOKEN_ENCRYPTION_KEY
    else process.env.QBO_TOKEN_ENCRYPTION_KEY = origKey
    if (origKv === undefined) delete process.env.AZURE_KEYVAULT_URL
    else process.env.AZURE_KEYVAULT_URL = origKv
  })

  it('round-trips tokens through encrypt→decrypt', () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const plaintext = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token'

    const encrypted = encryptToken(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted.startsWith('enc:v1:')).toBe(true)

    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for same plaintext (random IV)', () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const plaintext = 'same-token-value'

    const a = encryptToken(plaintext)
    const b = encryptToken(plaintext)
    expect(a).not.toBe(b) // different IVs
  })

  it('returns plaintext when no key is set', () => {
    delete process.env.QBO_TOKEN_ENCRYPTION_KEY
    delete process.env.AZURE_KEYVAULT_URL
    const plaintext = 'access-token-abc'

    expect(encryptToken(plaintext)).toBe(plaintext)
  })

  it('decrypts legacy plaintext (no enc: prefix) as-is', () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const legacy = 'old-plaintext-token'

    expect(decryptToken(legacy)).toBe(legacy)
  })

  it('throws on decrypt when key is missing but token is encrypted', () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK
    const encrypted = encryptToken('secret')

    // Remove key
    delete process.env.QBO_TOKEN_ENCRYPTION_KEY
    expect(() => decryptToken(encrypted)).toThrow('Cannot decrypt token')
  })

  it('rejects malformed encrypted strings', () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = TEST_DEK

    expect(() => decryptToken('enc:v1:only-one-part')).toThrow('Malformed encrypted token')
  })
})
