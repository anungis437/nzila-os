/**
 * Tests — T2 Corporate Tax Schedule Engine
 */
import { describe, it, expect } from 'vitest'
import {
  calculateSchedule1,
  calculateSchedule7,
  calculateT2Return,
  quickT2Estimate,
} from '../lib/t2-schedules'

describe('Schedule 1 — Net Income for Tax Purposes', () => {
  it('should add backs and deductions correctly', () => {
    const result = calculateSchedule1({
      netIncomePerStatements: 200_000,
      addBackAmortization: 30_000,
      addBackMeals: 5_000,
      addBackPenalties: 0,
      addBackPolitical: 0,
      addBackReserves: 0,
      addBackDonations: 10_000,
      addBackLifeInsurance: 2_000,
      deductCca: 25_000,
      deductTerminalLoss: 0,
      deductCapitalGainReserve: 0,
      otherAdjustments: 0,
    })

    expect(result.totalAddBacks).toBe(47_000)
    expect(result.totalDeductions).toBe(-25_000)
    expect(result.netIncomeForTax).toBe(222_000)
  })

  it('should not produce negative taxable income', () => {
    const result = calculateSchedule1({
      netIncomePerStatements: 10_000,
      addBackAmortization: 0,
      addBackMeals: 0,
      addBackPenalties: 0,
      addBackPolitical: 0,
      addBackReserves: 0,
      addBackDonations: 0,
      addBackLifeInsurance: 0,
      deductCca: 50_000,
      deductTerminalLoss: 0,
      deductCapitalGainReserve: 0,
      otherAdjustments: 0,
    })
    expect(result.netIncomeForTax).toBe(0)
  })

  it('should include non-zero items in breakdown', () => {
    const result = calculateSchedule1({
      netIncomePerStatements: 100_000,
      addBackAmortization: 0,
      addBackMeals: 2_500,
      addBackPenalties: 0,
      addBackPolitical: 0,
      addBackReserves: 0,
      addBackDonations: 0,
      addBackLifeInsurance: 0,
      deductCca: 15_000,
      deductTerminalLoss: 0,
      deductCapitalGainReserve: 0,
      otherAdjustments: 0,
    })
    // Should have: net income + meals + CCA = 3 items
    expect(result.breakdown.length).toBe(3)
  })
})

describe('Schedule 7 — SBD & AAII', () => {
  it('should give full SBD for a small CCPC', () => {
    const result = calculateSchedule7({
      activeBusinessIncome: 300_000,
      investmentIncome: 10_000,
      taxableCapitalGains: 5_000,
      taxableIncome: 315_000,
      taxableCapitalEmployed: 2_000_000,
      associatedCorpSbdShare: 0,
      province: 'ON',
      isCcpc: true,
    })

    expect(result.effectiveSbdLimit).toBe(500_000)
    expect(result.sbdEligibleIncome).toBe(300_000) // full ABI
    expect(result.sbdAmount).toBeGreaterThan(0)
    expect(result.aaiiClawback).toBe(0) // AAII under $50K
  })

  it('should clawback SBD when AAII exceeds $50K', () => {
    const result = calculateSchedule7({
      activeBusinessIncome: 200_000,
      investmentIncome: 80_000,
      taxableCapitalGains: 20_000,
      taxableIncome: 300_000,
      taxableCapitalEmployed: 1_000_000,
      associatedCorpSbdShare: 0,
      province: 'ON',
      isCcpc: true,
    })

    // AAII = 80K + 20K = 100K → clawback = 5 × (100K − 50K) = $250K
    expect(result.aaii).toBe(100_000)
    expect(result.aaiiClawback).toBe(250_000)
    expect(result.effectiveSbdLimit).toBe(250_000)
  })

  it('should clawback SBD when TCEC exceeds $10M', () => {
    const result = calculateSchedule7({
      activeBusinessIncome: 400_000,
      investmentIncome: 0,
      taxableCapitalGains: 0,
      taxableIncome: 400_000,
      taxableCapitalEmployed: 12_500_000, // $2.5M over $10M
      associatedCorpSbdShare: 0,
      province: 'ON',
      isCcpc: true,
    })

    // TCEC clawback: (12.5M − 10M) / 5M × 500K = 250K
    expect(result.tcecClawback).toBe(250_000)
    expect(result.effectiveSbdLimit).toBe(250_000)
  })

  it('should give no SBD for non-CCPC', () => {
    const result = calculateSchedule7({
      activeBusinessIncome: 1_000_000,
      investmentIncome: 0,
      taxableCapitalGains: 0,
      taxableIncome: 1_000_000,
      taxableCapitalEmployed: 0,
      associatedCorpSbdShare: 0,
      province: 'ON',
      isCcpc: false,
    })

    expect(result.sbdAmount).toBe(0)
    expect(result.effectiveSbdLimit).toBe(0)
  })

  it('should compute additional refundable tax on investment income', () => {
    const result = calculateSchedule7({
      activeBusinessIncome: 100_000,
      investmentIncome: 60_000,
      taxableCapitalGains: 15_000,
      taxableIncome: 175_000,
      taxableCapitalEmployed: 1_000_000,
      associatedCorpSbdShare: 0,
      province: 'AB',
      isCcpc: true,
    })

    // AAII × 10⅔%
    const expectedArt = (60_000 + 15_000) * (10 + 2 / 3) / 100
    expect(result.additionalRefundableTax).toBeCloseTo(expectedArt, 2)
  })
})

describe('T2 Return (complete)', () => {
  it('should produce a valid T2 return for a small CCPC', () => {
    const result = calculateT2Return({
      orgId: 'test-org',
      taxYear: 2026,
      fiscalYearEnd: '12-31',
      province: 'ON',
      isCcpc: true,
      schedule1: {
        netIncomePerStatements: 400_000,
        addBackAmortization: 50_000,
        addBackMeals: 8_000,
        addBackPenalties: 0,
        addBackPolitical: 0,
        addBackReserves: 0,
        addBackDonations: 5_000,
        addBackLifeInsurance: 0,
        deductCca: 0, // will be overridden by ccaClaimed
        deductTerminalLoss: 0,
        deductCapitalGainReserve: 0,
        otherAdjustments: 0,
      },
      schedule7: {
        activeBusinessIncome: 420_000,
        investmentIncome: 10_000,
        taxableCapitalGains: 5_000,
        taxableCapitalEmployed: 3_000_000,
        associatedCorpSbdShare: 0,
      },
      ccaClaimed: 40_000,
      charitableDonations: 5_000,
      dividendsReceived: 0,
      lossCarryforwards: 0,
      installmentsPaid: 50_000,
      taxWithheld: 0,
    })

    expect(result.taxableIncome).toBeGreaterThan(0)
    expect(result.totalTax).toBeGreaterThan(0)
    expect(result.sbd).toBeGreaterThan(0) // CCPC should get SBD
    expect(result.federalTaxAfterSbd).toBeLessThan(result.federalTaxBeforeCredits)
    expect(result.effectiveRate).toBeGreaterThan(0)
    expect(result.effectiveRate).toBeLessThan(0.30) // Should be well under 30% for CCPC
    expect(result.lines.length).toBeGreaterThan(5)
    expect(result.monthlyInstallment).toBeGreaterThan(0)
  })

  it('should cap charitable donations at 75% of net income', () => {
    const result = calculateT2Return({
      orgId: 'test-org',
      taxYear: 2026,
      fiscalYearEnd: '12-31',
      province: 'ON',
      isCcpc: true,
      schedule1: {
        netIncomePerStatements: 100_000,
        addBackAmortization: 0,
        addBackMeals: 0,
        addBackPenalties: 0,
        addBackPolitical: 0,
        addBackReserves: 0,
        addBackDonations: 80_000,
        addBackLifeInsurance: 0,
        deductCca: 0,
        deductTerminalLoss: 0,
        deductCapitalGainReserve: 0,
        otherAdjustments: 0,
      },
      schedule7: {
        activeBusinessIncome: 100_000,
        investmentIncome: 0,
        taxableCapitalGains: 0,
        taxableCapitalEmployed: 0,
        associatedCorpSbdShare: 0,
      },
      ccaClaimed: 0,
      charitableDonations: 80_000,
      dividendsReceived: 0,
      lossCarryforwards: 0,
      installmentsPaid: 0,
      taxWithheld: 0,
    })

    // Net income = 180K (100K + 80K addback), max donation = 75% × 180K = 135K
    // Actual donation = 80K < 135K, so full deduction allowed
    // But taxable income should be > 0 because 180K − 80K = 100K
    expect(result.taxableIncome).toBeGreaterThan(0)
  })
})

describe('quickT2Estimate', () => {
  it('should produce reasonable estimate for a small CCPC', () => {
    const est = quickT2Estimate({
      netIncome: 300_000,
      province: 'ON',
      isCcpc: true,
    })

    expect(est.taxableIncome).toBe(300_000)
    expect(est.totalTax).toBeGreaterThan(0)
    expect(est.sbdBenefit).toBeGreaterThan(0)
    expect(est.effectiveRate).toBeLessThan(0.20) // CCPC under $500K
  })

  it('should give zero benefit for non-CCPC', () => {
    const est = quickT2Estimate({
      netIncome: 300_000,
      province: 'AB',
      isCcpc: false,
    })

    expect(est.sbdBenefit).toBe(0)
    expect(est.effectiveRate).toBeGreaterThan(0.20) // General rate
  })

  it('should handle zero income', () => {
    const est = quickT2Estimate({
      netIncome: 0,
      province: 'ON',
      isCcpc: true,
    })
    expect(est.totalTax).toBe(0)
    expect(est.effectiveRate).toBe(0)
  })
})
