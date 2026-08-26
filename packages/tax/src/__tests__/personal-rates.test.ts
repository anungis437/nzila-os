/**
 * Unit tests — @nzila/tax/personal-rates
 */
import { describe, it, expect } from 'vitest'
import {
  FEDERAL_BRACKETS_2025,
  FEDERAL_BPA_2025,
  PROVINCIAL_PERSONAL_BRACKETS,
  calculateBracketTax,
  getMarginalRate,
  estimatePersonalTax,
  getCombinedMarginalRate,
  getFederalPersonalSchedule,
  getProvincialPersonalSchedule,
} from '../personal-rates'

describe('FEDERAL_BRACKETS_2025', () => {
  it('has 5 brackets', () => {
    expect(FEDERAL_BRACKETS_2025).toHaveLength(5)
  })

  it('starts at 14%', () => {
    expect(FEDERAL_BRACKETS_2025[0].rate).toBe(0.14)
  })

  it('top bracket is 33%', () => {
    expect(FEDERAL_BRACKETS_2025[4].rate).toBe(0.33)
    expect(FEDERAL_BRACKETS_2025[4].to).toBeNull()
  })

  it('BPA is $16,452', () => {
    expect(FEDERAL_BPA_2025).toBe(16_452)
  })
})

describe('PROVINCIAL_PERSONAL_BRACKETS', () => {
  it('has all 13 provinces', () => {
    expect(Object.keys(PROVINCIAL_PERSONAL_BRACKETS)).toHaveLength(13)
  })

  it('Ontario has 5 brackets', () => {
    expect(PROVINCIAL_PERSONAL_BRACKETS.ON.brackets).toHaveLength(5)
  })

  it('Alberta lowest rate is 8%', () => {
    expect(PROVINCIAL_PERSONAL_BRACKETS.AB.brackets[0].rate).toBe(0.08)
  })
})

describe('calculateBracketTax', () => {
  it('returns 0 for 0 income', () => {
    expect(calculateBracketTax(0, FEDERAL_BRACKETS_2025)).toBe(0)
  })

  it('calculates tax in the first bracket', () => {
    // $50,000 * 14% = $7,000
    expect(calculateBracketTax(50_000, FEDERAL_BRACKETS_2025)).toBe(7_000)
  })

  it('calculates across multiple brackets', () => {
    // First bracket: $58,523 * 0.14 = $8,193.22
    // Second bracket: ($100,000 - $58,523) * 0.205 = $41,477 * 0.205 = $8,502.79
    // Total: $16,696.01
    const tax = calculateBracketTax(100_000, FEDERAL_BRACKETS_2025)
    expect(tax).toBeCloseTo(16_696.01, 0)
  })
})

describe('getMarginalRate', () => {
  it('returns first bracket rate for low income', () => {
    expect(getMarginalRate(30_000, FEDERAL_BRACKETS_2025)).toBe(0.14)
  })

  it('returns top bracket rate for high income', () => {
    expect(getMarginalRate(500_000, FEDERAL_BRACKETS_2025)).toBe(0.33)
  })
})

describe('estimatePersonalTax', () => {
  it('returns combined federal + provincial for Ontario', () => {
    const result = estimatePersonalTax('ON', 100_000)
    expect(result.federalTax).toBeGreaterThan(0)
    expect(result.provincialTax).toBeGreaterThan(0)
    expect(result.combinedTax).toBe(result.federalTax + result.provincialTax)
    expect(result.effectiveRate).toBeGreaterThan(0)
    expect(result.effectiveRate).toBeLessThan(0.5)
  })

  it('returns zero for zero income', () => {
    const result = estimatePersonalTax('ON', 0)
    expect(result.combinedTax).toBe(0)
    expect(result.effectiveRate).toBe(0)
  })
})

describe('getCombinedMarginalRate', () => {
  it('returns combined rate for Ontario at $100K', () => {
    const rate = getCombinedMarginalRate('ON', 100_000)
    // Federal 20.5% + Ontario 9.15% = 29.65%
    expect(rate).toBeCloseTo(0.2965, 3)
  })
})

describe('schedule helpers', () => {
  it('getFederalPersonalSchedule returns 2026 data', () => {
    const s = getFederalPersonalSchedule()
    expect(s.jurisdiction).toBe('federal')
    expect(s.taxYear).toBe(2026)
    expect(s.brackets).toBe(FEDERAL_BRACKETS_2025) // alias for 2026
  })

  it('getProvincialPersonalSchedule returns correct province', () => {
    const s = getProvincialPersonalSchedule('BC')
    expect(s.jurisdiction).toBe('BC')
  })
})
