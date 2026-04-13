/**
 * @nzila/os-core — Super Admin tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { isSuperAdmin, _resetSuperAdminCache } from '../config/super-admins'

describe('isSuperAdmin', () => {
  beforeEach(() => {
    _resetSuperAdminCache()
  })

  afterEach(() => {
    delete process.env.SUPER_ADMIN_EMAILS
    _resetSuperAdminCache()
  })

  it('returns true for builtin super-admin emails', () => {
    expect(isSuperAdmin('info@nzilaventures.com')).toBe(true)
    expect(isSuperAdmin('support@onelabtech.com')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isSuperAdmin('INFO@NzilaVentures.COM')).toBe(true)
    expect(isSuperAdmin('SUPPORT@ONELABTECH.COM')).toBe(true)
  })

  it('returns false for non-admin emails', () => {
    expect(isSuperAdmin('random@example.com')).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isSuperAdmin(null)).toBe(false)
    expect(isSuperAdmin(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isSuperAdmin('')).toBe(false)
  })

  it('picks up SUPER_ADMIN_EMAILS env var', () => {
    process.env.SUPER_ADMIN_EMAILS = 'extra@test.com, another@test.com'
    _resetSuperAdminCache()

    expect(isSuperAdmin('extra@test.com')).toBe(true)
    expect(isSuperAdmin('another@test.com')).toBe(true)
    // builtins still work
    expect(isSuperAdmin('info@nzilaventures.com')).toBe(true)
  })

  it('ignores invalid email entries with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.SUPER_ADMIN_EMAILS = 'not-an-email, valid@test.com'
    _resetSuperAdminCache()

    expect(isSuperAdmin('valid@test.com')).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid SUPER_ADMIN_EMAILS entry'),
    )

    warnSpy.mockRestore()
  })

  it('trims whitespace in env var entries', () => {
    process.env.SUPER_ADMIN_EMAILS = '  spaced@test.com  ,  trimmed@test.com  '
    _resetSuperAdminCache()

    expect(isSuperAdmin('spaced@test.com')).toBe(true)
    expect(isSuperAdmin('trimmed@test.com')).toBe(true)
  })

  it('cache is reused on subsequent calls', () => {
    // First call initializes cache
    isSuperAdmin('info@nzilaventures.com')
    // Change env var — should NOT be picked up (cache)
    process.env.SUPER_ADMIN_EMAILS = 'new@test.com'

    expect(isSuperAdmin('new@test.com')).toBe(false) // cached set doesn't include it
  })
})
