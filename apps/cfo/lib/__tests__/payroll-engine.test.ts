/**
 * payroll-engine.ts — unit tests
 *
 * Mocks @nzila/tax with realistic 2026 Canadian values.
 * Tests cover: calculatePayroll, buildT4Summary, buildPayrollRegister,
 * quickPayrollEstimate, and the PAY_PERIODS_PER_YEAR constant.
 */

import { describe, expect, it, vi } from 'vitest'

// ── Mock @nzila/tax ──────────────────────────────────────────────────────────

function calculateBracketTax(income: number, brackets: Array<{ rate: number; limit?: number }>): number {
  let tax = 0
  let remaining = income
  let prev = 0
  for (const bracket of brackets) {
    const size = bracket.limit != null ? bracket.limit - prev : Infinity
    const taxable = Math.min(remaining, size)
    tax += taxable * bracket.rate
    remaining -= taxable
    prev = bracket.limit ?? 0
    if (remaining <= 0) break
  }
  return tax
}

vi.mock('@nzila/tax', () => {
  const _calculateBracketTax = (
    income: number,
    brackets: Array<{ rate: number; limit?: number }>,
  ) => {
    let tax = 0
    let remaining = income
    let prev = 0
    for (const bracket of brackets) {
      const size = bracket.limit != null ? bracket.limit - prev : Infinity
      const taxable = Math.min(remaining, size)
      tax += taxable * bracket.rate
      remaining -= taxable
      prev = bracket.limit ?? 0
      if (remaining <= 0) break
    }
    return tax
  }

  return {
    FEDERAL_BRACKETS_2026: [
      { rate: 0.15, limit: 57_375 },
      { rate: 0.205, limit: 114_750 },
      { rate: 0.26, limit: 158_519 },
      { rate: 0.29, limit: 220_000 },
      { rate: 0.33 },
    ],
    FEDERAL_BPA_2026: 16_129,
    PROVINCIAL_PERSONAL_BRACKETS: {
      ON: {
        bpa: 11_865,
        brackets: [
          { rate: 0.0505, limit: 51_446 },
          { rate: 0.0915, limit: 102_894 },
          { rate: 0.1116, limit: 150_000 },
          { rate: 0.1216, limit: 220_000 },
          { rate: 0.1316 },
        ],
      },
      QC: {
        bpa: 17_183,
        brackets: [
          { rate: 0.14, limit: 51_780 },
          { rate: 0.19, limit: 103_545 },
          { rate: 0.24, limit: 126_000 },
          { rate: 0.2575 },
        ],
      },
      AB: {
        bpa: 21_003,
        brackets: [
          { rate: 0.10, limit: 148_269 },
          { rate: 0.12, limit: 177_922 },
          { rate: 0.13, limit: 237_230 },
          { rate: 0.14, limit: 355_845 },
          { rate: 0.15 },
        ],
      },
    },
    calculateBracketTax: _calculateBracketTax,
    CPP_2026: {
      basicExemption: 3_500,
      ympe: 71_300,
      yampe: 73_200,
      rate: 0.0595,
      cpp2Rate: 0.04,
      maxContribution: 4_034.10,
      maxCpp2Contribution: 188.00,
    },
    EI_2026: {
      employeeRate: 0.01666,
      employerRate: 0.02332,
      maxEmployeePremium: 1_077.48,
      maxInsurableEarnings: 64_900,
    },
  }
})

import {
  PAY_PERIODS_PER_YEAR,
  calculatePayroll,
  buildT4Summary,
  buildPayrollRegister,
  quickPayrollEstimate,
  type PayrollEmployeeInput,
  type PayrollResult,
} from '../payroll-engine'

// ── Helpers ──────────────────────────────────────────────────────────────────

function baseInput(overrides: Partial<PayrollEmployeeInput> = {}): PayrollEmployeeInput {
  return {
    employeeId: 'emp-001',
    province: 'ON' as PayrollEmployeeInput['province'],
    payFrequency: 'biweekly',
    grossRegular: 3_846.15, // ~$100K / 26
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
  }
}

// ── PAY_PERIODS_PER_YEAR ─────────────────────────────────────────────────────

describe('PAY_PERIODS_PER_YEAR', () => {
  it('weekly = 52', () => {
    expect(PAY_PERIODS_PER_YEAR.weekly).toBe(52)
  })

  it('biweekly = 26', () => {
    expect(PAY_PERIODS_PER_YEAR.biweekly).toBe(26)
  })

  it('semi-monthly = 24', () => {
    expect(PAY_PERIODS_PER_YEAR['semi-monthly']).toBe(24)
  })

  it('monthly = 12', () => {
    expect(PAY_PERIODS_PER_YEAR.monthly).toBe(12)
  })
})

// ── calculatePayroll ─────────────────────────────────────────────────────────

describe('calculatePayroll — basic biweekly ON employee', () => {
  const result = calculatePayroll(baseInput())

  it('returns correct employeeId', () => {
    expect(result.employeeId).toBe('emp-001')
  })

  it('gross.totalGross includes regular + vacation pay', () => {
    // grossRegular = 3846.15, vacationPayRate = 0.04
    // vacationPay = 3846.15 * 0.04 ≈ 153.85
    const expected = 3_846.15 + 3_846.15 * 0.04
    expect(result.gross.totalGross).toBeCloseTo(expected, 1)
  })

  it('net pay is less than gross', () => {
    expect(result.netPay).toBeLessThan(result.gross.totalGross)
  })

  it('net pay is positive', () => {
    expect(result.netPay).toBeGreaterThan(0)
  })

  it('federal tax is positive', () => {
    expect(result.deductions.federalTax).toBeGreaterThan(0)
  })

  it('provincial tax is positive', () => {
    expect(result.deductions.provincialTax).toBeGreaterThan(0)
  })

  it('CPP1 employee is positive', () => {
    expect(result.deductions.cpp1Employee).toBeGreaterThan(0)
  })

  it('EI employee is positive', () => {
    expect(result.deductions.eiEmployee).toBeGreaterThan(0)
  })

  it('employer CPP1 matches employee CPP1', () => {
    expect(result.employerCosts.cpp1Employer).toBeCloseTo(result.deductions.cpp1Employee, 2)
  })

  it('employer EI > employee EI (1.4× relationship)', () => {
    expect(result.employerCosts.eiEmployer).toBeGreaterThan(result.deductions.eiEmployee)
  })

  it('totalStatutory = sum of individual statutory deductions', () => {
    const { federalTax, provincialTax, cpp1Employee, cpp2Employee, eiEmployee } = result.deductions
    const sum = Math.round((federalTax + provincialTax + cpp1Employee + cpp2Employee + eiEmployee) * 100) / 100
    expect(result.deductions.totalStatutory).toBeCloseTo(sum, 2)
  })

  it('totalCostToEmployer = gross + employer statutory', () => {
    const expected = result.gross.totalGross + result.employerCosts.totalEmployerStatutory
    expect(result.totalCostToEmployer).toBeCloseTo(expected, 2)
  })
})

describe('calculatePayroll — YTD cap for CPP', () => {
  it('CPP1 is zero when YTD already at maximum', () => {
    const r = calculatePayroll(baseInput({ ytdCpp1: 4_034.10 }))
    expect(r.deductions.cpp1Employee).toBe(0)
  })

  it('CPP1 is capped when YTD is near maximum', () => {
    // Near max: only $10 remaining
    const r = calculatePayroll(baseInput({ ytdCpp1: 4_024.10 }))
    expect(r.deductions.cpp1Employee).toBeLessThanOrEqual(10)
    expect(r.deductions.cpp1Employee).toBeGreaterThan(0)
  })
})

describe('calculatePayroll — YTD cap for EI', () => {
  it('EI is zero when YTD already at maximum', () => {
    const r = calculatePayroll(baseInput({ ytdEi: 1_077.48 }))
    expect(r.deductions.eiEmployee).toBe(0)
  })
})

describe('calculatePayroll — bonus-only pay', () => {
  it('uses flat 25% rate for bonus-only pay', () => {
    const r = calculatePayroll(baseInput({ grossRegular: 0, grossBonus: 5_000, vacationPayRate: 0 }))
    // Flat rate: 5000 * 0.25 = 1250
    expect(r.deductions.federalTax).toBeCloseTo(1_250, 0)
  })
})

describe('calculatePayroll — voluntary deductions', () => {
  it('union dues reduce net pay', () => {
    const without = calculatePayroll(baseInput())
    const with_ = calculatePayroll(baseInput({ unionDues: 50 }))
    expect(with_.netPay).toBeLessThan(without.netPay)
  })

  it('RPP contributions reduce net pay', () => {
    const without = calculatePayroll(baseInput())
    const with_ = calculatePayroll(baseInput({ rppContributions: 200 }))
    expect(with_.netPay).toBeLessThan(without.netPay)
  })
})

describe('calculatePayroll — vacation pay', () => {
  it('zero vacation rate = no vacation pay in gross', () => {
    const r = calculatePayroll(baseInput({ vacationPayRate: 0 }))
    expect(r.gross.vacationPay).toBe(0)
    expect(r.gross.totalGross).toBeCloseTo(3_846.15, 1)
  })

  it('4% vacation rate adds to gross', () => {
    const r = calculatePayroll(baseInput({ vacationPayRate: 0.04 }))
    expect(r.gross.vacationPay).toBeCloseTo(3_846.15 * 0.04, 2)
  })
})

describe('calculatePayroll — YTD totals', () => {
  it('ytdTotals.cpp1 = ytdCpp1 + cpp1Employee', () => {
    const r = calculatePayroll(baseInput({ ytdCpp1: 1_000 }))
    expect(r.ytdTotals.cpp1).toBeCloseTo(1_000 + r.deductions.cpp1Employee, 2)
  })

  it('ytdTotals.ei = ytdEi + eiEmployee', () => {
    const r = calculatePayroll(baseInput({ ytdEi: 200 }))
    expect(r.ytdTotals.ei).toBeCloseTo(200 + r.deductions.eiEmployee, 2)
  })
})

// ── buildT4Summary ────────────────────────────────────────────────────────────

describe('buildT4Summary', () => {
  const pay1 = calculatePayroll(baseInput({ ytdCpp1: 0, ytdEi: 0 }))
  const pay2 = calculatePayroll(baseInput({ ytdCpp1: pay1.deductions.cpp1Employee, ytdEi: pay1.deductions.eiEmployee }))

  const t4 = buildT4Summary({
    employeeId: 'emp-001',
    employerName: 'ACME Corp',
    taxYear: 2026,
    province: 'ON' as PayrollEmployeeInput['province'],
    payResults: [pay1, pay2],
  })

  it('sets correct employeeId and employerName', () => {
    expect(t4.employeeId).toBe('emp-001')
    expect(t4.employerName).toBe('ACME Corp')
  })

  it('box14 = sum of totalGross', () => {
    const expected = Math.round((pay1.gross.totalGross + pay2.gross.totalGross) * 100) / 100
    expect(t4.box14EmploymentIncome).toBeCloseTo(expected, 2)
  })

  it('box16 = sum of cpp1Employee', () => {
    const expected = Math.round((pay1.deductions.cpp1Employee + pay2.deductions.cpp1Employee) * 100) / 100
    expect(t4.box16Cpp).toBeCloseTo(expected, 2)
  })

  it('box18 = sum of eiEmployee', () => {
    const expected = Math.round((pay1.deductions.eiEmployee + pay2.deductions.eiEmployee) * 100) / 100
    expect(t4.box18Ei).toBeCloseTo(expected, 2)
  })

  it('box22 = sum of federal + provincial tax', () => {
    const fed = pay1.deductions.federalTax + pay2.deductions.federalTax
    const prov = pay1.deductions.provincialTax + pay2.deductions.provincialTax
    expect(t4.box22IncomeTax).toBeCloseTo(Math.round((fed + prov) * 100) / 100, 2)
  })

  it('filters to only the matching employeeId', () => {
    const otherEmp = calculatePayroll(baseInput({ employeeId: 'emp-999' }))
    const t4Filtered = buildT4Summary({
      employeeId: 'emp-001',
      employerName: 'ACME',
      taxYear: 2026,
      province: 'ON' as PayrollEmployeeInput['province'],
      payResults: [pay1, otherEmp],
    })
    // Only pay1 should be included — box14 should not include otherEmp gross
    expect(t4Filtered.box14EmploymentIncome).toBeCloseTo(pay1.gross.totalGross, 2)
  })
})

// ── buildPayrollRegister ──────────────────────────────────────────────────────

describe('buildPayrollRegister', () => {
  const result = calculatePayroll(baseInput())
  const register = buildPayrollRegister([result], '2026-01-17')

  it('returns one entry per pay result', () => {
    expect(register).toHaveLength(1)
  })

  it('sets payDate correctly', () => {
    expect(register[0].payDate).toBe('2026-01-17')
  })

  it('gross = totalGross', () => {
    expect(register[0].gross).toBe(result.gross.totalGross)
  })

  it('netPay matches result', () => {
    expect(register[0].netPay).toBe(result.netPay)
  })

  it('totalRemittance includes both employee and employer statutory', () => {
    const emp = result.deductions
    const er = result.employerCosts
    const expected = emp.federalTax + emp.provincialTax + emp.cpp1Employee + emp.cpp2Employee + emp.eiEmployee +
      er.cpp1Employer + er.cpp2Employer + er.eiEmployer
    expect(register[0].totalRemittance).toBeCloseTo(expected, 2)
  })

  it('multiple results', () => {
    const r2 = calculatePayroll(baseInput({ employeeId: 'emp-002' }))
    const reg = buildPayrollRegister([result, r2], '2026-01-17')
    expect(reg).toHaveLength(2)
    expect(reg[1].employeeId).toBe('emp-002')
  })
})

// ── quickPayrollEstimate ──────────────────────────────────────────────────────

describe('quickPayrollEstimate', () => {
  it('annualNetPay is less than annualSalary', () => {
    const est = quickPayrollEstimate({ annualSalary: 100_000, province: 'ON' as PayrollEmployeeInput['province'], payFrequency: 'biweekly' })
    expect(est.annualNetPay).toBeLessThan(100_000)
  })

  it('grossPerPeriod = annualSalary / 26 for biweekly', () => {
    const est = quickPayrollEstimate({ annualSalary: 100_000, province: 'ON' as PayrollEmployeeInput['province'], payFrequency: 'biweekly' })
    expect(est.grossPerPeriod).toBeCloseTo(100_000 / 26, 2)
  })

  it('grossPerPeriod = annualSalary / 12 for monthly', () => {
    const est = quickPayrollEstimate({ annualSalary: 60_000, province: 'ON' as PayrollEmployeeInput['province'], payFrequency: 'monthly' })
    expect(est.grossPerPeriod).toBeCloseTo(60_000 / 12, 2)
  })

  it('effective tax rate is between 0 and 1', () => {
    const est = quickPayrollEstimate({ annualSalary: 80_000, province: 'ON' as PayrollEmployeeInput['province'], payFrequency: 'biweekly' })
    expect(est.effectiveTaxRate).toBeGreaterThan(0)
    expect(est.effectiveTaxRate).toBeLessThan(1)
  })

  it('returns cpp and ei > 0', () => {
    const est = quickPayrollEstimate({ annualSalary: 80_000, province: 'ON' as PayrollEmployeeInput['province'], payFrequency: 'biweekly' })
    expect(est.cpp).toBeGreaterThan(0)
    expect(est.ei).toBeGreaterThan(0)
  })

  it('zero salary returns zero net pay', () => {
    const est = quickPayrollEstimate({ annualSalary: 0, province: 'ON' as PayrollEmployeeInput['province'], payFrequency: 'monthly' })
    expect(est.annualNetPay).toBe(0)
    expect(est.effectiveTaxRate).toBe(0)
  })
})
