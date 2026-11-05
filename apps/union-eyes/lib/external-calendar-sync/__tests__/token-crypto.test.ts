import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptCalendarToken, encryptCalendarToken } from '../token-crypto'

const KEY = '11'.repeat(32)

afterEach(() => vi.unstubAllEnvs())

describe('B51 calendar token storage (DEF-0B4-CALENDAR-TOKEN-PLAINTEXT-FALLBACK)', () => {
  it('encrypts with a key and round-trips', () => {
    vi.stubEnv('CALENDAR_TOKEN_ENCRYPTION_KEY', KEY)
    const stored = encryptCalendarToken('secret-token')
    expect(stored).toMatch(/^enc:v1:/)
    expect(stored).not.toContain('secret-token')
    expect(decryptCalendarToken(stored)).toBe('secret-token')
  })

  it.each(['development', 'production'])('refuses to store a token with no key in %s', (env) => {
    vi.stubEnv('NODE_ENV', env)
    vi.stubEnv('CALENDAR_TOKEN_ENCRYPTION_KEY', '')
    vi.stubEnv('FALLBACK_ENCRYPTION_KEY', '')
    expect(() => encryptCalendarToken('secret-token')).toThrow(/Missing CALENDAR_TOKEN_ENCRYPTION_KEY/)
  })

  it('does not read an unencrypted stored value outside tests unless legacy reads are flagged', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CALENDAR_TOKEN_ENCRYPTION_KEY', KEY)
    expect(() => decryptCalendarToken('plain-token')).toThrow(/stored unencrypted/)
    vi.stubEnv('CALENDAR_TOKEN_ALLOW_LEGACY_PLAINTEXT', 'true')
    expect(decryptCalendarToken('plain-token')).toBe('plain-token')
  })
})
