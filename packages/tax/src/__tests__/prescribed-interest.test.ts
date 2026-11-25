/**
 * Unit tests — @nzila/tax/prescribed-interest
 *
 * Covers: rate lookups, quarter/date matching, arrears/benefit rates
 */
import { describe, it, expect } from 'vitest'
import {
  PRESCRIBED_RATES,
  getPrescribedRate,
  getPrescribedRateByQuarter,
  getCorporateArrearsRate,
  getTaxableBenefitRate,
  getLatestPrescribedRate,
  getPrescribedRatesForYear,
} from '../prescribed-interest'

// Independently checked against each CRA YYYY-qN publication under
// https://www.canada.ca/en/revenue-agency/services/tax/prescribed-interest-rates/
// Fields: year, quarter, base, arrears, non-corporate refund, benefit, corporate refund.
const publishedQuarterRates = [
  [2023, 1, 0.04, 0.08, 0.06, 0.04, 0.04],
  [2023, 2, 0.05, 0.09, 0.07, 0.05, 0.05],
  [2023, 3, 0.05, 0.09, 0.07, 0.05, 0.05],
  [2023, 4, 0.05, 0.09, 0.07, 0.05, 0.05],
  [2024, 1, 0.06, 0.1, 0.08, 0.06, 0.06],
  [2024, 2, 0.06, 0.1, 0.08, 0.06, 0.06],
  [2024, 3, 0.05, 0.09, 0.07, 0.05, 0.05],
  [2024, 4, 0.05, 0.09, 0.07, 0.05, 0.05],
  [2025, 1, 0.04, 0.08, 0.06, 0.04, 0.04],
  [2025, 2, 0.04, 0.08, 0.06, 0.04, 0.04],
  [2025, 3, 0.03, 0.07, 0.05, 0.03, 0.03],
  [2025, 4, 0.03, 0.07, 0.05, 0.03, 0.03],
  [2026, 1, 0.03, 0.07, 0.05, 0.03, 0.03],
  [2026, 2, 0.03, 0.07, 0.05, 0.03, 0.03],
  [2026, 3, 0.03, 0.07, 0.05, 0.03, 0.03],
  [2026, 4, 0.03, 0.07, 0.05, 0.03, 0.03],
] as const

it.each(publishedQuarterRates)('matches the original CRA publication for %s Q%s', (year, quarter, baseRate, corporateArrearsRate, refundRate, taxableBenefitRate, corporateRefundRate) => {
  expect(getPrescribedRateByQuarter(year, quarter)).toMatchObject({
    baseRate, corporateArrearsRate, refundRate, taxableBenefitRate, corporateRefundRate,
  })
})

describe('PRESCRIBED_RATES', () => {
  it('has entries from 2023 through 2026', () => {
    const years = [...new Set(PRESCRIBED_RATES.map((r) => r.year))]
    expect(years).toContain(2023)
    expect(years).toContain(2024)
    expect(years).toContain(2025)
    expect(years).toContain(2026)
  })

  it('each entry has valid quarter 1-4', () => {
    for (const r of PRESCRIBED_RATES) {
      expect([1, 2, 3, 4]).toContain(r.quarter)
    }
  })

  it('corporate arrears = base + 4%', () => {
    for (const r of PRESCRIBED_RATES) {
      expect(r.corporateArrearsRate).toBeCloseTo(r.baseRate + 0.04, 4)
    }
  })

  it('taxable benefit rate = base rate', () => {
    for (const r of PRESCRIBED_RATES) {
      expect(r.taxableBenefitRate).toBe(r.baseRate)
    }
  })
})

describe('getPrescribedRate', () => {
  it('finds rate by date string', () => {
    const rate = getPrescribedRate('2025-06-15')
    expect(rate).toBeDefined()
    expect(rate!.year).toBe(2025)
    expect(rate!.quarter).toBe(2)
  })

  it('finds rate by Date object', () => {
    const rate = getPrescribedRate(new Date(2025, 0, 15)) // Jan 15 2025
    expect(rate).toBeDefined()
    expect(rate!.year).toBe(2025)
    expect(rate!.quarter).toBe(1)
  })

  it('returns undefined for future date beyond data', () => {
    const rate = getPrescribedRate('2030-01-01')
    expect(rate).toBeUndefined()
  })
})

describe('getPrescribedRateByQuarter', () => {
  it('finds rate by year + quarter', () => {
    const rate = getPrescribedRateByQuarter(2025, 3)
    expect(rate).toBeDefined()
    expect(rate!.baseRate).toBe(0.03)
  })

  it('returns undefined for non-existent quarter', () => {
    const rate = getPrescribedRateByQuarter(2030, 1)
    expect(rate).toBeUndefined()
  })
})

describe('getCorporateArrearsRate', () => {
  it('returns arrears rate for valid date', () => {
    const rate = getCorporateArrearsRate('2025-01-15')
    expect(rate).toBe(0.08)
  })

  it('returns fallback for future date', () => {
    const rate = getCorporateArrearsRate('2030-01-01')
    expect(rate).toBe(0.07) // fallback default
  })
})

describe('getTaxableBenefitRate', () => {
  it('returns benefit rate for valid date', () => {
    const rate = getTaxableBenefitRate('2025-01-15')
    expect(rate).toBe(0.04)
  })

  it('returns fallback for future date', () => {
    const rate = getTaxableBenefitRate('2030-01-01')
    expect(rate).toBe(0.03) // fallback
  })
})

describe('getLatestPrescribedRate', () => {
  it('returns the last entry', () => {
    const latest = getLatestPrescribedRate()
    expect(latest).toBeDefined()
    expect(latest.year).toBe(2026)
    expect(latest.quarter).toBe(4)
  })
})

describe('getPrescribedRatesForYear', () => {
  it('returns all quarters for a year', () => {
    const rates = getPrescribedRatesForYear(2025)
    expect(rates).toHaveLength(4)
    expect(rates.map((r) => r.quarter)).toEqual([1, 2, 3, 4])
  })

  it('returns empty for nonexistent year', () => {
    expect(getPrescribedRatesForYear(2030)).toHaveLength(0)
  })
})
