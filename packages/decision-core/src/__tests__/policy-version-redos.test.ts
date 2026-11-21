import { describe, expect, it } from 'vitest'
import { isValidPolicyVersion } from '../enforceDecision'

const OLD = /^(?:\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*|\d{4}-\d{2}-\d{2}(?:\.\d+)?)$/

describe('isValidPolicyVersion', () => {
  const samples = [
    '1.2.3', '1.2.3-rc.1', '1.2.3-rc.1+sha.abc', '1.2.3+build', '1.2.3-a-b+c-d+e', '1.2.3-', '1.2.3+',
    '1.2.3++a', '1.2.3-+a', '1.2.3+-a', '1.2', '2026-01-02', '2026-01-02.4', '2026-01-02.', '', ' ', 'abc',
    '1.2.3 ', '1.2.3-é',
  ]
  it.each(samples)('matches previous behaviour for %j', (s) => {
    expect(isValidPolicyVersion(s)).toBe(OLD.test(s.trim()))
  })

  it('rejects adversarial input in linear time', () => {
    const t0 = Date.now()
    expect(isValidPolicyVersion('1.2.3-' + 'a'.repeat(50_000) + '!')).toBe(false)
    expect(isValidPolicyVersion('1.2.3' + '-a'.repeat(25_000) + '!')).toBe(false)
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})
