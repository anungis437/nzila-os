/**
 * @nzila/platform-shell — Default modules validation tests
 *
 * Ensures every module definition has required fields and valid data.
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_MODULES } from './default-modules'

describe('DEFAULT_MODULES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_MODULES)).toBe(true)
    expect(DEFAULT_MODULES.length).toBeGreaterThan(0)
  })

  it('all modules have unique ids', () => {
    const ids = DEFAULT_MODULES.map((m) => m.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('all modules have required string fields', () => {
    for (const mod of DEFAULT_MODULES) {
      expect(mod.id).toBeTruthy()
      expect(typeof mod.name).toBe('string')
      expect(typeof mod.description).toBe('string')
      expect(typeof mod.basePath).toBe('string')
      expect(typeof mod.iconToken).toBe('string')
      expect(typeof mod.packageName).toBe('string')
      expect(typeof mod.owner).toBe('string')
    }
  })

  it('all modules have valid tier', () => {
    const validTiers = ['PRODUCTION', 'PILOT', 'INCUBATING', 'DEPRECATED']
    for (const mod of DEFAULT_MODULES) {
      expect(validTiers).toContain(mod.tier)
    }
  })

  it('all modules have numeric navOrder and devPort', () => {
    for (const mod of DEFAULT_MODULES) {
      expect(typeof mod.navOrder).toBe('number')
      expect(typeof mod.devPort).toBe('number')
    }
  })

  it('all modules have arrays for requiredRoles and requiredEntitlements', () => {
    for (const mod of DEFAULT_MODULES) {
      expect(Array.isArray(mod.requiredRoles)).toBe(true)
      expect(Array.isArray(mod.requiredEntitlements)).toBe(true)
    }
  })

  it('includes known core modules', () => {
    const ids = DEFAULT_MODULES.map((m) => m.id)
    expect(ids).toContain('union-eyes')
    expect(ids).toContain('flow')
    expect(ids).toContain('web')
    expect(ids).toContain('console')
  })

  it('nav modules have showInNav=true and non-999 navOrder', () => {
    const navModules = DEFAULT_MODULES.filter((m) => m.showInNav)
    expect(navModules.length).toBeGreaterThan(0)
    for (const mod of navModules) {
      expect(mod.navOrder).toBeLessThan(999)
    }
  })
})
