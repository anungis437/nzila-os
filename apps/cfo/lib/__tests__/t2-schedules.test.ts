/**
 * CFO — T2 Schedule Engine Tests
 *
 * Tests calculateSchedule1, calculateSchedule7, quickT2Estimate.
 * @nzila/tax is mocked with realistic Canadian CCR rates.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock @nzila/tax with standard Canadian CCPC rates
vi.mock('@nzila/tax', () => ({
  FEDERAL_GENERAL_RATE: 0.15,
  FEDERAL_SMALL_BUSINESS_RATE: 0.09,
  SBD_BUSINESS_LIMIT: 500_000,
  PROVINCIAL_RATES: {
    ON: { generalRate: 0.115, sbrRate: 0.035, name: 'Ontario' },
    QC: { generalRate: 0.115, sbrRate: 0.03125, name: 'Quebec' },
    BC: { generalRate: 0.12, sbrRate: 0.02, name: 'British Columbia' },
    AB: { generalRate: 0.08, sbrRate: 0.02, name: 'Alberta' },
  },
}))

import {
  calculateSchedule1,
  calculateSchedule7,
  quickT2Estimate,
} from '../t2-schedules'

// ── calculateSchedule1 ──────────────────────────────────────────────────────

describe('calculateSchedule1', () => {
  const base = {
    netIncomePerStatements: 200_000,
    addBackAmortization: 15_000,
    addBackMeals: 3_000,
    addBackPenalties: 0,
    addBackPolitical: 0,
    addBackReserves: 0,
    addBackDonations: 5_000,
    addBackLifeInsurance: 0,
    deductCca: 20_000,
    deductTerminalLoss: 0,
    deductCapitalGainReserve: 0,
    otherAdjustments: 0,
  }

  it('calculates net income for tax correctly', () => {
    const result = calculateSchedule1(base)

    // Total add-backs = 15000 + 3000 + 5000 = 23000
    expect(result.totalAddBacks).toBe(23_000)
    // CCA deduction = -20000
    expect(result.totalDeductions).toBe(-20_000)
    // Net income = 200000 + 23000 - 20000 = 203000
    expect(result.netIncomeForTax).toBe(203_000)
  })

  it('net income for tax is never negative', () => {
    const result = calculateSchedule1({
      ...base,
      netIncomePerStatements: -500_000,
      addBackAmortization: 0,
      addBackMeals: 0,
      addBackDonations: 0,
    })
    expect(result.netIncomeForTax).toBe(0)
  })

  it('includes non-zero adjustments in breakdown', () => {
    const result = calculateSchedule1(base)
    const descriptions = result.breakdown.map((b) => b.description)
    expect(descriptions).toContain('Amortization per books')
    expect(descriptions).toContain('CCA claimed (Schedule 8)')
    // Zero items might be filtered
    expect(result.breakdown.length).toBeGreaterThan(2)
  })

  it('ignores zero add-backs in computation', () => {
    const noAddbacks = {
      ...base,
      addBackAmortization: 0,
      addBackMeals: 0,
      addBackDonations: 0,
      deductCca: 0,
    }
    const result = calculateSchedule1(noAddbacks)
    expect(result.totalAddBacks).toBe(0)
    expect(result.netIncomeForTax).toBe(200_000)
  })
})

// ── calculateSchedule7 ─────────────────────────────────────────────────────

describe('calculateSchedule7 — non-CCPC', () => {
  it('returns zero SBD for non-CCPC', () => {
    const result = calculateSchedule7({
      isCcpc: false,
      activeBusinessIncome: 400_000,
      taxableIncome: 400_000,
      investmentIncome: 0,
      taxableCapitalGains: 0,
      taxableCapitalEmployed: 0,
      associatedCorpSbdShare: 0,
      province: 'ON' as import('../t2-schedules').Schedule7Input['province'],
    })
    expect(result.sbdAmount).toBe(0)
    expect(result.effectiveSbdLimit).toBe(0)
    // Should still compute general rate tax
    expect(result.generalRateTax).toBeGreaterThan(0)
  })
})

describe('calculateSchedule7 — CCPC with full SBD', () => {
  const base = {
    isCcpc: true,
    activeBusinessIncome: 300_000,
    taxableIncome: 300_000,
    investmentIncome: 20_000,
    taxableCapitalGains: 5_000,
    taxableCapitalEmployed: 1_000_000,
    associatedCorpSbdShare: 0,
    province: 'ON' as import('../t2-schedules').Schedule7Input['province'],
  }

  it('calculates AAII = investment income + capital gains', () => {
    const result = calculateSchedule7(base)
    expect(result.aaii).toBe(25_000)
  })

  it('no AAII clawback when AAII under $50K', () => {
    const result = calculateSchedule7(base)
    expect(result.aaiiClawback).toBe(0)
    expect(result.effectiveSbdLimit).toBe(500_000)
  })

  it('AAII clawback reduces SBD limit when AAII over $50K', () => {
    const result = calculateSchedule7({
      ...base,
      investmentIncome: 80_000,
      taxableCapitalGains: 0,
    })
    // AAII = 80000, clawback = 5 × (80000 - 50000) = 150000
    expect(result.aaii).toBe(80_000)
    expect(result.aaiiClawback).toBe(150_000)
    expect(result.effectiveSbdLimit).toBe(350_000)
  })

  it('TCEC clawback applies when capital employed over $10M', () => {
    const result = calculateSchedule7({
      ...base,
      taxableCapitalEmployed: 12_500_000,
    })
    // Excess = 2.5M, clawback = (2.5M / 5M) × 500K = 250K
    expect(result.tcecClawback).toBe(250_000)
    expect(result.effectiveSbdLimit).toBe(250_000)
  })

  it('SBD amount = eligible income × (general rate - SBD rate)', () => {
    const result = calculateSchedule7(base)
    // Rate diff = 0.15 - 0.09 = 0.06
    // SBD eligible = min(300K, 300K, 500K) = 300K
    // Amount = 300K × 0.06 = 18000
    expect(result.sbdAmount).toBeCloseTo(18_000)
  })

  it('additional refundable tax is 10⅔% on AAII', () => {
    const result = calculateSchedule7(base)
    // AAII = 25000; ART = 25000 × (10 + 2/3) / 100 ≈ 2666.67
    expect(result.additionalRefundableTax).toBeCloseTo(2_666.67, 1)
  })
})

// ── quickT2Estimate ─────────────────────────────────────────────────────────

describe('quickT2Estimate', () => {
  it('returns positive tax for profitable CCPC', () => {
    const result = quickT2Estimate({
      netIncome: 300_000,
      province: 'ON' as import('../t2-schedules').Schedule7Input['province'],
      isCcpc: true,
    })
    expect(result.totalTax).toBeGreaterThan(0)
    expect(result.totalTax).toBeLessThan(300_000)
    expect(result.effectiveRate).toBeGreaterThan(0)
    expect(result.effectiveRate).toBeLessThan(1)
  })

  it('returns zero tax for zero net income', () => {
    const result = quickT2Estimate({
      netIncome: 0,
      province: 'ON' as import('../t2-schedules').Schedule7Input['province'],
      isCcpc: true,
    })
    expect(result.totalTax).toBe(0)
  })

  it('non-CCPC pays more tax than CCPC on same income (no SBD)', () => {
    const ccpc = quickT2Estimate({
      netIncome: 300_000,
      province: 'ON' as import('../t2-schedules').Schedule7Input['province'],
      isCcpc: true,
    })
    const corp = quickT2Estimate({
      netIncome: 300_000,
      province: 'ON' as import('../t2-schedules').Schedule7Input['province'],
      isCcpc: false,
    })
    expect(corp.totalTax).toBeGreaterThan(ccpc.totalTax)
  })
})
