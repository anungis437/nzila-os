/**
 * Tests — Payroll Gross-to-Net Engine
 */
import { describe, it, expect } from 'vitest'
import {
  calculatePayroll,
  buildT4Summary,
  buildPayrollRegister,
  quickPayrollEstimate,
  PAY_PERIODS_PER_YEAR,
} from '../lib/payroll-engine'
import { CPP_2026, EI_2026 } from '@nzila/tax'

const makeInput = (overrides = {}) => ({
  employeeId: 'emp-1',
  province: 'ON' as const,
  payFrequency: 'biweekly' as const,
  grossRegular: 4_000,
  grossOvertime: 0,
  grossBonus: 0,
  taxableBenefits: 0,
  ytdCpp1: 0,
  ytdCpp2: 0,
  ytdEi: 0,
  unionDues: 0,
  rppContributions: 0,
  rrspDeductions: 0,
  otherPreTaxDeductions: 0,
  otherPostTaxDeductions: 0,
  isTermination: false,
  vacationPayRate: 0.04,
  ...overrides,
})

describe('Payroll calculation', () => {
  it('should calculate a standard biweekly pay', () => {
    const result = calculatePayroll(makeInput())

    expect(result.gross.regular).toBe(4_000)
    expect(result.gross.vacationPay).toBeCloseTo(160, 2) // 4% of 4K
    expect(result.gross.totalGross).toBeCloseTo(4_160, 2)

    // Deductions should be positive
    expect(result.deductions.federalTax).toBeGreaterThan(0)
    expect(result.deductions.provincialTax).toBeGreaterThan(0)
    expect(result.deductions.cpp1Employee).toBeGreaterThan(0)
    expect(result.deductions.eiEmployee).toBeGreaterThan(0)

    // Net pay should be less than gross
    expect(result.netPay).toBeGreaterThan(0)
    expect(result.netPay).toBeLessThan(result.gross.totalGross)
  })

  it('should cap CPP1 at annual maximum', () => {
    // YTD already at max
    const result = calculatePayroll(
      makeInput({ ytdCpp1: CPP_2026.maxContribution }),
    )
    expect(result.deductions.cpp1Employee).toBe(0)
  })

  it('should cap EI at annual maximum', () => {
    const result = calculatePayroll(
      makeInput({ ytdEi: EI_2026.maxEmployeePremium }),
    )
    expect(result.deductions.eiEmployee).toBe(0)
  })

  it('employer CPP should match employee CPP', () => {
    const result = calculatePayroll(makeInput())
    expect(result.employerCosts.cpp1Employer).toBe(
      result.deductions.cpp1Employee,
    )
  })

  it('employer EI should be 1.4× employee EI', () => {
    const result = calculatePayroll(makeInput())
    const expectedRatio = EI_2026.employerRate / EI_2026.employeeRate
    const actual = result.employerCosts.eiEmployer / result.deductions.eiEmployee
    expect(actual).toBeCloseTo(expectedRatio, 1)
  })

  it('should reduce taxable income for pre-tax deductions', () => {
    const base = calculatePayroll(makeInput())
    const withRrsp = calculatePayroll(makeInput({ rrspDeductions: 500 }))

    // With $500 RRSP, federal tax should be lower
    expect(withRrsp.deductions.federalTax).toBeLessThan(base.deductions.federalTax)
  })

  it('total cost to employer should exceed gross', () => {
    const result = calculatePayroll(makeInput())
    expect(result.totalCostToEmployer).toBeGreaterThan(result.gross.totalGross)
  })

  it('should handle zero gross (edge case)', () => {
    const result = calculatePayroll(makeInput({ grossRegular: 0 }))
    expect(result.gross.totalGross).toBe(0)
    expect(result.netPay).toBe(0)
  })
})

describe('Quick payroll estimate', () => {
  it('should produce reasonable estimate for $80K salary', () => {
    const est = quickPayrollEstimate({
      annualSalary: 80_000,
      province: 'ON',
      payFrequency: 'biweekly',
    })

    expect(est.grossPerPeriod).toBeCloseTo(80_000 / 26, 0)
    expect(est.netPay).toBeGreaterThan(0)
    expect(est.netPay).toBeLessThan(est.grossPerPeriod)
    expect(est.effectiveTaxRate).toBeGreaterThan(0.20)
    expect(est.effectiveTaxRate).toBeLessThan(0.45)
  })

  it('should show higher tax for higher salary', () => {
    const low = quickPayrollEstimate({
      annualSalary: 50_000,
      province: 'ON',
      payFrequency: 'biweekly',
    })
    const high = quickPayrollEstimate({
      annualSalary: 150_000,
      province: 'ON',
      payFrequency: 'biweekly',
    })

    expect(high.effectiveTaxRate).toBeGreaterThan(low.effectiveTaxRate)
  })
})

describe('T4 summary', () => {
  it('should accumulate pay periods into T4 boxes', () => {
    const pay1 = calculatePayroll(makeInput())
    const pay2 = calculatePayroll(
      makeInput({ ytdCpp1: pay1.deductions.cpp1Employee, ytdEi: pay1.deductions.eiEmployee }),
    )

    const t4 = buildT4Summary({
      employeeId: 'emp-1',
      employerName: 'TAAG Professionals Inc.',
      taxYear: 2026,
      province: 'ON',
      payResults: [pay1, pay2],
    })

    expect(t4.box14EmploymentIncome).toBeCloseTo(
      pay1.gross.totalGross + pay2.gross.totalGross,
      2,
    )
    expect(t4.box16Cpp).toBeCloseTo(
      pay1.deductions.cpp1Employee + pay2.deductions.cpp1Employee,
      2,
    )
    expect(t4.box18Ei).toBeCloseTo(
      pay1.deductions.eiEmployee + pay2.deductions.eiEmployee,
      2,
    )
    expect(t4.box24InsurableEarnings).toBeLessThanOrEqual(EI_2026.maxInsurableEarnings)
  })
})

describe('Payroll register', () => {
  it('should build register entries for remittance', () => {
    const pay = calculatePayroll(makeInput())
    const register = buildPayrollRegister([pay], '2026-03-15')

    expect(register).toHaveLength(1)
    expect(register[0].gross).toBe(pay.gross.totalGross)
    expect(register[0].netPay).toBe(pay.netPay)
    expect(register[0].totalRemittance).toBeGreaterThan(0)
    // Remittance = employee deductions + employer costs
    expect(register[0].totalRemittance).toBeCloseTo(
      register[0].federalTax +
      register[0].provincialTax +
      register[0].cpp1 +
      register[0].cpp2 +
      register[0].ei +
      register[0].employerCpp +
      register[0].employerEi,
      2,
    )
  })
})

describe('Pay period constants', () => {
  it('should have correct periods per year', () => {
    expect(PAY_PERIODS_PER_YEAR.weekly).toBe(52)
    expect(PAY_PERIODS_PER_YEAR.biweekly).toBe(26)
    expect(PAY_PERIODS_PER_YEAR['semi-monthly']).toBe(24)
    expect(PAY_PERIODS_PER_YEAR.monthly).toBe(12)
  })
})
