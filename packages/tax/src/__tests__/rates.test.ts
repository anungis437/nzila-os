/**
 * Unit tests — @nzila/tax/rates
 *
 * Covers: federal/provincial rates, SBD/AAII grinds, estimateCorporateTax()
 */
import { describe, it, expect } from 'vitest'
import {
  FEDERAL_GENERAL_RATE,
  FEDERAL_SMALL_BUSINESS_RATE,
  FEDERAL_MP_RATE,
  SBD_BUSINESS_LIMIT,
  SBD_CAPITAL_GRIND_START,
  SBD_CAPITAL_GRIND_END,
  AAII_GRIND_START,
  AAII_GRIND_END,
  PROVINCIAL_RATES,
  getCombinedCorporateRates,
  calculateSbdBusinessLimit,
  calculateAaiiBusinessLimit,
  estimateCorporateTax,
} from '../rates'

describe('Federal rates', () => {
  it('general rate is 15%', () => {
    expect(FEDERAL_GENERAL_RATE).toBe(0.15)
  })

  it('small business rate is 9%', () => {
    expect(FEDERAL_SMALL_BUSINESS_RATE).toBe(0.09)
  })

  it('M&P deduction is 13%, distinct from the 15% net general rate', () => {
    expect(FEDERAL_MP_RATE).toBe(0.13)
  })
})

describe('SBD thresholds', () => {
  it('business limit is $500K', () => {
    expect(SBD_BUSINESS_LIMIT).toBe(500_000)
  })

  it('capital grind starts at $10M', () => {
    expect(SBD_CAPITAL_GRIND_START).toBe(10_000_000)
  })

  it('capital grind ends at $50M', () => {
    expect(SBD_CAPITAL_GRIND_END).toBe(50_000_000)
  })
})

describe('PROVINCIAL_RATES', () => {
  it('has all 13 provinces/territories', () => {
    const all = ['ON', 'QC', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU']
    for (const p of all) {
      expect(PROVINCIAL_RATES).toHaveProperty(p)
    }
    expect(Object.keys(PROVINCIAL_RATES)).toHaveLength(13)
  })

  it('Ontario general rate is 11.5%', () => {
    expect(PROVINCIAL_RATES.ON.generalRate).toBe(0.115)
  })

  it('Alberta has lowest general rate at 8%', () => {
    expect(PROVINCIAL_RATES.AB.generalRate).toBe(0.08)
  })

  it('Saskatchewan has higher SBD limit of $600K', () => {
    expect(PROVINCIAL_RATES.SK.sbdLimit).toBe(600_000)
  })

  it('Manitoba small business rate is 0%', () => {
    expect(PROVINCIAL_RATES.MB.smallBusinessRate).toBe(0)
  })
})

describe('2026 provincial rate applicability', () => {
  // CRA current corporation rates and RQ's 2026-05-04 SBD notice specify
  // different transition conditions; these snapshots are not whole-year rates.
  it('preserves Ontario’s midyear split and earlier 3.2% rate', () => {
    expect(PROVINCIAL_RATES.ON.smallBusinessRate).toBe(0.022)
    expect(PROVINCIAL_RATES.ON.effectiveFrom).toBe('2026-07-01')
    expect(PROVINCIAL_RATES.ON.smallBusinessRateCondition).toContain('3.2% before')
    expect(PROVINCIAL_RATES.ON.smallBusinessRateCondition).toContain('Prorate')
  })

  it('preserves Quebec’s strict taxation-year-start condition', () => {
    expect(PROVINCIAL_RATES.QC.smallBusinessRate).toBe(0.022)
    expect(PROVINCIAL_RATES.QC.effectiveFrom).toBe('2026-04-30')
    expect(PROVINCIAL_RATES.QC.smallBusinessRateCondition).toContain('beginning after 2026-04-29')
    expect(PROVINCIAL_RATES.QC.smallBusinessRateCondition).toContain('3.2% for earlier starts')
  })

  it('preserves Newfoundland’s calendar-date transition from 2.5%', () => {
    expect(PROVINCIAL_RATES.NL.smallBusinessRate).toBe(0.02)
    expect(PROVINCIAL_RATES.NL.effectiveFrom).toBe('2026-01-01')
    expect(PROVINCIAL_RATES.NL.smallBusinessRateCondition).toContain('2.5% before')
  })
})

describe('getCombinedCorporateRates', () => {
  it('combines federal + Ontario rates', () => {
    const rates = getCombinedCorporateRates('ON')
    expect(rates.combinedGeneralRate).toBeCloseTo(0.265, 4) // 15% + 11.5%
    expect(rates.combinedSmallBusinessRate).toBeCloseTo(0.112, 4) // current snapshot: 9% + 2.2%
    expect(rates.sbdLimit).toBe(500_000)
  })

  it('combines federal + Alberta rates', () => {
    const rates = getCombinedCorporateRates('AB')
    expect(rates.combinedGeneralRate).toBeCloseTo(0.23, 4) // 15% + 8%
    expect(rates.combinedSmallBusinessRate).toBeCloseTo(0.11, 4) // 9% + 2%
  })

  it('uses minimum of federal/provincial SBD limit', () => {
    const onRates = getCombinedCorporateRates('ON')
    expect(onRates.sbdLimit).toBe(500_000)
    const skRates = getCombinedCorporateRates('SK')
    expect(skRates.sbdLimit).toBe(500_000) // min of 500K federal vs 600K SK
  })
})

describe('calculateSbdBusinessLimit', () => {
  it('returns full $500K below $10M capital', () => {
    expect(calculateSbdBusinessLimit(5_000_000)).toBe(500_000)
    expect(calculateSbdBusinessLimit(10_000_000)).toBe(500_000)
  })

  it('returns 0 at $50M or above', () => {
    expect(calculateSbdBusinessLimit(50_000_000)).toBe(0)
    expect(calculateSbdBusinessLimit(60_000_000)).toBe(0)
  })

  it('uses the $10M–$50M range rather than eliminating SBD at $15M', () => {
    expect(calculateSbdBusinessLimit(15_000_000)).toBe(437_500)
    expect(calculateSbdBusinessLimit(30_000_000)).toBe(250_000) // halfway
  })
})

describe('calculateAaiiBusinessLimit', () => {
  it('returns full $500K below $50K AAII', () => {
    expect(calculateAaiiBusinessLimit(0)).toBe(500_000)
    expect(calculateAaiiBusinessLimit(50_000)).toBe(500_000)
  })

  it('returns 0 at $150K or above', () => {
    expect(calculateAaiiBusinessLimit(150_000)).toBe(0)
    expect(calculateAaiiBusinessLimit(200_000)).toBe(0)
  })

  it('grinds at $5 per $1 of AAII', () => {
    const at100K = calculateAaiiBusinessLimit(100_000)
    expect(at100K).toBe(250_000) // 50K excess * 5 = 250K reduction
  })
})

describe('estimateCorporateTax', () => {
  it('taxes all income at SBD rate for small CCPC', () => {
    const result = estimateCorporateTax('ON', 200_000)
    // Current snapshot: 200K * 11.2% = 22,400
    expect(result.estimatedTax).toBeCloseTo(22_400, 0)
    expect(result.breakdown.sbd).toBeCloseTo(22_400, 0)
    expect(result.breakdown.general).toBe(0)
  })

  it('splits at SBD limit for income > $500K', () => {
    const result = estimateCorporateTax('ON', 800_000)
    // Current snapshot SBD: 500K * 11.2% = 56,000
    // General: 300K * 26.5% = 79,500
    expect(result.breakdown.sbd).toBeCloseTo(56_000, 0)
    expect(result.breakdown.general).toBeCloseTo(79_500, 0)
    expect(result.estimatedTax).toBeCloseTo(135_500, 0)
  })

  it('applies general rate only for non-CCPC', () => {
    const result = estimateCorporateTax('ON', 200_000, { isCcpc: false })
    // 200K * 26.5% = 53,000
    expect(result.estimatedTax).toBeCloseTo(53_000, 0)
    expect(result.breakdown.sbd).toBe(0)
  })

  it('handles zero income', () => {
    const result = estimateCorporateTax('ON', 0)
    expect(result.estimatedTax).toBe(0)
    expect(result.effectiveRate).toBe(0)
  })

  it('grinds SBD when taxable capital is high', () => {
    const result = estimateCorporateTax('ON', 500_000, { taxableCapital: 50_000_000 })
    // SBD fully ground down — all at general rate
    expect(result.breakdown.sbd).toBe(0)
    expect(result.breakdown.general).toBeCloseTo(500_000 * 0.265, 0)
  })

  it('grinds SBD when AAII is high', () => {
    const result = estimateCorporateTax('ON', 500_000, { aaii: 150_000 })
    expect(result.breakdown.sbd).toBe(0)
  })
})
