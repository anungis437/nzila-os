/**
 * Tests for the in-house RFC 6238 TOTP implementation + RFC 4648 base32.
 *
 * These are pure / deterministic — no DB, no env, no network.
 */
import { describe, it, expect } from 'vitest'
import {
  generateTotpSecret,
  computeTotp,
  verifyTotp,
  buildOtpAuthUri,
  generateRecoveryCodes,
} from './totp'

describe('TOTP secret generation', () => {
  it('generates a 32-character base32 secret', () => {
    const s = generateTotpSecret()
    expect(s).toMatch(/^[A-Z2-7]{32}$/)
  })

  it('is reasonably unique across calls', () => {
    const set = new Set<string>()
    for (let i = 0; i < 50; i++) set.add(generateTotpSecret())
    expect(set.size).toBe(50)
  })
})

describe('TOTP compute + verify', () => {
  // A fixed secret + fixed time yields a fixed 6-digit code
  const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'

  it('compute produces a 6-digit numeric string', () => {
    const code = computeTotp(SECRET, 1_700_000_000_000)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('same secret + same time → same code', () => {
    const t = 1_700_000_030_000
    expect(computeTotp(SECRET, t)).toBe(computeTotp(SECRET, t))
  })

  it('verify accepts the exact-step code', () => {
    const t = 1_700_000_000_000
    const code = computeTotp(SECRET, t)
    expect(verifyTotp(SECRET, code, t)).toBe(true)
  })

  it('verify accepts the previous step (30s earlier) within the ±1 window', () => {
    const t = 1_700_000_030_000
    const earlierCode = computeTotp(SECRET, t - 30_000)
    expect(verifyTotp(SECRET, earlierCode, t)).toBe(true)
  })

  it('verify accepts the next step (30s later) within the ±1 window', () => {
    const t = 1_700_000_030_000
    const laterCode = computeTotp(SECRET, t + 30_000)
    expect(verifyTotp(SECRET, laterCode, t)).toBe(true)
  })

  it('verify rejects a code two steps out of window', () => {
    const t = 1_700_000_120_000
    const staleCode = computeTotp(SECRET, t - 90_000)
    expect(verifyTotp(SECRET, staleCode, t)).toBe(false)
  })

  it('verify rejects a blatantly wrong code', () => {
    expect(verifyTotp(SECRET, '000000', 1_700_000_000_000)).toBe(false)
  })

  it('verify rejects non-6-digit strings', () => {
    expect(verifyTotp(SECRET, '12345', 1_700_000_000_000)).toBe(false)
    expect(verifyTotp(SECRET, '1234567', 1_700_000_000_000)).toBe(false)
    expect(verifyTotp(SECRET, 'abcdef', 1_700_000_000_000)).toBe(false)
  })
})

describe('otpauth URI', () => {
  it('builds a well-formed otpauth:// URI', () => {
    const uri = buildOtpAuthUri('JBSWY3DPEHPK3PXP', 'user@example.com', 'Union Eyes')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=Union+Eyes')
    expect(uri).toContain('user%40example.com')
  })
})

describe('recovery codes', () => {
  it('generates 10 codes by default', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
  })

  it('generates the requested count', () => {
    expect(generateRecoveryCodes(5)).toHaveLength(5)
  })

  it('each code matches the XXXX-XXXX-XX shape', () => {
    for (const c of generateRecoveryCodes()) {
      expect(c).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{2}$/)
    }
  })

  it('codes are unique within a batch', () => {
    const codes = generateRecoveryCodes(20)
    expect(new Set(codes).size).toBe(20)
  })
})
