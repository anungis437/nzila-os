/**
 * Unit tests — @nzila/tax/installments
 *
 * Covers: threshold check, 3 CRA methods, quarterly CCPC, due dates, interest
 */
import { describe, it, expect } from 'vitest'
import {
  INSTALLMENT_THRESHOLD,
  calculateInstallments,
  calculateInstallmentInterest,
} from '../installments'

describe('INSTALLMENT_THRESHOLD', () => {
  it('is $3,000', () => {
    expect(INSTALLMENT_THRESHOLD).toBe(3_000)
  })
})

describe('calculateInstallments', () => {
  it('returns not required when both years below threshold', () => {
    const result = calculateInstallments(
      { estimatedCurrentYearTax: 2_000, priorYearTax: 2_500 },
      '12-31',
      2025,
    )
    expect(result.required).toBe(false)
    expect(result.frequency).toBe('none')
    expect(result.totalObligation).toBe(0)
  })

  it('does not require installments when current-year tax is below threshold', () => {
    const result = calculateInstallments(
      { estimatedCurrentYearTax: 2_000, priorYearTax: 10_000 },
      '12-31',
      2025,
    )
    expect(result.required).toBe(false)
  })

  it('computes monthly for non-CCPC', () => {
    const result = calculateInstallments(
      { estimatedCurrentYearTax: 120_000, priorYearTax: 100_000 },
      '12-31',
      2025,
    )
    expect(result.frequency).toBe('monthly')
    expect(result.numberOfPayments).toBe(12)
    expect(result.dueDates).toHaveLength(12)
  })

  it('computes quarterly for small CCPC', () => {
    const result = calculateInstallments(
      { estimatedCurrentYearTax: 12_000, priorYearTax: 12_000, isSmallCcpc: true },
      '12-31',
      2025,
    )
    expect(result.frequency).toBe('quarterly')
    expect(result.numberOfPayments).toBe(4)
    expect(result.dueDates).toHaveLength(4)
  })

  it('current year method divides by number of payments', () => {
    const result = calculateInstallments(
      { estimatedCurrentYearTax: 120_000, priorYearTax: 120_000 },
      '12-31',
      2025,
    )
    expect(result.methods.currentYearEstimate).toBe(120_000)
    expect(result.amountPerPayment).toBe(10_000)
  })

  it('recommends lowest method', () => {
    const result = calculateInstallments(
      { estimatedCurrentYearTax: 120_000, priorYearTax: 100_000 },
      '12-31',
      2025,
    )
    // Prior year is lower → should be recommended
    expect(result.methods.recommended).toBe('priorYear')
    expect(result.totalObligation).toBeCloseTo(100_000, -2)
  })

  it('uses reduced method when available and lowest', () => {
    const result = calculateInstallments(
      {
        estimatedCurrentYearTax: 120_000,
        priorYearTax: 100_000,
        priorPriorYearTax: 60_000,
      },
      '12-31',
      2025,
    )
    expect(result.methods.reducedMethod).not.toBeNull()
    // Reduced: first 2 @ 60K/12 = 5K each, remaining 10 @ (100K-10K)/10 = 9K each
    // Total reduced = 10K + 90K = 100K — same as prior year
    // So recommended will be either priorYear or reduced
    expect(['priorYear', 'reduced']).toContain(result.methods.recommended)
  })

  it('returns null reducedMethod when no prior-prior year data', () => {
    const result = calculateInstallments(
      { estimatedCurrentYearTax: 120_000, priorYearTax: 100_000 },
      '12-31',
      2025,
    )
    expect(result.methods.reducedMethod).toBeNull()
  })
})

describe('calculateInstallmentInterest', () => {
  it('returns zero interest when fully paid', () => {
    const result = calculateInstallmentInterest(10_000, 10_000, 30, 0.08)
    expect(result.interest).toBe(0)
    expect(result.shortfall).toBe(0)
  })

  it('returns zero interest when overpaid', () => {
    const result = calculateInstallmentInterest(10_000, 15_000, 30, 0.08)
    expect(result.interest).toBe(0)
  })

  it('calculates interest on shortfall', () => {
    const result = calculateInstallmentInterest(10_000, 5_000, 30, 0.08)
    expect(result.shortfall).toBe(5_000)
    expect(result.interest).toBeGreaterThan(0)
    // 5000 * ((1 + 0.08/365)^30 - 1) ≈ 33.01
    expect(result.interest).toBeCloseTo(32.74, 0) // approximate
  })

  it('returns zero for zero days late', () => {
    const result = calculateInstallmentInterest(10_000, 5_000, 0, 0.08)
    expect(result.interest).toBe(0)
  })
})
