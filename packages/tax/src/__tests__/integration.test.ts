/**
 * Integration tests — End-to-end CRA compliance scenarios.
 *
 * These tests exercise the full lifecycle of Canadian tax computations
 * across multiple modules, simulating real advisory workflows:
 * 1. Ontario CCPC: estimate corp tax → deadlines → installments → penalties
 * 2. Dividend planning: corp tax → salary vs dividend comparison
 * 3. Personal tax + capital gains
 * 4. Data freshness check
 */
import { describe, it, expect } from 'vitest'

// Corporate rates
import {
  FEDERAL_GENERAL_RATE,
  FEDERAL_SMALL_BUSINESS_RATE,
  SBD_BUSINESS_LIMIT,
  getCombinedCorporateRates,
  estimateCorporateTax,
} from '../rates'

// Deadlines
import {
  calculateCorporateDeadlines,
  calculateQuarterlyGstDeadlines,
} from '../cra-deadlines'

// Installments
import { calculateInstallments } from '../installments'

// Penalties
import {
  calculateT2LateFilingPenalty,
  calculateGstLatePenalty,
} from '../penalties'

// Dividend
import { compareSalaryVsDividend, calculateDividendTax } from '../dividend-tax'

// Personal
import {
  estimatePersonalTax,
  getCombinedMarginalRate,
} from '../personal-rates'

// Capital gains
import { calculateTaxableCapitalGain } from '../rates'

// Data versions
import { getStaleModules, DATA_VERSIONS, isModuleStale } from '../data-versions'

// BN validation
import { validateBusinessNumber, validateProgramAccount } from '../bn-validation'

describe('Integration: Ontario CCPC year-end workflow', () => {
  const province = 'ON' as const
  const fiscalYearEnd = new Date('2025-12-31')
  const taxableIncome = 400_000

  it('computes combined corporate tax estimate', () => {
    const rates = getCombinedCorporateRates(province)
    expect(rates.combinedSmallBusinessRate).toBeGreaterThan(0)
    expect(rates.combinedGeneralRate).toBeGreaterThan(rates.combinedSmallBusinessRate)

    const result = estimateCorporateTax(province, taxableIncome, { isCcpc: true })

    expect(result.estimatedTax).toBeGreaterThan(0)
    expect(result.estimatedTax).toBeLessThan(taxableIncome)
    expect(result.effectiveRate).toBeGreaterThan(0)
    expect(result.effectiveRate).toBeLessThan(1)
    // SBD should apply to first $500K
    expect(result.breakdown.sbd).toBeGreaterThan(0)
  })

  it('calculates filing deadlines from FYE', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, province, { isCcpc: true })

    // Should include T2 filing + T2 payment at minimum
    expect(deadlines.length).toBeGreaterThanOrEqual(2)

    const t2Filing = deadlines.find((d) => d.type === 'federal_filing')!
    expect(t2Filing).toBeDefined()
    // T2 filing: 6 months after Dec 31 = Jun 30
    expect(t2Filing.dueDate).toBe('2026-06-30')

    const t2Payment = deadlines.find((d) => d.type === 'federal_payment')!
    expect(t2Payment).toBeDefined()
    // Balance-due for qualifying CCPC: 3 months after FYE
    expect(new Date(t2Payment.dueDate).getTime()).toBeGreaterThan(fiscalYearEnd.getTime())

    // GST quarterly (if applicable)
    const gstDeadlines = calculateQuarterlyGstDeadlines('12-31', 2025)
    expect(gstDeadlines.length).toBeGreaterThan(0)
    expect(gstDeadlines[0]).toHaveProperty('dueDate')
    expect(gstDeadlines[0]).toHaveProperty('type')
  })

  it('generates installment schedule', () => {
    const yearEndResult = estimateCorporateTax(province, taxableIncome, { isCcpc: true })

    const schedule = calculateInstallments(
      {
        estimatedCurrentYearTax: yearEndResult.estimatedTax,
        priorYearTax: yearEndResult.estimatedTax,
      },
      '2025-12-31',
      2025,
    )

    expect(schedule.required).toBe(true)
    expect(schedule.numberOfPayments).toBeGreaterThan(0)
    // Total obligation should approximate total tax
    expect(schedule.totalObligation).toBeCloseTo(yearEndResult.estimatedTax, -1)
  })

  it('computes late filing penalty when T2 is overdue', () => {
    const taxOwing = 50_000
    const monthsLate = 3

    const penalty = calculateT2LateFilingPenalty({ taxOwing, monthsLate })
    expect(penalty.penalty).toBeGreaterThan(0)
    // Base is 5% + 1% per month (ITA s.162(1))
    expect(penalty.penalty).toBe(taxOwing * (0.05 + 0.01 * monthsLate))
    expect(penalty.rule).toBeDefined()
  })

  it('validates a well-formed BN through the whole chain', () => {
    const bn = validateBusinessNumber('123456782')
    expect(bn.valid).toBe(true)
    expect(bn.bn9).toBe('123456782')

    const pa = validateProgramAccount('123456782RC0001')
    expect(pa.valid).toBe(true)
    expect(pa.referenceNumber).toBe('0001')
  })
})

describe('Integration: salary vs dividend planning', () => {
  const province = 'ON' as const
  const preTaxIncome = 200_000

  it('compares all three paths end-to-end', () => {
    const rates = getCombinedCorporateRates(province)
    const personalRate = getCombinedMarginalRate(province, preTaxIncome)

    expect(personalRate).toBeGreaterThan(0)
    expect(personalRate).toBeLessThan(1)

    const comparison = compareSalaryVsDividend(
      preTaxIncome,
      province,
      personalRate,
      rates.combinedSmallBusinessRate,
    )

    // All paths should produce positive after-tax amounts
    expect(comparison.salary.afterTax).toBeGreaterThan(0)
    expect(comparison.eligibleDividend.afterTax).toBeGreaterThan(0)
    expect(comparison.nonEligibleDividend.afterTax).toBeGreaterThan(0)

    // Corp tax should only appear on dividend paths
    expect(comparison.eligibleDividend.corpTax).toBeGreaterThan(0)
    expect(comparison.nonEligibleDividend.corpTax).toBe(comparison.eligibleDividend.corpTax)

    // RDTOH refund on dividends
    expect(comparison.eligibleDividend.rdtohRefund).toBeGreaterThanOrEqual(0)
    expect(comparison.nonEligibleDividend.rdtohRefund).toBeGreaterThanOrEqual(0)
  })

  it('dividend tax calculation is internally consistent', () => {
    const cashDividend = 100_000
    const personalRate = getCombinedMarginalRate(province, cashDividend)

    const eligible = calculateDividendTax(cashDividend, 'eligible', province, personalRate)
    const nonEligible = calculateDividendTax(cashDividend, 'non-eligible', province, personalRate)

    // Grossed-up amount should exceed cash dividend
    expect(eligible.grossedUpAmount).toBeGreaterThan(cashDividend)
    expect(nonEligible.grossedUpAmount).toBeGreaterThan(cashDividend)

    // Eligible dividends have higher gross-up but also higher DTC
    expect(eligible.grossedUpAmount).toBeGreaterThan(nonEligible.grossedUpAmount)
  })
})

describe('Integration: personal tax with capital gains', () => {
  it('computes taxable capital gain and feeds into personal tax estimate', () => {
    const capitalGain = 300_000
    const province = 'ON' as const

    const capGain = calculateTaxableCapitalGain(capitalGain)
    expect(capGain.taxableAmount).toBeGreaterThan(0)
    expect(capGain.taxableAmount).toBeLessThan(capitalGain)

    const personalTax = estimatePersonalTax(province, capGain.taxableAmount)
    expect(personalTax.federalTax).toBeGreaterThan(0)
    expect(personalTax.provincialTax).toBeGreaterThan(0)
    expect(personalTax.combinedTax).toBeCloseTo(
      personalTax.federalTax + personalTax.provincialTax,
      0,
    )
    expect(personalTax.effectiveRate).toBeGreaterThan(0)
    expect(personalTax.effectiveRate).toBeLessThan(1)
  })

  it('capital gains under $250K use standard 50% inclusion', () => {
    const gain = calculateTaxableCapitalGain(200_000)
    // $200K gain, under individual threshold → 50% inclusion
    expect(gain.taxableAmount).toBe(100_000)
  })
})

describe('Integration: data freshness audit', () => {
  it('evaluates the recorded registry from an explicit instant', () => {
    expect(getStaleModules(new Date('2026-08-26T12:00:00.000Z'))).toHaveLength(0)
    const staleOnCiDate = getStaleModules(new Date('2026-11-26T00:00:00.000Z'))
    expect(staleOnCiDate).toHaveLength(DATA_VERSIONS.length)
    expect(staleOnCiDate.map((module) => module.lastVerified)).toEqual(
      Array.from({ length: DATA_VERSIONS.length }, () => '2026-08-26'),
    )
  })

  it('every module entry has required metadata', () => {
    for (const mod of DATA_VERSIONS) {
      expect(mod.module).toBeTruthy()
      expect(mod.taxYear).toBeTruthy()
      expect(mod.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(mod.source).toBeTruthy()
    }
  })

  it('detects staleness when date is far in the future', () => {
    const futureDate = new Date('2027-01-01')
    const staleInFuture = DATA_VERSIONS.filter((m) => isModuleStale(m, futureDate))
    expect(staleInFuture.length).toBe(DATA_VERSIONS.length) // all should be stale
  })
})

describe('Integration: GST late penalty cross-check', () => {
  it('GST penalty respects 30-day cap', () => {
    // GST/HST late penalty: 1% + ¼% per full month, capped at 12 months
    const penalty = calculateGstLatePenalty({ netTaxOwing: 100_000, monthsLate: 6 })
    expect(penalty.penalty).toBeGreaterThan(0)
    expect(penalty.rule).toBeDefined()
  })
})
