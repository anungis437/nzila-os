import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertQboTokenStorageAvailable, encryptToken, decryptToken } from '../qbo-token-crypto'

vi.mock('@nzila/os-core', () => ({ createLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }))
afterEach(() => vi.unstubAllEnvs())

describe('existing QBO token encryption fails closed for production storage', () => {
  it.each([undefined, 'https://owned-vault.invalid'])(
    'refuses missing production key with Azure configuration%s',
    (vault) => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('AZURE_KEYVAULT_URL', vault)
      vi.stubEnv('QBO_TOKEN_ENCRYPTION_KEY', '')
      expect(assertQboTokenStorageAvailable).toThrow('required in production')
      expect(() => encryptToken('synthetic-oauth-token')).toThrow('required in production')
    },
  )
  it.each(['zz'.repeat(32), '01'.repeat(31), '01'.repeat(33), ' ' + '01'.repeat(32)])(
    'rejects malformed configured key before encryption',
    (key) => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('AZURE_KEYVAULT_URL', 'https://owned-vault.invalid')
      vi.stubEnv('QBO_TOKEN_ENCRYPTION_KEY', key)
      expect(() => encryptToken('synthetic-oauth-token')).toThrow('exactly 64 hexadecimal')
    },
  )
  it('retains randomized authenticated ciphertext, correct decryption and tamper refusal', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AZURE_KEYVAULT_URL', 'https://owned-vault.invalid')
    vi.stubEnv('QBO_TOKEN_ENCRYPTION_KEY', '01'.repeat(32))
    const first = encryptToken('synthetic-oauth-token'),
      second = encryptToken('synthetic-oauth-token')
    expect(first).toMatch(/^enc:v1:[a-f0-9]{24}:[a-f0-9]+:[a-f0-9]{32}$/)
    expect(first).not.toBe(second)
    expect(first).not.toContain('synthetic-oauth-token')
    expect(decryptToken(first)).toBe('synthetic-oauth-token')
    const parts = first.split(':')
    parts[4] = (parts[4][0] === '0' ? '1' : '0') + parts[4].slice(1)
    expect(() => decryptToken(parts.join(':'))).toThrow()
  })
  it('retains explicitly nonproduction missing-key compatibility', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('QBO_TOKEN_ENCRYPTION_KEY', '')
    vi.stubEnv('AZURE_KEYVAULT_URL', undefined)
    expect(encryptToken('synthetic-local-token')).toBe('synthetic-local-token')
  })
})
