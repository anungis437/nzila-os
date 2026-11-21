import { describe, expect, it } from 'vitest'
import { isValidPolicyVersion } from '../enforceDecision'

// Expected results of the previous (backtracking) pattern, recorded as data so this file carries no vulnerable regex.
const PREVIOUS_BEHAVIOUR: ReadonlyArray<readonly [string, boolean]> = [
  ['1.2.3', true], ['1.2.3-rc.1', true], ['1.2.3-rc.1+sha.abc', true], ['1.2.3+build', true], ['1.2.3-a-b+c-d+e', true],
  ['1.2.3-', false], ['1.2.3+', false], ['1.2.3++a', false], ['1.2.3-+a', false], ['1.2.3+-a', true], ['1.2', false],
  ['2026-01-02', true], ['2026-01-02.4', true], ['2026-01-02.', false], ['', false], [' ', false], ['abc', false],
  ['1.2.3 ', true], ['1.2.3-é', false],
]

describe('isValidPolicyVersion', () => {
  it.each(PREVIOUS_BEHAVIOUR)('matches previous behaviour for %j', (sample, expected) => {
    expect(isValidPolicyVersion(sample)).toBe(expected)
  })

  it('rejects adversarial input in linear time', () => {
    const t0 = Date.now()
    expect(isValidPolicyVersion('1.2.3-' + 'a'.repeat(50_000) + '!')).toBe(false)
    expect(isValidPolicyVersion('1.2.3' + '-a'.repeat(25_000) + '!')).toBe(false)
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})
