/**
 * @nzila/tax — Canadian corporate tax rates & thresholds
 *
 * All data sourced from publicly available CRA publications:
 * - Federal rates: CRA T2 Corporation Income Tax Guide (T4012)
 * - Provincial rates: CRA Schedule 510, provincial finance ministry publications
 * - SBD limit: Income Tax Act s.125(2)
 * - CCPC passive income grind: Budget 2018, ITA s.125(5.1)
 *
 * Current reference snapshots, not a historical or prorated fiscal-year calculator.
 * Provincial transitions retain their distinct applicability conditions below.
 * Values are expressed as decimals (e.g. 0.15 = 15%).
 */
import type { Province } from './types'

// ── Federal corporate rates ─────────────────────────────────────────────────

/** Federal general corporate tax rate (ITA s.123) */
export const FEDERAL_GENERAL_RATE = 0.15

/** Federal small business rate after SBD (ITA s.125) */
export const FEDERAL_SMALL_BUSINESS_RATE = 0.09

/** M&P deduction percentage (ITA ss.125.1/123.4), not the resulting 15% net tax rate. */
export const FEDERAL_MP_RATE = 0.13

// ── Small Business Deduction thresholds ─────────────────────────────────────

/** Annual business limit for SBD (ITA s.125(2)) — $500,000 */
export const SBD_BUSINESS_LIMIT = 500_000

/** Taxable capital threshold where SBD starts to grind (ITA s.125(5.1)) — $10M */
export const SBD_CAPITAL_GRIND_START = 10_000_000

/** Taxable capital where SBD is eliminated — $50M for tax years starting after 2022-04-06. */
export const SBD_CAPITAL_GRIND_END = 50_000_000

/** CCPC adjusted aggregate investment income (AAII) threshold — $50K (Budget 2018) */
export const AAII_GRIND_START = 50_000

/** AAII amount where SBD fully eliminated — $150K */
export const AAII_GRIND_END = 150_000

// ── Capital gains inclusion rate ────────────────────────────────────────────

/**
 * Capital gains inclusion rate — the fraction of a capital gain that is taxable.
 *
 * Budget 2024 proposed tiered inclusion:
 * - Individuals: 50% on first $250K of net gains, 66.67% above
 * - Corporations / trusts: 66.67% on all gains
 *
 * Budget 2025 confirmed that the government would not proceed with the increase.
 * The enacted standard rate remains 50% (ITA s.38(a)). The opt-in proposed
 * scenario below is a historical counterfactual, not current or pending law.
 *
 * Source: ITA s.38(a), Budget 2024 Notice of Ways and Means Motion
 */
export const CAPITAL_GAINS_INCLUSION_RATE = 0.50

/** Historical, canceled Budget 2024 proposal; not an enacted inclusion rate. */
export const CAPITAL_GAINS_HIGHER_INCLUSION_RATE = 2 / 3

/** Historical individual threshold in the canceled Budget 2024 proposal. */
export const CAPITAL_GAINS_INDIVIDUAL_THRESHOLD = 250_000

/**
 * Calculate the taxable capital gain.
 *
 * @param capitalGain  Total capital gain (or loss — use negative)
 * @param isIndividual Whether the taxpayer is an individual (vs corp/trust)
 * @param useProposedRates Whether to apply the Budget 2024 tiered rates (default: false; canceled historical proposal only)
 */
export function calculateTaxableCapitalGain(
  capitalGain: number,
  isIndividual = true,
  useProposedRates = false,
): { taxableAmount: number; inclusionRate: number; rule: string } {
  if (capitalGain <= 0) {
    return {
      taxableAmount: Math.round(capitalGain * CAPITAL_GAINS_INCLUSION_RATE * 100) / 100,
      inclusionRate: CAPITAL_GAINS_INCLUSION_RATE,
      rule: 'ITA s.38(a): 50% inclusion rate',
    }
  }

  if (!useProposedRates || !isIndividual) {
    // Current rules: 50% flat (or 66.67% if using proposed rates for corps)
    const rate = useProposedRates && !isIndividual ? CAPITAL_GAINS_HIGHER_INCLUSION_RATE : CAPITAL_GAINS_INCLUSION_RATE
    return {
      taxableAmount: Math.round(capitalGain * rate * 100) / 100,
      inclusionRate: rate,
      rule: useProposedRates && !isIndividual
        ? 'ITA s.38(a) (proposed): 66.67% inclusion for corporations/trusts'
        : 'ITA s.38(a): 50% inclusion rate',
    }
  }

  // Proposed tiered: 50% on first $250K, 66.67% above
  const lowerPortion = Math.min(capitalGain, CAPITAL_GAINS_INDIVIDUAL_THRESHOLD)
  const upperPortion = Math.max(0, capitalGain - CAPITAL_GAINS_INDIVIDUAL_THRESHOLD)

  const taxable = lowerPortion * CAPITAL_GAINS_INCLUSION_RATE + upperPortion * CAPITAL_GAINS_HIGHER_INCLUSION_RATE
  const effectiveRate = taxable / capitalGain

  return {
    taxableAmount: Math.round(taxable * 100) / 100,
    inclusionRate: Math.round(effectiveRate * 10000) / 10000,
    rule: `ITA s.38(a) (proposed): 50% on first $250K + 66.67% above — effective ${(effectiveRate * 100).toFixed(1)}%`,
  }
}

// ── Provincial / territorial corporate tax rates ────────────────────────────

export interface ProvincialTaxRate {
  province: Province
  generalRate: number
  smallBusinessRate: number
  /** Province-specific SBD limit if different from federal ($500K default) */
  sbdLimit: number
  /** Manufacturing & processing rate if different from general */
  mpRate?: number
  /** Effective date of this current reference snapshot, not a whole-year rate. */
  effectiveFrom: string
  /** Transition condition; callers must assess the relevant income/fiscal period. */
  smallBusinessRateCondition?: string
}

/**
 * Provincial/territorial corporate income tax rates.
 * Source: CRA Schedule 510, provincial budget publications.
 * Current reference values. These do not apply uniformly to every 2026 fiscal year.
 * CRA requires day weighting for midyear rate changes; Quebec instead bases its
 * 2026 SBD change on the taxation-year start. Neither rule is calculated here.
 * Source: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-tax-rates.html
 */
export const PROVINCIAL_RATES: Record<Province, ProvincialTaxRate> = {
  ON: { province: 'ON', generalRate: 0.115, smallBusinessRate: 0.022, sbdLimit: 500_000, mpRate: 0.10, effectiveFrom: '2026-07-01', smallBusinessRateCondition: '2.2% from 2026-07-01; 3.2% before that date. Prorate a taxation year spanning the change.' },
  QC: { province: 'QC', generalRate: 0.115, smallBusinessRate: 0.022, sbdLimit: 500_000, effectiveFrom: '2026-04-30', smallBusinessRateCondition: '2.2% only for taxation years beginning after 2026-04-29; 3.2% for earlier starts. Quebec SBD eligibility conditions still apply.' },
  BC: { province: 'BC', generalRate: 0.12, smallBusinessRate: 0.02, sbdLimit: 500_000, effectiveFrom: '2018-01-01' },
  AB: { province: 'AB', generalRate: 0.08, smallBusinessRate: 0.02, sbdLimit: 500_000, effectiveFrom: '2020-07-01' },
  SK: { province: 'SK', generalRate: 0.12, smallBusinessRate: 0.01, sbdLimit: 600_000, effectiveFrom: '2023-07-01' },
  MB: { province: 'MB', generalRate: 0.12, smallBusinessRate: 0.00, sbdLimit: 500_000, effectiveFrom: '2019-01-01' },
  NB: { province: 'NB', generalRate: 0.14, smallBusinessRate: 0.025, sbdLimit: 500_000, effectiveFrom: '2021-04-01' },
  NS: { province: 'NS', generalRate: 0.14, smallBusinessRate: 0.015, sbdLimit: 700_000, effectiveFrom: '2025-04-01' },
  PE: { province: 'PE', generalRate: 0.15, smallBusinessRate: 0.01, sbdLimit: 600_000, effectiveFrom: '2025-07-01' },
  NL: { province: 'NL', generalRate: 0.15, smallBusinessRate: 0.02, sbdLimit: 500_000, effectiveFrom: '2026-01-01', smallBusinessRateCondition: '2% from 2026-01-01; 2.5% before that date. Prorate a taxation year spanning the change.' },
  YT: { province: 'YT', generalRate: 0.12, smallBusinessRate: 0.00, sbdLimit: 500_000, effectiveFrom: '2021-01-01' },
  NT: { province: 'NT', generalRate: 0.115, smallBusinessRate: 0.02, sbdLimit: 500_000, effectiveFrom: '2021-01-01' },
  NU: { province: 'NU', generalRate: 0.12, smallBusinessRate: 0.03, sbdLimit: 500_000, effectiveFrom: '2021-01-01' },
}

// ── Combined rate helpers ───────────────────────────────────────────────────

export interface CorporateTaxEstimate {
  province: Province
  federalGeneralRate: number
  federalSmallBusinessRate: number
  provincialGeneralRate: number
  provincialSmallBusinessRate: number
  combinedGeneralRate: number
  combinedSmallBusinessRate: number
  sbdLimit: number
}

/**
 * Get the current combined federal + provincial rate snapshot.
 * This helper has no fiscal-period input: it does not choose historical rates,
 * prorate transition years, or establish provincial SBD eligibility.
 */
export function getCombinedCorporateRates(province: Province): CorporateTaxEstimate {
  const prov = PROVINCIAL_RATES[province]
  return {
    province,
    federalGeneralRate: FEDERAL_GENERAL_RATE,
    federalSmallBusinessRate: FEDERAL_SMALL_BUSINESS_RATE,
    provincialGeneralRate: prov.generalRate,
    provincialSmallBusinessRate: prov.smallBusinessRate,
    combinedGeneralRate: FEDERAL_GENERAL_RATE + prov.generalRate,
    combinedSmallBusinessRate: FEDERAL_SMALL_BUSINESS_RATE + prov.smallBusinessRate,
    sbdLimit: Math.min(SBD_BUSINESS_LIMIT, prov.sbdLimit),
  }
}

/**
 * Calculate SBD clawback based on taxable capital.
 * ITA s.125(5.1): SBD grinds linearly from $10M to $50M taxable capital
 * for taxation years starting on or after 2022-04-07.
 * Returns the reduced business limit (0–$500K).
 */
export function calculateSbdBusinessLimit(taxableCapital: number): number {
  if (taxableCapital <= SBD_CAPITAL_GRIND_START) return SBD_BUSINESS_LIMIT
  if (taxableCapital >= SBD_CAPITAL_GRIND_END) return 0
  const reduction = ((taxableCapital - SBD_CAPITAL_GRIND_START) / (SBD_CAPITAL_GRIND_END - SBD_CAPITAL_GRIND_START)) * SBD_BUSINESS_LIMIT
  return Math.round(SBD_BUSINESS_LIMIT - reduction)
}

/**
 * Calculate SBD clawback based on passive investment income (AAII).
 * Budget 2018: $5 reduction for every $1 of AAII above $50K.
 * Returns the reduced business limit (0–$500K).
 */
export function calculateAaiiBusinessLimit(adjustedAggregateInvestmentIncome: number): number {
  if (adjustedAggregateInvestmentIncome <= AAII_GRIND_START) return SBD_BUSINESS_LIMIT
  if (adjustedAggregateInvestmentIncome >= AAII_GRIND_END) return 0
  const reduction = (adjustedAggregateInvestmentIncome - AAII_GRIND_START) * 5
  return Math.max(0, SBD_BUSINESS_LIMIT - reduction)
}

/**
 * Quick estimate: corporate tax on active business income.
 * Applies the current SBD snapshot up to a combined business limit.
 * Not a fiscal-year tax calculation: no transition proration or provincial SBD
 * eligibility assessment, and provincial limits/passive-income rules can differ.
 * Returns federal + provincial combined estimated tax for that limited scenario.
 */
export function estimateCorporateTax(
  province: Province,
  activeBusinessIncome: number,
  options?: {
    taxableCapital?: number
    aaii?: number
    isCcpc?: boolean
  },
): { estimatedTax: number; effectiveRate: number; breakdown: { sbd: number; general: number } } {
  const rates = getCombinedCorporateRates(province)
  const isCcpc = options?.isCcpc ?? true

  let businessLimit = rates.sbdLimit
  if (isCcpc && options?.taxableCapital != null) {
    businessLimit = Math.min(businessLimit, calculateSbdBusinessLimit(options.taxableCapital))
  }
  if (isCcpc && options?.aaii != null) {
    businessLimit = Math.min(businessLimit, calculateAaiiBusinessLimit(options.aaii))
  }
  if (!isCcpc) businessLimit = 0

  const sbdIncome = Math.min(activeBusinessIncome, businessLimit)
  const generalIncome = Math.max(0, activeBusinessIncome - sbdIncome)

  const sbdTax = sbdIncome * rates.combinedSmallBusinessRate
  const generalTax = generalIncome * rates.combinedGeneralRate

  const totalTax = sbdTax + generalTax
  const effectiveRate = activeBusinessIncome > 0 ? totalTax / activeBusinessIncome : 0

  return {
    estimatedTax: Math.round(totalTax * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 10000) / 10000,
    breakdown: {
      sbd: Math.round(sbdTax * 100) / 100,
      general: Math.round(generalTax * 100) / 100,
    },
  }
}
