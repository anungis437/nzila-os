import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { authUsers } from '../schema/auth'
import { AUTH_EMAIL_PATTERN, LEGACY_AUTH_EMAIL_PATTERN } from '../auth-email-check'

describe('canonical auth email storage envelope', () => {
  const current = new RegExp(AUTH_EMAIL_PATTERN, 'i')
  it.each([
    'new+release@example.invalid', "o'brien@example.invalid",
    "o'brien+release@example.invalid", 'First.Last+Tag@sub.example.invalid',
    'old_percent%address@example.invalid', 'legacy_underscore@example.invalid',
  ])('preserves the complete address %s', email => {
    expect(current.test(email)).toBe(true)
  })
  it('contains the application validator alphabet and preserves the legacy alphabet', () => {
    for (const local of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_+\'-'.split('')) {
      for (const email of [`a${local}b@example.invalid`, `a.${local}b@sub.example.invalid`]) {
        expect(z.email().safeParse(email).success).toBe(true)
        expect(current.test(email)).toBe(true)
      }
    }
    const legacy = new RegExp(LEGACY_AUTH_EMAIL_PATTERN, 'i')
    for (const char of 'aZ09._%-') {
      const email = `old${char}address@example.invalid`
      expect(legacy.test(email)).toBe(true)
      expect(current.test(email)).toBe(true)
    }
  })
  it.each(['a b@example.invalid', 'a@@example.invalid', 'a@example', '@example.invalid', 'a@example.1'])('retains rejection of %s', email => {
    expect(current.test(email)).toBe(false)
  })
  it('compiles the canonical Drizzle check with a quoted apostrophe and no SQL parameters', () => {
    const check = getTableConfig(authUsers).checks.find(value => value.name === 'valid_email')!
    const compiled = new PgDialect().sqlToQuery(check.value)
    expect(compiled.params).toEqual([])
    expect(compiled.sql).toContain("[A-Za-z0-9._%''+-]")
  })
})
