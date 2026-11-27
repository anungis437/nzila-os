import { describe, expect, it } from 'vitest'
import { base32Decode } from './totp'

describe('base32Decode padding/whitespace handling (ReDoS hardening)', () => {
  it('still strips padding and whitespace identically', () => {
    expect(base32Decode('MZXW6===').toString()).toBe('foo')
    expect(base32Decode('mzxw 6yq=').toString()).toBe('foob')
    expect(base32Decode('MZXW6YTB').toString()).toBe('fooba')
  })

  it('handles adversarial long inputs quickly', () => {
    const t0 = Date.now()
    expect(() => base32Decode('A' + '='.repeat(50_000) + '!')).toThrow('Invalid base32 character')
    expect(base32Decode('='.repeat(50_000)).length).toBe(0)
    expect(() => base32Decode('A' + ' '.repeat(50_000) + '!')).toThrow('Invalid base32 character')
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})
