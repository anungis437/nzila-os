/**
 * Unit tests — @nzila/tax/data-versions
 */
import { describe, it, expect } from 'vitest'
import {
  DATA_VERSIONS,
  STALENESS_THRESHOLD_DAYS,
  isModuleStale,
  selectStaleModules,
  getStaleModules,
  getModuleVersion,
  getLatestVerificationDate,
  type DataModuleVersion,
} from '../data-versions'

describe('DATA_VERSIONS', () => {
  it('has entries for all CRA data modules', () => {
    const moduleNames = DATA_VERSIONS.map((m) => m.module)
    expect(moduleNames).toContain('rates')
    expect(moduleNames).toContain('cra-deadlines')
    expect(moduleNames).toContain('bn-validation')
    expect(moduleNames).toContain('installments')
    expect(moduleNames).toContain('prescribed-interest')
    expect(moduleNames).toContain('gst-hst')
    expect(moduleNames).toContain('payroll-thresholds')
    expect(moduleNames).toContain('penalties')
    expect(moduleNames).toContain('personal-rates')
    expect(moduleNames).toContain('dividend-tax')
  })

  it('has 10 module entries', () => {
    expect(DATA_VERSIONS).toHaveLength(10)
  })

  it('every entry has lastVerified as ISO date', () => {
    for (const m of DATA_VERSIONS) {
      expect(m.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('STALENESS_THRESHOLD_DAYS', () => {
  it('is 90 days', () => {
    expect(STALENESS_THRESHOLD_DAYS).toBe(90)
  })
})

const AS_OF = new Date('2026-11-26T00:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function moduleOn(lastVerified: string, source = 'CRA fixture'): DataModuleVersion {
  return { module: 'fixture', taxYear: 2026, lastVerified, source }
}

describe('isModuleStale', () => {
  it('accepts a module verified on the evaluation instant', () => {
    expect(isModuleStale(moduleOn('2026-11-26'), AS_OF)).toBe(false)
  })

  it('accepts a module verified 89 days earlier', () => {
    const verified = new Date(AS_OF.getTime() - 89 * DAY_MS).toISOString().slice(0, 10)
    expect(isModuleStale(moduleOn(verified), AS_OF)).toBe(false)
  })

  it('keeps a module that is exactly 90 days old', () => {
    const verified = new Date(AS_OF.getTime() - 90 * DAY_MS).toISOString().slice(0, 10)
    expect(isModuleStale(moduleOn(verified), AS_OF)).toBe(false)
    expect(isModuleStale(moduleOn('2026-08-26'), new Date('2026-11-24T00:00:00.000Z'))).toBe(false)
  })

  it('rejects a module one millisecond past 90 days', () => {
    const atThreshold = new Date('2026-11-24T00:00:00.000Z')
    expect(isModuleStale(moduleOn('2026-08-26'), new Date(atThreshold.getTime() + 1))).toBe(true)
  })

  it('rejects a future verification date', () => {
    expect(isModuleStale(moduleOn('2026-11-27'), AS_OF)).toBe(true)
  })

  it('rejects invalid or missing verification metadata', () => {
    expect(isModuleStale(moduleOn('2026-02-31'), AS_OF)).toBe(true)
    expect(isModuleStale(moduleOn(''), AS_OF)).toBe(true)
    expect(isModuleStale(moduleOn('2026-11-26', '   '), AS_OF)).toBe(true)
  })

  it('crosses a leap-day boundary by elapsed UTC time', () => {
    const verified = new Date(Date.UTC(2024, 1, 29))
    const exactlyNinety = new Date(verified.getTime() + 90 * DAY_MS)
    expect(isModuleStale(moduleOn('2024-02-29'), exactlyNinety)).toBe(false)
    expect(isModuleStale(moduleOn('2024-02-29'), new Date(exactlyNinety.getTime() + 1))).toBe(true)
  })

  it('uses the UTC date boundary rather than a local offset', () => {
    const beforeUtcMidnight = new Date('2026-11-23T23:59:59.999Z')
    expect(isModuleStale(moduleOn('2026-08-26'), beforeUtcMidnight)).toBe(false)
    expect(isModuleStale(moduleOn('2026-08-26'), new Date('2026-11-24T00:00:00.001Z'))).toBe(true)
  })
})

describe('selectStaleModules', () => {
  it('returns only the modules that fail the explicit evaluation instant', () => {
    const modules = [
      { ...moduleOn('2026-11-26'), module: 'fresh' },
      { ...moduleOn('2026-08-26'), module: 'stale' },
      { ...moduleOn('2026-11-27'), module: 'future' },
    ]
    expect(selectStaleModules(modules, AS_OF).map((module) => module.module)).toEqual(['stale', 'future'])
  })
})

describe('getStaleModules', () => {
  it('evaluates the recorded registry from the supplied instant', () => {
    expect(getStaleModules(new Date('2026-08-26T00:00:00.000Z'))).toHaveLength(0)
    expect(getStaleModules(new Date('2026-11-24T00:00:00.000Z'))).toHaveLength(0)
    expect(getStaleModules(AS_OF)).toHaveLength(DATA_VERSIONS.length)
    expect(DATA_VERSIONS.every((module) => module.lastVerified === '2026-08-26')).toBe(true)
  })
})

describe('getModuleVersion', () => {
  it('returns version for known module', () => {
    const v = getModuleVersion('rates')
    expect(v).toBeDefined()
    expect(v!.module).toBe('rates')
  })

  it('returns undefined for unknown module', () => {
    expect(getModuleVersion('nonexistent')).toBeUndefined()
  })
})

describe('getLatestVerificationDate', () => {
  it('returns a valid ISO date string', () => {
    const d = getLatestVerificationDate()
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(d).getTime()).toBeGreaterThan(0)
  })
})
