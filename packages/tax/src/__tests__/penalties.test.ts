/**
 * Unit tests — @nzila/tax/penalties
 */
import { describe, it, expect } from 'vitest'
import {
  T2_LATE_BASE_RATE,
  T2_LATE_MAX_MONTHS,
  T2_REPEAT_BASE_RATE,
  calculateT2LateFilingPenalty,
  calculateGstLatePenalty,
  calculateInformationReturnPenalty,
} from '../penalties'

describe('calculateT2LateFilingPenalty', () => {
  it('returns zero when no tax owing', () => {
    const r = calculateT2LateFilingPenalty({ taxOwing: 0, monthsLate: 3 })
    expect(r.penalty).toBe(0)
  })

  it('returns zero when not late', () => {
    const r = calculateT2LateFilingPenalty({ taxOwing: 10_000, monthsLate: 0 })
    expect(r.penalty).toBe(0)
  })

  it('calculates first-time penalty: 5% + 1%/month', () => {
    const r = calculateT2LateFilingPenalty({ taxOwing: 10_000, monthsLate: 3 })
    // 5% of 10K = 500, 1% * 3 * 10K = 300 → total 800
    expect(r.penalty).toBe(800)
    expect(r.breakdown.basePenalty).toBe(500)
    expect(r.breakdown.monthlyPenalty).toBe(300)
    expect(r.breakdown.monthsApplied).toBe(3)
  })

  it('caps at 12 months for first-time', () => {
    const r = calculateT2LateFilingPenalty({ taxOwing: 10_000, monthsLate: 24 })
    expect(r.breakdown.monthsApplied).toBe(T2_LATE_MAX_MONTHS)
    // 5% + 12% = 17% → 1700
    expect(r.penalty).toBe(1_700)
  })

  it('calculates repeat offender penalty: 10% + 2%/month', () => {
    const r = calculateT2LateFilingPenalty({ taxOwing: 10_000, monthsLate: 3, isRepeatOffender: true, hasFilingDemand: true })
    // 10% = 1000, 2% * 3 = 600 → 1600
    expect(r.penalty).toBe(1_600)
    expect(r.rule).toContain('s.162(2)')
  })

  it('constants are correct', () => {
    expect(T2_LATE_BASE_RATE).toBe(0.05)
    expect(T2_REPEAT_BASE_RATE).toBe(0.10)
  })
})

describe('calculateGstLatePenalty', () => {
  it('returns zero when GST paid on time', () => {
    const r = calculateGstLatePenalty({ netTaxOwing: 5_000, monthsLate: 0 })
    expect(r.penalty).toBe(0)
  })

  it('calculates 1% + 0.25%/month', () => {
    const r = calculateGstLatePenalty({ netTaxOwing: 10_000, monthsLate: 4 })
    // 1% = 100, 0.25% * 4 = 100 → 200
    expect(r.penalty).toBe(200)
  })

  it('does not invent generic GST repeat doubling', () => {
    const r = calculateGstLatePenalty({ netTaxOwing: 10_000, monthsLate: 4, isRepeatOffender: true })
    expect(r.penalty).toBe(200)
  })
})

describe('calculateInformationReturnPenalty', () => {
  it('returns zero when filed on time', () => {
    const r = calculateInformationReturnPenalty({ returnType: 'T4', numberOfSlips: 5, daysLate: 0 })
    expect(r.penalty).toBe(0)
  })

  it('uses the flat relieving policy for five or fewer T5 slips', () => {
    const r = calculateInformationReturnPenalty({ returnType: 'T5', numberOfSlips: 1, daysLate: 4 })
    // CRA administrative relief: 1–5 slips is a flat $100.
    expect(r.penalty).toBe(100)
  })

  it('enforces minimum of $100', () => {
    const r = calculateInformationReturnPenalty({ returnType: 'T4', numberOfSlips: 1, daysLate: 1 })
    // $25 * 1 = $25, but min $100
    expect(r.penalty).toBe(100)
  })

  it('uses the 51–500 slip tier and its 100-day cap', () => {
    const r = calculateInformationReturnPenalty({ returnType: 'T4', numberOfSlips: 100, daysLate: 100 })
    expect(r.penalty).toBe(1_500)
  })
})
