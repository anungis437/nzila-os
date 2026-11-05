import { describe, expect, it } from 'vitest'
import { fitPostgresIdentifier } from '../runtime/postgres-identifier'

describe('PostgreSQL generated identifier safety', () => {
  it('preserves identifiers within the 63-byte PostgreSQL limit', () => {
    expect(fitPostgresIdentifier('dues_rate_org_key')).toBe('dues_rate_org_key')
    expect(fitPostgresIdentifier('a'.repeat(63))).toBe('a'.repeat(63))
  })

  it('hashes long constraint names deterministically without exceeding 63 bytes', () => {
    const original = `billing_${'membership_'.repeat(9)}_key`
    const first = fitPostgresIdentifier(original)
    expect(Buffer.byteLength(first, 'utf8')).toBe(63)
    expect(first).toMatch(/_[0-9a-f]{16}$/)
    expect(fitPostgresIdentifier(original)).toBe(first)
  })

  it('distinguishes names that would otherwise collide after PostgreSQL truncation', () => {
    const common = 'x'.repeat(70)
    expect(fitPostgresIdentifier(common + '_first')).not.toBe(fitPostgresIdentifier(common + '_second'))
  })

  it('counts UTF-8 bytes and never splits a multibyte code point', () => {
    const identifier = 'é'.repeat(50) + '_key'
    const fitted = fitPostgresIdentifier(identifier)
    expect(Buffer.byteLength(fitted, 'utf8')).toBeLessThanOrEqual(63)
    expect(fitted).toMatch(/_[0-9a-f]{16}$/)
    expect(fitted).not.toContain('�')
  })
})
