import { describe, expect, it } from 'vitest'
import { isExactVersion } from './registry'
import { parseSkillDocument } from './skill'

const OLD_EXACT = /^\d+(?:\.\d+)*(?:[-+.][0-9A-Za-z.-]+)?$/

describe('isExactVersion', () => {
  const samples = [
    '1', '1.2', '1.2.3', '1.2.3-rc.1', '1.2.3+build', '1.2.3.', '1.2.3.4', '1.2.3.a', '1.2+beta', '1.2.3+a+b',
    '1.2.3-a+b', '1+x', '1-x', '1.', '1-', '1+', '.1', 'a', '', '1.2.3-é', '1.2..3', '1..2', 'v1.2.3',
  ]
  it.each(samples)('matches previous behaviour for %j', (s) => {
    expect(isExactVersion(s)).toBe(OLD_EXACT.test(s))
  })

  it('rejects adversarial input quickly', () => {
    const t0 = Date.now()
    expect(isExactVersion('1' + '.1'.repeat(25_000) + '!')).toBe(false)
    expect(isExactVersion('1' + '.1'.repeat(25_000) + '+')).toBe(false)
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})

describe('parseSkillDocument parsing (ReDoS hardening)', () => {
  const src = { ref: 'x', fetchedAt: '2026-01-01T00:00:00Z' }

  it('adversarial frontmatter / headings complete quickly', () => {
    const t0 = Date.now()
    const raw = [
      '---',
      'a' + ' '.repeat(50_000) + 'x',
      'name' + ' '.repeat(50_000) + ': ' + ' '.repeat(50_000) + 'v',
      '---',
      '##' + ' '.repeat(50_000),
      '###' + ' '.repeat(50_000) + 'z',
      '',
    ].join('\n')
    try { parseSkillDocument(raw, src) } catch { /* size limit or validation is fine */ }
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})
