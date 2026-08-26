/**
 * @nzila/tax — Canadian corporate tax rates & thresholds
 *
 * All data sourced from publicly available CRA publications:
 * - Federal rates: CRA T2 Corporation Income Tax Guide (T4012)
 * - Provincial rates: CRA Schedule 510, provincial finance ministry publications
 * - SBD limit: Income Tax Act s.125(2)
 * - CCPC passive income grind: Budget 2018, ITA s.125(5.1)
 *
 * Updated for 2025-2026 tax years. Values are expressed as decimals (e.g. 0.15 = 15%).
 */
import type { Province } from './types'

// ── Federal corporate rates ─────────────────────────────────────────────────

/** Federal general corporate tax rate (ITA s.123) */
export const FEDERAL_GENERAL_RATE = 0.15

/** Federal small business rate after SBD (ITA s.125) */
export const FEDERAL_SMALL_BUSINESS_RATE = 0.09

/** Federal rate reduction — manufacturing & processing (ITA s.125.1) */
export const FEDERAL_MP_RATE = 0.13

// ── Small Business Deduction thresholds ─────────────────────────────────────

/** Annual business limit for SBD (ITA s.125(2)) — $500,000 */
export const SBD_BUSINESS_LIMIT = 500_000

/** Taxable capital threshold where SBD starts to grind (ITA s.125(5.1)) — $10M */
export const SBD_CAPITAL_GRIND_START = 10_000_000

/** Taxable capital where SBD fully eliminated — $15M */
export const SBD_CAPITAL_GRIND_END = 15_000_000

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
 * As of June 2025, the increase to 66.67% has been deferred.
 * Current rate remains 50% for all taxpayers pending further legislation.
 *
 * Source: ITA s.38(a), Budget 2024 Notice of Ways and Means Motion
 */
export const CAPITAL_GAINS_INCLUSION_RATE = 0.50

/** Proposed higher inclusion rate for gains above individual threshold */
export const CAPITAL_GAINS_HIGHER_INCLUSION_RATE = 2 / 3

/** Individual threshold before higher rate applies (Budget 2024 proposal, deferred) */
export const CAPITAL_GAINS_INDIVIDUAL_THRESHOLD = 250_000

/**
 * Calculate the taxable capital gain.
 *
 * @param capitalGain  Total capital gain (or loss — use negative)
 * @param isIndividual Whether the taxpayer is an individual (vs corp/trust)
 * @param useProposedRates Whether to apply the Budget 2024 tiered rates (default: false — deferred)
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
  /** Effective for tax years starting on or after */
  effectiveFrom: string
}

/**
 * Provincial/territorial corporate income tax rates.
 * Source: CRA Schedule 510, provincial budget publications.
 * Current as of 2026.
 */
export const PROVINCIAL_RATES: Record<Province, ProvincialTaxRate> = {
  ON: { province: 'ON', generalRate: 0.115, smallBusinessRate: 0.032, sbdLimit: 500_000, mpRate: 0.10, effectiveFrom: '2020-01-01' },
  QC: { province: 'QC', generalRate: 0.115, smallBusinessRate: 0.031, sbdLimit: 500_000, effectiveFrom: '2025-01-01' },
  BC: { province: 'BC', generalRate: 0.12, smallBusinessRate: 0.02, sbdLimit: 500_000, effectiveFrom: '2018-01-01' },
  AB: { province: 'AB', generalRate: 0.08, smallBusinessRate: 0.02, sbdLimit: 500_000, effectiveFrom: '2020-07-01' },
  SK: { province: 'SK', generalRate: 0.12, smallBusinessRate: 0.01, sbdLimit: 600_000, effectiveFrom: '2022-07-01' },
  MB: { province: 'MB', generalRate: 0.12, smallBusinessRate: 0.00, sbdLimit: 500_000, effectiveFrom: '2019-01-01' },
  NB: { province: 'NB', generalRate: 0.14, smallBusinessRate: 0.025, sbdLimit: 500_000, effectiveFrom: '2021-04-01' },
  NS: { province: 'NS', generalRate: 0.14, smallBusinessRate: 0.015, sbdLimit: 700_000, effectiveFrom: '2025-04-01' },
  PE: { province: 'PE', generalRate: 0.15, smallBusinessRate: 0.01, sbdLimit: 600_000, effectiveFrom: '2025-07-01' },
  NL: { province: 'NL', generalRate: 0.15, smallBusinessRate: 0.03, sbdLimit: 500_000, effectiveFrom: '2022-01-01' },
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
 * Get combined federal + provincial corporate tax rates for a province.
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
 * ITA s.125(5.1): SBD grinds linearly from $10M to $15M taxable capital.
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
 * Applies SBD up to the business limit, general rate above.
 * Returns federal + provincial combined estimated tax.
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
