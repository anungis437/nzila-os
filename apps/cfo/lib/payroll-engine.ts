/**
 * Payroll Gross-to-Net Engine — Canadian Payroll
 *
 * Full pay-cycle computation for Canadian employees:
 * - Federal income tax withholding (CRA T4127 method)
 * - Provincial income tax withholding
 * - CPP1 + CPP2 contributions (employee & employer portions)
 * - EI premiums (employee & employer portions)
 * - Net pay calculation
 * - T4 annual accumulation
 * - ROE (Record of Employment) insurable earnings
 *
 * Sources:
 * - CRA T4127: "Payroll Deductions Formulas"
 * - CRA T4001: "Employers' Guide — Payroll Deductions and Remittances"
 * - ITA s.153, Reg. 100–110
 *
 * @module cfo/payroll-engine
 */

import type { Province } from '@nzila/tax'
import {
  FEDERAL_BRACKETS_2026,
  FEDERAL_BPA_2026,
  PROVINCIAL_PERSONAL_BRACKETS,
  calculateBracketTax,
} from '@nzila/tax'
import { CPP_2026, EI_2026 } from '@nzila/tax'

// ── Pay period types ────────────────────────────────────────────────────────

export const PayFrequency = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  SEMI_MONTHLY: 'semi-monthly',
  MONTHLY: 'monthly',
} as const

export type PayFrequency = (typeof PayFrequency)[keyof typeof PayFrequency]

/** Number of pay periods per year by frequency */
export const PAY_PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  'semi-monthly': 24,
  monthly: 12,
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface PayrollEmployeeInput {
  /** Employee identifier */
  employeeId: string
  /** Province of employment */
  province: Province
  /** Pay frequency */
  payFrequency: PayFrequency
  /** Gross earnings this period (regular pay) */
  grossRegular: number
  /** Overtime earnings this period */
  grossOvertime: number
  /** Bonus / commission this period (lump sum) */
  grossBonus: number
  /** Taxable benefits this period (e.g., auto benefit, group life > $50K) */
  taxableBenefits: number
  /** Federal TD1 claim code amount (default: BPA) */
  federalClaimCode?: number
  /** Provincial TD1 claim code amount (default: provincial BPA) */
  provincialClaimCode?: number
  /** Year-to-date CPP1 contributions (employee) */
  ytdCpp1: number
  /** Year-to-date CPP2 contributions (employee) */
  ytdCpp2: number
  /** Year-to-date EI premiums (employee) */
  ytdEi: number
  /** Union dues this period */
  unionDues: number
  /** RPP contributions this period (Registered Pension Plan) */
  rppContributions: number
  /** RRSP deductions (employer-sponsored) */
  rrspDeductions: number
  /** Other pre-tax deductions */
  otherPreTaxDeductions: number
  /** Other post-tax deductions (garnishments, etc.) */
  otherPostTaxDeductions: number
  /** Is this a final / termination pay? */
  isTermination: boolean
  /** Vacation pay accrual rate (decimal, e.g., 0.04 = 4%) */
  vacationPayRate: number
}

// ── Results ─────────────────────────────────────────────────────────────────

export interface PayrollResult {
  employeeId: string
  /** Gross income components */
  gross: {
    regular: number
    overtime: number
    bonus: number
    taxableBenefits: number
    vacationPay: number
    totalGross: number
    pensionableEarnings: number
    insurableEarnings: number
  }
  /** Statutory deductions */
  deductions: {
    federalTax: number
    provincialTax: number
    cpp1Employee: number
    cpp2Employee: number
    eiEmployee: number
    totalStatutory: number
  }
  /** Employer costs */
  employerCosts: {
    cpp1Employer: number
    cpp2Employer: number
    eiEmployer: number
    totalEmployerStatutory: number
  }
  /** Voluntary / other deductions */
  voluntaryDeductions: {
    unionDues: number
    rppContributions: number
    rrspDeductions: number
    otherPreTax: number
    otherPostTax: number
    totalVoluntary: number
  }
  /** Net amounts */
  netPay: number
  totalCostToEmployer: number
  /** Period running totals (for T4 accumulation) */
  ytdTotals: {
    cpp1: number
    cpp2: number
    ei: number
    federalTax: number
    provincialTax: number
    grossEarnings: number
    pensionableEarnings: number
    insurableEarnings: number
  }
}

// ── Core calculation ────────────────────────────────────────────────────────

/**
 * Calculate a single pay period's gross-to-net payroll.
 *
 * Implements the CRA T4127 "Payroll Deductions Formulas" method:
 * 1. Annualize the periodic income
 * 2. Calculate annual federal & provincial tax
 * 3. De-annualize back to the period amount
 * 4. Calculate CPP1, CPP2, EI per period (with YTD cap checks)
 *
 * Returns complete breakdown including employer costs for remittance.
 */
export function calculatePayroll(input: PayrollEmployeeInput): PayrollResult {
  const periods = PAY_PERIODS_PER_YEAR[input.payFrequency]

  // ── Step 1: Gross earnings ──
  const grossRegular = input.grossRegular + input.grossOvertime
  const vacationPay = grossRegular * input.vacationPayRate
  const totalGross = grossRegular + input.grossBonus + input.taxableBenefits + vacationPay

  // Pre-tax deductions reduce taxable income
  const preTaxDeductions = input.unionDues + input.rppContributions +
    input.rrspDeductions + input.otherPreTaxDeductions
  const taxableThisPeriod = Math.max(0, totalGross - preTaxDeductions)

  // ── Step 2: CPP1 calculation ──
  // Pensionable earnings = gross (excl. some items, simplified)
  const pensionableEarnings = totalGross
  const annualPensionable = pensionableEarnings * periods
  let cpp1Employee = 0
  if (annualPensionable > CPP_2026.basicExemption) {
    const periodicExemption = CPP_2026.basicExemption / periods
    const cpp1Base = Math.min(pensionableEarnings, CPP_2026.ympe / periods) - periodicExemption
    cpp1Employee = Math.max(0, cpp1Base) * CPP_2026.rate
    // Cap at annual maximum minus YTD
    const remainingCpp1 = Math.max(0, CPP_2026.maxContribution - input.ytdCpp1)
    cpp1Employee = Math.min(cpp1Employee, remainingCpp1)
  }
  cpp1Employee = Math.round(cpp1Employee * 100) / 100

  // ── Step 3: CPP2 calculation (earnings between YMPE and YAMPE) ──
  let cpp2Employee = 0
  if (annualPensionable > CPP_2026.ympe) {
    const _cpp2Base = Math.min(pensionableEarnings, CPP_2026.yampe / periods) -
      Math.max(pensionableEarnings, CPP_2026.ympe / periods) +
      Math.min(pensionableEarnings, CPP_2026.yampe / periods)
    // Simplified: CPP2 on the portion between YMPE and YAMPE per period
    const ympePerPeriod = CPP_2026.ympe / periods
    const yampePerPeriod = CPP_2026.yampe / periods
    const cpp2Earnings = Math.max(0, Math.min(pensionableEarnings, yampePerPeriod) - ympePerPeriod)
    cpp2Employee = cpp2Earnings * CPP_2026.cpp2Rate
    const remainingCpp2 = Math.max(0, CPP_2026.maxCpp2Contribution - input.ytdCpp2)
    cpp2Employee = Math.min(cpp2Employee, remainingCpp2)
  }
  cpp2Employee = Math.round(cpp2Employee * 100) / 100

  // ── Step 4: EI calculation ──
  const insurableEarnings = totalGross // Simplified; excludes some items
  let eiEmployee = insurableEarnings * EI_2026.employeeRate
  const remainingEi = Math.max(0, EI_2026.maxEmployeePremium - input.ytdEi)
  eiEmployee = Math.min(eiEmployee, remainingEi)
  eiEmployee = Math.round(eiEmployee * 100) / 100

  // ── Step 5: Federal income tax (T4127 annualize method) ──
  const annualTaxableIncome = taxableThisPeriod * periods
  // Deduct annual CPP + EI for tax calculation (CRA formula)
  const annualCpp1Deduction = Math.min(cpp1Employee * periods, CPP_2026.maxContribution)
  const annualCpp2Deduction = Math.min(cpp2Employee * periods, CPP_2026.maxCpp2Contribution)
  const annualEiDeduction = Math.min(eiEmployee * periods, EI_2026.maxEmployeePremium)

  const fedClaimCode = input.federalClaimCode ?? FEDERAL_BPA_2026
  const annualFedTaxableForCalc = Math.max(0,
    annualTaxableIncome - annualCpp1Deduction - annualCpp2Deduction - annualEiDeduction,
  )
  const annualFedTax = calculateBracketTax(annualFedTaxableForCalc, FEDERAL_BRACKETS_2026)
  const fedBpaCredit = fedClaimCode * FEDERAL_BRACKETS_2026[0].rate
  const annualFedTaxPayable = Math.max(0, annualFedTax - fedBpaCredit)
  // De-annualize
  let federalTax = Math.round((annualFedTaxPayable / periods) * 100) / 100

  // Bonus: use flat-rate method for lump sums (simplified)
  if (input.grossBonus > 0 && grossRegular === 0) {
    federalTax = Math.round(input.grossBonus * 0.25 * 100) / 100 // Simplified flat rate
  }

  // ── Step 6: Provincial income tax ──
  const provData = PROVINCIAL_PERSONAL_BRACKETS[input.province]
  const provClaimCode = input.provincialClaimCode ?? provData.bpa
  const annualProvTax = calculateBracketTax(annualFedTaxableForCalc, provData.brackets)
  const provBpaCredit = provClaimCode * provData.brackets[0].rate
  const annualProvTaxPayable = Math.max(0, annualProvTax - provBpaCredit)
  let provincialTax = Math.round((annualProvTaxPayable / periods) * 100) / 100

  if (input.grossBonus > 0 && grossRegular === 0) {
    const provTopRate = provData.brackets[provData.brackets.length - 1].rate
    provincialTax = Math.round(input.grossBonus * provTopRate * 100) / 100
  }

  // ── Step 7: Employer statutory costs ──
  const cpp1Employer = cpp1Employee // Employer matches employee CPP1
  const cpp2Employer = cpp2Employee // Employer matches employee CPP2
  const eiEmployer = Math.round(eiEmployee * (EI_2026.employerRate / EI_2026.employeeRate) * 100) / 100

  // ── Step 8: Net pay ──
  const totalStatutory = federalTax + provincialTax + cpp1Employee + cpp2Employee + eiEmployee
  const totalVoluntary = preTaxDeductions + input.otherPostTaxDeductions

  const netPay = Math.round(
    (totalGross - totalStatutory - totalVoluntary) * 100,
  ) / 100

  const totalEmployerStatutory = cpp1Employer + cpp2Employer + eiEmployer
  const totalCostToEmployer = totalGross + totalEmployerStatutory

  return {
    employeeId: input.employeeId,
    gross: {
      regular: grossRegular,
      overtime: input.grossOvertime,
      bonus: input.grossBonus,
      taxableBenefits: input.taxableBenefits,
      vacationPay: Math.round(vacationPay * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
      pensionableEarnings: Math.round(pensionableEarnings * 100) / 100,
      insurableEarnings: Math.round(insurableEarnings * 100) / 100,
    },
    deductions: {
      federalTax,
      provincialTax,
      cpp1Employee,
      cpp2Employee,
      eiEmployee,
      totalStatutory: Math.round(totalStatutory * 100) / 100,
    },
    employerCosts: {
      cpp1Employer,
      cpp2Employer,
      eiEmployer,
      totalEmployerStatutory: Math.round(totalEmployerStatutory * 100) / 100,
    },
    voluntaryDeductions: {
      unionDues: input.unionDues,
      rppContributions: input.rppContributions,
      rrspDeductions: input.rrspDeductions,
      otherPreTax: input.otherPreTaxDeductions,
      otherPostTax: input.otherPostTaxDeductions,
      totalVoluntary: Math.round(totalVoluntary * 100) / 100,
    },
    netPay,
    totalCostToEmployer: Math.round(totalCostToEmployer * 100) / 100,
    ytdTotals: {
      cpp1: Math.round((input.ytdCpp1 + cpp1Employee) * 100) / 100,
      cpp2: Math.round((input.ytdCpp2 + cpp2Employee) * 100) / 100,
      ei: Math.round((input.ytdEi + eiEmployee) * 100) / 100,
      federalTax,
      provincialTax,
      grossEarnings: Math.round(totalGross * 100) / 100,
      pensionableEarnings: Math.round(pensionableEarnings * 100) / 100,
      insurableEarnings: Math.round(insurableEarnings * 100) / 100,
    },
  }
}

// ── T4 Annual Summary ───────────────────────────────────────────────────────

export interface T4Summary {
  employeeId: string
  employerName: string
  taxYear: number
  province: Province
  /** Box 14: Employment income */
  box14EmploymentIncome: number
  /** Box 16: Employee CPP contributions */
  box16Cpp: number
  /** Box 17: Employee CPP2 contributions */
  box17Cpp2: number
  /** Box 18: Employee EI premiums */
  box18Ei: number
  /** Box 20: RPP contributions */
  box20Rpp: number
  /** Box 22: Income tax deducted */
  box22IncomeTax: number
  /** Box 24: EI insurable earnings */
  box24InsurableEarnings: number
  /** Box 26: CPP pensionable earnings */
  box26PensionableEarnings: number
  /** Box 40: Taxable benefits (other than auto) */
  box40TaxableBenefits: number
  /** Box 44: Union dues */
  box44UnionDues: number
  /** Box 52: Pension adjustment */
  box52PensionAdjustment: number
}

/**
 * Build a T4 summary from accumulated pay periods.
 *
 * In production you'd accumulate each pay's result. This convenience
 * function builds from an array of PayrollResults for the year.
 */
export function buildT4Summary(params: {
  employeeId: string
  employerName: string
  taxYear: number
  province: Province
  payResults: PayrollResult[]
}): T4Summary {
  const { employeeId, employerName, taxYear, province, payResults } = params
  const mine = payResults.filter((r) => r.employeeId === employeeId)

  const sum = (fn: (r: PayrollResult) => number) =>
    Math.round(mine.reduce((s, r) => s + fn(r), 0) * 100) / 100

  return {
    employeeId,
    employerName,
    taxYear,
    province,
    box14EmploymentIncome: sum((r) => r.gross.totalGross),
    box16Cpp: sum((r) => r.deductions.cpp1Employee),
    box17Cpp2: sum((r) => r.deductions.cpp2Employee),
    box18Ei: sum((r) => r.deductions.eiEmployee),
    box20Rpp: sum((r) => r.voluntaryDeductions.rppContributions),
    box22IncomeTax: sum((r) => r.deductions.federalTax + r.deductions.provincialTax),
    box24InsurableEarnings: Math.min(
      sum((r) => r.gross.insurableEarnings),
      EI_2026.maxInsurableEarnings,
    ),
    box26PensionableEarnings: Math.min(
      sum((r) => r.gross.pensionableEarnings),
      CPP_2026.yampe,
    ),
    box40TaxableBenefits: sum((r) => r.gross.taxableBenefits),
    box44UnionDues: sum((r) => r.voluntaryDeductions.unionDues),
    box52PensionAdjustment: sum((r) => r.voluntaryDeductions.rppContributions), // Simplified
  }
}

// ── Payroll register ────────────────────────────────────────────────────────

export interface PayrollRegisterEntry {
  employeeId: string
  payDate: string
  gross: number
  federalTax: number
  provincialTax: number
  cpp1: number
  cpp2: number
  ei: number
  totalDeductions: number
  netPay: number
  employerCpp: number
  employerEi: number
  totalRemittance: number
}

/**
 * Build a payroll register (journal entry source) from pay results.
 */
export function buildPayrollRegister(
  results: PayrollResult[],
  payDate: string,
): PayrollRegisterEntry[] {
  return results.map((r) => ({
    employeeId: r.employeeId,
    payDate,
    gross: r.gross.totalGross,
    federalTax: r.deductions.federalTax,
    provincialTax: r.deductions.provincialTax,
    cpp1: r.deductions.cpp1Employee,
    cpp2: r.deductions.cpp2Employee,
    ei: r.deductions.eiEmployee,
    totalDeductions: r.deductions.totalStatutory + r.voluntaryDeductions.totalVoluntary,
    netPay: r.netPay,
    employerCpp: r.employerCosts.cpp1Employer + r.employerCosts.cpp2Employer,
    employerEi: r.employerCosts.eiEmployer,
    totalRemittance:
      r.deductions.federalTax +
      r.deductions.provincialTax +
      r.deductions.cpp1Employee +
      r.deductions.cpp2Employee +
      r.deductions.eiEmployee +
      r.employerCosts.cpp1Employer +
      r.employerCosts.cpp2Employer +
      r.employerCosts.eiEmployer,
  }))
}

// ── Quick payroll estimate ──────────────────────────────────────────────────

/**
 * Quick payroll deduction estimate for advisory purposes.
 * Returns approximate deductions without full YTD tracking.
 */
export function quickPayrollEstimate(params: {
  annualSalary: number
  province: Province
  payFrequency: PayFrequency
}): {
  grossPerPeriod: number
  federalTax: number
  provincialTax: number
  cpp: number
  ei: number
  netPay: number
  annualNetPay: number
  effectiveTaxRate: number
} {
  const periods = PAY_PERIODS_PER_YEAR[params.payFrequency]
  const grossPerPeriod = params.annualSalary / periods

  const result = calculatePayroll({
    employeeId: 'estimate',
    province: params.province,
    payFrequency: params.payFrequency,
    grossRegular: grossPerPeriod,
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
    vacationPayRate: 0,
  })

  const totalDeductions = result.deductions.totalStatutory
  const annualNet = result.netPay * periods

  return {
    grossPerPeriod: Math.round(grossPerPeriod * 100) / 100,
    federalTax: result.deductions.federalTax,
    provincialTax: result.deductions.provincialTax,
    cpp: result.deductions.cpp1Employee + result.deductions.cpp2Employee,
    ei: result.deductions.eiEmployee,
    netPay: result.netPay,
    annualNetPay: Math.round(annualNet * 100) / 100,
    effectiveTaxRate: grossPerPeriod > 0 ? totalDeductions / grossPerPeriod : 0,
  }
}
