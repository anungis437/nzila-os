/**
 * T2 Corporate Tax Schedule Engine — Canada Revenue Agency
 *
 * Implements the core T2 return schedules for CCPCs:
 * - Schedule 1:   Net Income for Tax Purposes
 * - Schedule 7:   Aggregate Investment Income (AAII) & SBD calculation
 * - Schedule 8:   Capital Cost Allowance (CCA)
 * - Schedule 100:  Balance Sheet Information (GIFI-coded)
 * - Schedule 125:  Income Statement Information (GIFI-coded)
 * - Schedule 200:  T2 Corporation Income Tax Return (master)
 *
 * All rates sourced from: CRA T4012 "T2 Corporation — Income Tax Guide"
 * and ITA (Income Tax Act) sections referenced inline.
 *
 * @module cfo/t2-schedules
 */

import type { Province } from '@nzila/tax'
import {
  FEDERAL_GENERAL_RATE,
  FEDERAL_SMALL_BUSINESS_RATE,
  SBD_BUSINESS_LIMIT,
  PROVINCIAL_RATES,
} from '@nzila/tax'

// ── Schedule 1: Net Income for Tax Purposes ─────────────────────────────────
// ITA s.3: Components of income

export interface Schedule1Input {
  /** Net income per financial statements (GIFI 9999) */
  netIncomePerStatements: number
  /** Add back: amortization per books (not tax-deductible) */
  addBackAmortization: number
  /** Add back: meals & entertainment (50% non-deductible, ITA s.67.1) */
  addBackMeals: number
  /** Add back: non-deductible penalties/fines (ITA s.67.6) */
  addBackPenalties: number
  /** Add back: political contributions */
  addBackPolitical: number
  /** Add back: non-deductible reserves */
  addBackReserves: number
  /** Add back: charitable donations (claimed separately, ITA s.110.1) */
  addBackDonations: number
  /** Add back: life insurance premiums (non-deductible, ITA s.18(1)(o)) */
  addBackLifeInsurance: number
  /** Deduct: CCA claimed (tax depreciation per Schedule 8) */
  deductCca: number
  /** Deduct: terminal losses */
  deductTerminalLoss: number
  /** Deduct: capital gains reserve claimed (ITA s.40(1)(a)(iii)) */
  deductCapitalGainReserve: number
  /** Section 85 / 86 rollovers and reorganization adjustments */
  otherAdjustments: number
}

export interface Schedule1Result {
  netIncomePerStatements: number
  totalAddBacks: number
  totalDeductions: number
  netIncomeForTax: number
  breakdown: { description: string; amount: number }[]
}

/**
 * Calculate Schedule 1 — Net Income for Tax Purposes.
 *
 * Starts with accounting net income and applies permanent + timing
 * differences to arrive at taxable income per ITA s.3.
 */
export function calculateSchedule1(input: Schedule1Input): Schedule1Result {
  const addBacks = [
    { description: 'Amortization per books', amount: input.addBackAmortization },
    { description: 'Meals & entertainment (50%, ITA s.67.1)', amount: input.addBackMeals },
    { description: 'Non-deductible penalties/fines (ITA s.67.6)', amount: input.addBackPenalties },
    { description: 'Political contributions', amount: input.addBackPolitical },
    { description: 'Non-deductible reserves', amount: input.addBackReserves },
    { description: 'Charitable donations (ITA s.110.1)', amount: input.addBackDonations },
    { description: 'Life insurance premiums (ITA s.18(1)(o))', amount: input.addBackLifeInsurance },
  ]

  const deductions = [
    { description: 'CCA claimed (Schedule 8)', amount: -input.deductCca },
    { description: 'Terminal losses', amount: -input.deductTerminalLoss },
    { description: 'Capital gain reserve (ITA s.40(1)(a)(iii))', amount: -input.deductCapitalGainReserve },
    { description: 'Other adjustments (s.85/86)', amount: input.otherAdjustments },
  ]

  const totalAddBacks = addBacks.reduce((s, a) => s + a.amount, 0)
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
  const netIncomeForTax = input.netIncomePerStatements + totalAddBacks + totalDeductions

  return {
    netIncomePerStatements: input.netIncomePerStatements,
    totalAddBacks,
    totalDeductions,
    netIncomeForTax: Math.max(0, netIncomeForTax),
    breakdown: [
      { description: 'Net income per financial statements', amount: input.netIncomePerStatements },
      ...addBacks.filter((a) => a.amount !== 0),
      ...deductions.filter((d) => d.amount !== 0),
    ],
  }
}

// ── Schedule 7: AAII & Small Business Deduction ─────────────────────────────
// ITA s.125(1), s.129(4)

export interface Schedule7Input {
  /** Active business income (line 400) */
  activeBusinessIncome: number
  /** Aggregate investment income: interest, rents, royalties (ITA s.129(4)) */
  investmentIncome: number
  /** Taxable capital gains (net of allowable losses) */
  taxableCapitalGains: number
  /** Taxable income (from Schedule 1) */
  taxableIncome: number
  /** Taxable capital employed in Canada (TCEC) — for SBD clawback per ITA s.125(5.1) */
  taxableCapitalEmployed: number
  /** Associated corporations' share of the SBD limit ($500K total) */
  associatedCorpSbdShare: number
  /** Province of taxation */
  province: Province
  /** Is the corporation a CCPC? */
  isCcpc: boolean
}

export interface Schedule7Result {
  /** Adjusted aggregate investment income */
  aaii: number
  /** SBD business limit (before clawback) */
  sbdLimitBeforeClawback: number
  /** AAII clawback reduction (5× excess over $50K) */
  aaiiClawback: number
  /** TCEC clawback reduction (excess over $10M) */
  tcecClawback: number
  /** Effective SBD limit */
  effectiveSbdLimit: number
  /** Income eligible for SBD */
  sbdEligibleIncome: number
  /** SBD amount (reduction in federal tax) */
  sbdAmount: number
  /** Tax on active business income at general rate */
  generalRateTax: number
  /** Tax on active business income at SBD rate */
  sbdRateTax: number
  /** Additional refundable tax on investment income (ITA s.123.3) — 10⅔% */
  additionalRefundableTax: number
  /** Part IV tax on eligible dividends received (ITA s.186) — 38⅓% */
  partIvTaxRate: number
}

/**
 * Calculate Schedule 7 — AAII and SBD.
 *
 * The small business deduction is the most valuable CCPC benefit.
 * It reduces the federal rate from 15% to 9% on the first $500K of
 * active business income — but is clawed back for:
 * - AAII over $50K (5× reduction per ITA s.125(5.1))
 * - TCEC over $10M (straight-line reduction to $15M per ITA s.125(5.1))
 */
export function calculateSchedule7(input: Schedule7Input): Schedule7Result {
  if (!input.isCcpc) {
    return {
      aaii: 0,
      sbdLimitBeforeClawback: 0,
      aaiiClawback: 0,
      tcecClawback: 0,
      effectiveSbdLimit: 0,
      sbdEligibleIncome: 0,
      sbdAmount: 0,
      generalRateTax: input.activeBusinessIncome * FEDERAL_GENERAL_RATE,
      sbdRateTax: 0,
      additionalRefundableTax: 0,
      partIvTaxRate: 0.3833,
    }
  }

  const aaii = input.investmentIncome + input.taxableCapitalGains

  // SBD limit: $500K shared among associated corporations
  const baseSbdLimit = input.associatedCorpSbdShare > 0
    ? Math.min(SBD_BUSINESS_LIMIT, input.associatedCorpSbdShare)
    : SBD_BUSINESS_LIMIT

  // AAII clawback: 5 × (AAII − $50,000) — ITA s.125(5.1)
  const aaiiClawback = aaii > 50_000 ? Math.min(baseSbdLimit, 5 * (aaii - 50_000)) : 0

  // TCEC clawback: straight-line from $10M to $15M
  let tcecClawback = 0
  if (input.taxableCapitalEmployed > 10_000_000) {
    const excessCapital = input.taxableCapitalEmployed - 10_000_000
    tcecClawback = Math.min(baseSbdLimit, (excessCapital / 5_000_000) * baseSbdLimit)
  }

  // Effective limit is reduced by the GREATER of the two clawbacks
  const effectiveSbdLimit = Math.max(0, baseSbdLimit - Math.max(aaiiClawback, tcecClawback))

  // SBD eligible = lesser of ABI, taxable income, effective limit
  const sbdEligibleIncome = Math.min(
    Math.max(0, input.activeBusinessIncome),
    Math.max(0, input.taxableIncome),
    effectiveSbdLimit,
  )

  // SBD amount = eligible income × (general rate − SBD rate)
  const sbdRateDiff = FEDERAL_GENERAL_RATE - FEDERAL_SMALL_BUSINESS_RATE
  const sbdAmount = sbdEligibleIncome * sbdRateDiff

  // General rate income = ABI minus SBD eligible
  const generalRateIncome = Math.max(0, input.activeBusinessIncome - sbdEligibleIncome)

  // Additional refundable tax on investment income: 10⅔% (ITA s.123.3)
  const additionalRefundableTax = aaii * (10 + 2 / 3) / 100

  return {
    aaii,
    sbdLimitBeforeClawback: baseSbdLimit,
    aaiiClawback,
    tcecClawback,
    effectiveSbdLimit,
    sbdEligibleIncome,
    sbdAmount,
    generalRateTax: generalRateIncome * FEDERAL_GENERAL_RATE,
    sbdRateTax: sbdEligibleIncome * FEDERAL_SMALL_BUSINESS_RATE,
    additionalRefundableTax,
    partIvTaxRate: 0.3833,
  }
}

// ── Schedule 200: T2 Return (master computation) ────────────────────────────

export interface T2ReturnInput {
  /** Organization identifier */
  orgId: string
  /** Tax year */
  taxYear: number
  /** Fiscal year end (MM-DD) */
  fiscalYearEnd: string
  /** Province */
  province: Province
  /** Is this a CCPC? */
  isCcpc: boolean
  /** Schedule 1 input */
  schedule1: Schedule1Input
  /** Schedule 7 input */
  schedule7: Omit<Schedule7Input, 'taxableIncome' | 'province' | 'isCcpc'>
  /** CCA claimed (from Schedule 8 — computed separately) */
  ccaClaimed: number
  /** Charitable donations (ITA s.110.1, max 75% of net income) */
  charitableDonations: number
  /** Dividends received from taxable Canadian corporations */
  dividendsReceived: number
  /** Loss carryforwards applied */
  lossCarryforwards: number
  /** Tax installments already paid */
  installmentsPaid: number
  /** Tax withheld at source */
  taxWithheld: number
}

export interface T2ReturnResult {
  /** Schedule 1 result */
  schedule1: Schedule1Result
  /** Schedule 7 result */
  schedule7: Schedule7Result
  /** Taxable income (line 300) */
  taxableIncome: number
  /** Federal tax before credits */
  federalTaxBeforeCredits: number
  /** SBD (Schedule 7) */
  sbd: number
  /** Federal tax after SBD */
  federalTaxAfterSbd: number
  /** Provincial tax */
  provincialTax: number
  /** Total income tax */
  totalTax: number
  /** RDTOH — refundable dividend tax on hand (ITA s.129) */
  rdtoh: number
  /** Tax payable after installments & withholding */
  balanceDue: number
  /** Monthly installment recommendation for next year */
  monthlyInstallment: number
  /** Effective tax rate */
  effectiveRate: number
  /** Summary lines for the T2 */
  lines: { line: number; description: string; amount: number }[]
}

/**
 * Calculate a complete T2 Corporate Income Tax Return.
 *
 * This orchestrates Schedule 1 (net income), Schedule 7 (SBD/AAII),
 * and the master T2 computation into a single result.
 */
export function calculateT2Return(input: T2ReturnInput): T2ReturnResult {
  // Step 1: Schedule 1 — Net Income for Tax Purposes
  const s1 = calculateSchedule1({
    ...input.schedule1,
    deductCca: input.ccaClaimed,
  })

  // Step 2: Deductions from net income
  const donationLimit = s1.netIncomeForTax * 0.75
  const allowedDonations = Math.min(input.charitableDonations, donationLimit)
  const dividendDeduction = input.dividendsReceived // ITA s.112(1)

  const taxableIncome = Math.max(
    0,
    s1.netIncomeForTax - allowedDonations - dividendDeduction - input.lossCarryforwards,
  )

  // Step 3: Schedule 7 — SBD and AAII
  const s7 = calculateSchedule7({
    ...input.schedule7,
    taxableIncome,
    province: input.province,
    isCcpc: input.isCcpc,
  })

  // Step 4: Federal tax calculation
  const federalTaxBeforeCredits = taxableIncome * FEDERAL_GENERAL_RATE
  const federalTaxAfterSbd = federalTaxBeforeCredits - s7.sbdAmount

  // Step 5: Provincial tax
  const provRates = PROVINCIAL_RATES[input.province]
  let provincialTax: number
  if (provRates && input.isCcpc) {
    const sbdProvIncome = s7.sbdEligibleIncome
    const generalProvIncome = taxableIncome - sbdProvIncome
    provincialTax =
      sbdProvIncome * (provRates.smallBusinessRate ?? provRates.generalRate) +
      generalProvIncome * provRates.generalRate
  } else {
    const rate = provRates?.generalRate ?? 0.115
    provincialTax = taxableIncome * rate
  }

  // Step 6: Total tax
  const totalTax = federalTaxAfterSbd + provincialTax + s7.additionalRefundableTax

  // Step 7: RDTOH (30⅔% of investment income, refundable on dividend payment)
  const rdtoh = s7.aaii * (30 + 2 / 3) / 100

  // Step 8: Balance due
  const balanceDue = totalTax - input.installmentsPaid - input.taxWithheld

  // Step 9: Monthly installment for next year (1/12 of current year tax)
  const monthlyInstallment = Math.max(0, Math.ceil((totalTax / 12) * 100) / 100)

  const effectiveRate = taxableIncome > 0 ? totalTax / taxableIncome : 0

  const lines: T2ReturnResult['lines'] = [
    { line: 300, description: 'Taxable income', amount: taxableIncome },
    { line: 360, description: 'Basic federal tax (Part I)', amount: federalTaxBeforeCredits },
    { line: 430, description: 'Small business deduction', amount: s7.sbdAmount },
    { line: 440, description: 'Federal tax after SBD', amount: federalTaxAfterSbd },
    { line: 600, description: 'Provincial tax', amount: provincialTax },
    { line: 700, description: 'Additional refundable tax on investment income', amount: s7.additionalRefundableTax },
    { line: 770, description: 'Total tax payable', amount: totalTax },
    { line: 800, description: 'Instalments paid', amount: input.installmentsPaid },
    { line: 890, description: 'Balance due / (refund)', amount: balanceDue },
  ]

  return {
    schedule1: s1,
    schedule7: s7,
    taxableIncome,
    federalTaxBeforeCredits,
    sbd: s7.sbdAmount,
    federalTaxAfterSbd,
    provincialTax,
    totalTax,
    rdtoh,
    balanceDue,
    monthlyInstallment,
    effectiveRate,
    lines,
  }
}

// ── Quick estimate (simplified T2) ──────────────────────────────────────────

/**
 * Quick T2 tax estimate for advisory purposes.
 * Simplified version that doesn't require full schedule inputs.
 */
export function quickT2Estimate(params: {
  netIncome: number
  province: Province
  isCcpc: boolean
  investmentIncome?: number
}): {
  taxableIncome: number
  federalTax: number
  provincialTax: number
  totalTax: number
  effectiveRate: number
  sbdBenefit: number
} {
  const { netIncome, province, isCcpc, investmentIncome = 0 } = params
  const taxableIncome = Math.max(0, netIncome)

  if (!isCcpc || taxableIncome === 0) {
    const provRate = PROVINCIAL_RATES[province]?.generalRate ?? 0.115
    const federalTax = taxableIncome * FEDERAL_GENERAL_RATE
    const provincialTax = taxableIncome * provRate
    return {
      taxableIncome,
      federalTax,
      provincialTax,
      totalTax: federalTax + provincialTax,
      effectiveRate: taxableIncome > 0 ? (federalTax + provincialTax) / taxableIncome : 0,
      sbdBenefit: 0,
    }
  }

  // Check AAII clawback
  const aaii = investmentIncome
  const aaiiClawback = aaii > 50_000 ? Math.min(SBD_BUSINESS_LIMIT, 5 * (aaii - 50_000)) : 0
  const effectiveSbdLimit = Math.max(0, SBD_BUSINESS_LIMIT - aaiiClawback)

  const activeBusinessIncome = Math.max(0, taxableIncome - investmentIncome)
  const sbdEligible = Math.min(activeBusinessIncome, effectiveSbdLimit)
  const generalIncome = taxableIncome - sbdEligible

  const federalSbd = sbdEligible * FEDERAL_SMALL_BUSINESS_RATE
  const federalGeneral = generalIncome * FEDERAL_GENERAL_RATE
  const federalTax = federalSbd + federalGeneral

  const provRates = PROVINCIAL_RATES[province]
  const provSbdRate = provRates?.smallBusinessRate ?? provRates?.generalRate ?? 0
  const provGeneralRate = provRates?.generalRate ?? 0.115
  const provincialTax = sbdEligible * provSbdRate + generalIncome * provGeneralRate

  const totalTax = federalTax + provincialTax
  const sbdBenefit = sbdEligible * (FEDERAL_GENERAL_RATE - FEDERAL_SMALL_BUSINESS_RATE)

  return {
    taxableIncome,
    federalTax,
    provincialTax,
    totalTax,
    effectiveRate: totalTax / taxableIncome,
    sbdBenefit,
  }
}
