/**
 * @nzila/tax — Dividend tax integration (RDTOH / GRIP / LRIP)
 *
 * Calculates the tax cost of distributing eligible and non-eligible
 * dividends from a CCPC to its shareholder(s).
 *
 * Sources:
 * - ITA s.82(1): Dividend gross-up rates
 * - ITA s.121: Dividend tax credit (federal)
 * - ITA s.129: Refundable Dividend Tax On Hand (RDTOH)
 * - CRA T2 Corporation Income Tax Guide (T4012): RDTOH, GRIP, LRIP
 * - Provincial dividend tax credits: Provincial tax acts
 *
 * Simplified estimates are not tax assessments. Full reference verification remains
 * incomplete; see data-versions.ts for the independently controlled verification date.
 */
import type { Province } from './types'
import { CPP_2026 } from './payroll-thresholds'

// ── Dividend gross-up & DTC rates ───────────────────────────────────────────

/**
 * Eligible dividends: paid from income taxed at the general corporate rate.
 * Tracked via GRIP (General Rate Income Pool).
 */
export const ELIGIBLE_DIVIDEND = {
  /** Gross-up factor (ITA s.82(1)(b)) — 38% */
  grossUpRate: 0.38,
  /** Federal DTC rate (ITA s.121) — 15.0198% of grossed-up amount */
  federalDtcRate: 0.150198,
  /** CRA guide reference */
  rule: 'ITA s.82(1)(b), s.121 — Eligible dividend gross-up & DTC',
} as const

/**
 * Non-eligible (ordinary) dividends: paid from income taxed at small business rate.
 * Tracked via LRIP (Low Rate Income Pool) for CCPC.
 */
export const NON_ELIGIBLE_DIVIDEND = {
  /** Gross-up factor (ITA s.82(1)(b)) — 15% */
  grossUpRate: 0.15,
  /** Federal DTC rate (ITA s.121) — 9.0301% of grossed-up amount */
  federalDtcRate: 0.090301,
  /** CRA guide reference */
  rule: 'ITA s.82(1)(b), s.121 — Non-eligible dividend gross-up & DTC',
} as const

// ── Provincial DTC rates ────────────────────────────────────────────────────

export interface ProvincialDividendCredit {
  eligibleDtcRate: number
  nonEligibleDtcRate: number
}

/**
 * Provincial dividend tax credit rates (% of grossed-up amount).
 * Source: Provincial income tax acts / CRA Schedule 428.
 * PE/SK retain the enacted gross-up fractions to avoid premature rate rounding.
 * Saskatchewan: s.32(h), extended by Saskatchewan Affordability Act s.13;
 * the scheduled 2026 increase in the earlier 2024 amendment was repealed.
 * https://docs.legassembly.sk.ca/legdocs/Bills/30L1S/Bill30-1.pdf
 */
export const PROVINCIAL_DTC: Record<Province, ProvincialDividendCredit> = {
  ON: { eligibleDtcRate: 0.10,    nonEligibleDtcRate: 0.029863 },
  QC: { eligibleDtcRate: 0.117,  nonEligibleDtcRate: 0.0342 },
  BC: { eligibleDtcRate: 0.12,    nonEligibleDtcRate: 0.0196 },
  AB: { eligibleDtcRate: 0.0812,  nonEligibleDtcRate: 0.0218 },
  SK: { eligibleDtcRate: 0.3995 * 0.38 / 1.38, nonEligibleDtcRate: 0.19312 * 0.15 / 1.15 },
  MB: { eligibleDtcRate: 0.08,    nonEligibleDtcRate: 0.007835 },
  NB: { eligibleDtcRate: 0.14,    nonEligibleDtcRate: 0.0275 },
  NS: { eligibleDtcRate: 0.0885,  nonEligibleDtcRate: 0.015 },
  PE: { eligibleDtcRate: 0.3813 * 0.38 / 1.38, nonEligibleDtcRate: 0.10 * 0.15 / 1.15 },
  NL: { eligibleDtcRate: 0.063,   nonEligibleDtcRate: 0.032 },
  YT: { eligibleDtcRate: 0.1202,  nonEligibleDtcRate: 0.0067 },
  NT: { eligibleDtcRate: 0.115,   nonEligibleDtcRate: 0.06 },
  NU: { eligibleDtcRate: 0.0551,  nonEligibleDtcRate: 0.0261 },
}

// ── RDTOH ───────────────────────────────────────────────────────────────────

/** RDTOH refund ceiling rate: 38⅓%; actual refund is capped by the applicable
 * ERDTOH/NERDTOH balances. This simplified estimator has no balance inputs. */
export const RDTOH_REFUND_RATE = 23 / 60

/**
 * Part IV tax rate on portfolio dividends received by a private corp (ITA s.186(1)).
 * 38-1/3% of eligible dividends received.
 */
export const PART_IV_TAX_RATE = 23 / 60

// ── Types ───────────────────────────────────────────────────────────────────

export interface DividendTaxResult {
  /** Actual cash dividend paid */
  cashDividend: number
  /** Type of dividend */
  type: 'eligible' | 'non-eligible'
  /** Grossed-up (taxable) amount */
  grossedUpAmount: number
  /** Federal DTC */
  federalCredit: number
  /** Provincial DTC */
  provincialCredit: number
  /** Total DTC */
  totalCredit: number
  /** Net tax on dividend (after credits) at top marginal rate */
  netTaxAtTopRate: number
  /** Effective personal tax rate on the cash dividend */
  effectiveDividendRate: number
  /** Potential RDTOH ceiling only; not an actual refund without sufficient applicable pools. */
  rdtohRefund: number
  /** Simplified personal tax less potential refund ceiling, not an assessed integration cost. */
  integrationCost: number
}

// ── Calculators ─────────────────────────────────────────────────────────────

/**
 * Calculate the personal tax on a dividend at a given marginal rate.
 * This is the core integration analysis: how much does a dollar of
 * corporate income cost when flowed through as a dividend?
 */
export function calculateDividendTax(
  cashDividend: number,
  type: 'eligible' | 'non-eligible',
  province: Province,
  personalMarginalRate: number,
): DividendTaxResult {
  const div = type === 'eligible' ? ELIGIBLE_DIVIDEND : NON_ELIGIBLE_DIVIDEND
  const provDtc = PROVINCIAL_DTC[province]

  // Step 1: Gross-up
  const grossedUpAmount = Math.round(cashDividend * (1 + div.grossUpRate) * 100) / 100

  // Step 2: Tax at marginal rate on the grossed-up amount
  const taxOnGrossedUp = grossedUpAmount * personalMarginalRate

  // Step 3: Credits
  const federalCredit = Math.round(grossedUpAmount * div.federalDtcRate * 100) / 100
  const provDtcRate = type === 'eligible' ? provDtc.eligibleDtcRate : provDtc.nonEligibleDtcRate
  const provincialCredit = Math.round(grossedUpAmount * provDtcRate * 100) / 100
  const totalCredit = Math.round((federalCredit + provincialCredit) * 100) / 100

  // Step 4: Net tax
  const netTax = Math.max(0, Math.round((taxOnGrossedUp - totalCredit) * 100) / 100)
  const effectiveRate = cashDividend > 0 ? Math.round((netTax / cashDividend) * 10000) / 10000 : 0

  // Step 5: Potential RDTOH ceiling only. Actual pool eligibility/balances are not established.
  const rdtohRefund = Math.round(cashDividend * RDTOH_REFUND_RATE * 100) / 100

  // Step 6: Integration cost = personal tax - RDTOH refund (simplified)
  const integrationCost = Math.round((netTax - rdtohRefund) * 100) / 100

  return {
    cashDividend,
    type,
    grossedUpAmount,
    federalCredit,
    provincialCredit,
    totalCredit,
    netTaxAtTopRate: netTax,
    effectiveDividendRate: effectiveRate,
    rdtohRefund,
    integrationCost,
  }
}

/**
 * Compare salary vs. dividend for a given amount of corporate pre-tax income.
 * Simplified model: shows the after-tax cash to the owner-manager under each strategy.
 *
 * This is the key analysis for VCFO advisory.
 */
export function compareSalaryVsDividend(
  corporatePreTaxIncome: number,
  province: Province,
  personalMarginalRate: number,
  corporateTaxRate: number,
): {
  /** employerCpp is a 2026 CPP1 illustration only (not CPP2 or Quebec QPP). */
  salary: { gross: number; personalTax: number; afterTax: number; employerCpp: number }
  eligibleDividend: { corpTax: number; cashDividend: number; personalTax: number; afterTax: number; rdtohRefund: number }
  nonEligibleDividend: { corpTax: number; cashDividend: number; personalTax: number; afterTax: number; rdtohRefund: number }
} {
  // ── Salary path ──
  // 2026 CPP base + first additional only. CPP2 is not included here; this
  // legacy scalar is not a full payroll cost, and Quebec requires QPP instead.
  // Reuse the existing year-specific table rather than duplicating 2025 YMPE.
  const cppEmployer = Math.max(0, Math.min(
    (Math.min(corporatePreTaxIncome, CPP_2026.ympe) - CPP_2026.basicExemption) * CPP_2026.rate,
    CPP_2026.maxContribution,
  ))
  const grossSalary = corporatePreTaxIncome // corp deducts full amount
  const personalTaxOnSalary = Math.round(grossSalary * personalMarginalRate * 100) / 100
  const afterTaxSalary = Math.round((grossSalary - personalTaxOnSalary) * 100) / 100

  // ── Eligible dividend path ──
  const corpTax = Math.round(corporatePreTaxIncome * corporateTaxRate * 100) / 100
  const cashDividend = Math.round((corporatePreTaxIncome - corpTax) * 100) / 100
  const eligResult = calculateDividendTax(cashDividend, 'eligible', province, personalMarginalRate)

  // ── Non-eligible dividend path ──
  const nonEligResult = calculateDividendTax(cashDividend, 'non-eligible', province, personalMarginalRate)

  return {
    salary: {
      gross: grossSalary,
      personalTax: personalTaxOnSalary,
      afterTax: afterTaxSalary,
      employerCpp: Math.round(cppEmployer * 100) / 100,
    },
    eligibleDividend: {
      corpTax,
      cashDividend,
      personalTax: eligResult.netTaxAtTopRate,
      afterTax: Math.round((cashDividend - eligResult.netTaxAtTopRate) * 100) / 100,
      rdtohRefund: eligResult.rdtohRefund,
    },
    nonEligibleDividend: {
      corpTax,
      cashDividend,
      personalTax: nonEligResult.netTaxAtTopRate,
      afterTax: Math.round((cashDividend - nonEligResult.netTaxAtTopRate) * 100) / 100,
      rdtohRefund: nonEligResult.rdtohRefund,
    },
  }
}
