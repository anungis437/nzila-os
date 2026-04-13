import { describe, it, expect } from 'vitest'
import {
  computeExpiryDate,
  isExpired,
  DEFAULT_RETENTION_POLICIES,
  RETENTION_DURATION_DAYS,
  type RetentionClass,
} from '../policies'

describe('retention/policies', () => {
  describe('RETENTION_DURATION_DAYS', () => {
    it('PERMANENT is null (never expires)', () => {
      expect(RETENTION_DURATION_DAYS['PERMANENT']).toBeNull()
    })

    it('7_YEARS is 2555 days', () => {
      expect(RETENTION_DURATION_DAYS['7_YEARS']).toBe(7 * 365)
    })

    it('30_DAYS is 30', () => {
      expect(RETENTION_DURATION_DAYS['30_DAYS']).toBe(30)
    })
  })

  describe('computeExpiryDate', () => {
    it('returns null for PERMANENT', () => {
      expect(computeExpiryDate('PERMANENT', new Date('2026-01-01'))).toBeNull()
    })

    it('returns correct date for 30_DAYS', () => {
      const created = new Date('2026-01-01T00:00:00Z')
      const expiry = computeExpiryDate('30_DAYS', created)!
      expect(expiry.toISOString().slice(0, 10)).toBe('2026-01-31')
    })

    it('returns correct date for 1_YEAR', () => {
      const created = new Date('2026-01-01T00:00:00Z')
      const expiry = computeExpiryDate('1_YEAR', created)!
      expect(expiry.toISOString().slice(0, 10)).toBe('2027-01-01')
    })

    it('returns correct date for 90_DAYS', () => {
      const created = new Date('2026-01-01T00:00:00Z')
      const expiry = computeExpiryDate('90_DAYS', created)!
      const diff = (expiry.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      expect(Math.round(diff)).toBe(90)
    })
  })

  describe('isExpired', () => {
    it('PERMANENT never expires', () => {
      const created = new Date('2000-01-01')
      expect(isExpired('PERMANENT', created, new Date('2099-01-01'))).toBe(false)
    })

    it('returns false if within retention period', () => {
      const created = new Date('2026-01-01')
      expect(isExpired('90_DAYS', created, new Date('2026-02-01'))).toBe(false)
    })

    it('returns true if past retention period', () => {
      const created = new Date('2026-01-01')
      expect(isExpired('30_DAYS', created, new Date('2026-03-01'))).toBe(true)
    })

    it('returns true on exact expiry date', () => {
      const created = new Date('2026-01-01T00:00:00Z')
      const expiry = computeExpiryDate('30_DAYS', created)!
      expect(isExpired('30_DAYS', created, expiry)).toBe(true)
    })
  })

  describe('DEFAULT_RETENTION_POLICIES', () => {
    it('includes evidence_pack (7 years, immutable)', () => {
      const ep = DEFAULT_RETENTION_POLICIES.find((p) => p.category === 'evidence_pack')
      expect(ep).toBeDefined()
      expect(ep!.retentionClass).toBe('7_YEARS')
      expect(ep!.immutable).toBe(true)
    })

    it('includes governance_resolution (PERMANENT)', () => {
      const gr = DEFAULT_RETENTION_POLICIES.find((p) => p.category === 'governance_resolution')
      expect(gr).toBeDefined()
      expect(gr!.retentionClass).toBe('PERMANENT')
    })

    it('includes session_log (90 days, deletable)', () => {
      const sl = DEFAULT_RETENTION_POLICIES.find((p) => p.category === 'session_log')
      expect(sl).toBeDefined()
      expect(sl!.retentionClass).toBe('90_DAYS')
      expect(sl!.expiryAction).toBe('delete')
    })

    it('all policies have required fields', () => {
      for (const p of DEFAULT_RETENTION_POLICIES) {
        expect(p.category).toBeTruthy()
        expect(p.retentionClass).toBeTruthy()
        expect(p.expiryAction).toBeTruthy()
        expect(typeof p.immutable).toBe('boolean')
      }
    })
  })
})
