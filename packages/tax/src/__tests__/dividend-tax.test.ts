/**
 * Unit tests — @nzila/tax/dividend-tax
 */
import { describe, it, expect } from 'vitest'
import {
  ELIGIBLE_DIVIDEND,
  NON_ELIGIBLE_DIVIDEND,
  PROVINCIAL_DTC,
  RDTOH_REFUND_RATE,
  PART_IV_TAX_RATE,
  calculateDividendTax,
  compareSalaryVsDividend,
} from '../dividend-tax'

describe('constants', () => {
  it('eligible gross-up is 38%', () => {
    expect(ELIGIBLE_DIVIDEND.grossUpRate).toBe(0.38)
  })

  it('non-eligible gross-up is 15%', () => {
    expect(NON_ELIGIBLE_DIVIDEND.grossUpRate).toBe(0.15)
  })

  it('RDTOH refund rate is ~38.33%', () => {
    expect(RDTOH_REFUND_RATE).toBeCloseTo(0.3833, 3)
  })

  it('Part IV tax rate matches RDTOH', () => {
    expect(PART_IV_TAX_RATE).toBeCloseTo(0.3833, 3)
  })

  it('has DTC rates for all 13 provinces', () => {
    expect(Object.keys(PROVINCIAL_DTC)).toHaveLength(13)
  })
})

describe('calculateDividendTax', () => {
  it('gross-up eligible dividend by 38%', () => {
    const r = calculateDividendTax(10_000, 'eligible', 'ON', 0.5353)
    expect(r.grossedUpAmount).toBe(13_800)
  })

  it('gross-up non-eligible dividend by 15%', () => {
    const r = calculateDividendTax(10_000, 'non-eligible', 'ON', 0.5353)
    expect(r.grossedUpAmount).toBe(11_500)
  })

  it('applies federal + provincial DTC', () => {
    const r = calculateDividendTax(10_000, 'eligible', 'ON', 0.5353)
    expect(r.federalCredit).toBeGreaterThan(0)
    expect(r.provincialCredit).toBeGreaterThan(0)
    expect(r.totalCredit).toBe(r.federalCredit + r.provincialCredit)
  })

  it('net tax cannot be negative', () => {
    // Very low marginal rate = credits > tax = net 0
    const r = calculateDividendTax(1_000, 'eligible', 'ON', 0.05)
    expect(r.netTaxAtTopRate).toBeGreaterThanOrEqual(0)
  })

  it('calculates a potential RDTOH ceiling, not balance-qualified refund', () => {
    const r = calculateDividendTax(10_000, 'eligible', 'ON', 0.5)
    expect(r.rdtohRefund).toBe(3_833.33)
  })

  it('effective dividend rate is reasonable', () => {
    const r = calculateDividendTax(100_000, 'eligible', 'ON', 0.5353)
    expect(r.effectiveDividendRate).toBeGreaterThan(0)
    expect(r.effectiveDividendRate).toBeLessThan(0.5)
  })
})

describe('compareSalaryVsDividend', () => {
  it('returns all three paths', () => {
    const r = compareSalaryVsDividend(200_000, 'ON', 0.5353, 0.265)
    expect(r.salary).toBeDefined()
    expect(r.eligibleDividend).toBeDefined()
    expect(r.nonEligibleDividend).toBeDefined()
  })

  it('salary gross equals corporate pre-tax income', () => {
    const r = compareSalaryVsDividend(200_000, 'ON', 0.5353, 0.265)
    expect(r.salary.gross).toBe(200_000)
  })

  it('dividend path deducts corporate tax first', () => {
    const r = compareSalaryVsDividend(200_000, 'ON', 0.5353, 0.265)
    expect(r.eligibleDividend.corpTax).toBeCloseTo(53_000, 0)
    expect(r.eligibleDividend.cashDividend).toBeCloseTo(147_000, 0)
  })

  it('after-tax is positive for all paths', () => {
    const r = compareSalaryVsDividend(200_000, 'ON', 0.5353, 0.265)
    expect(r.salary.afterTax).toBeGreaterThan(0)
    expect(r.eligibleDividend.afterTax).toBeGreaterThan(0)
    expect(r.nonEligibleDividend.afterTax).toBeGreaterThan(0)
  })
})
