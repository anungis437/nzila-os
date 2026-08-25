/**
 * @nzila/tax — Personal income tax brackets (T1)
 *
 * Federal and provincial marginal tax brackets for individuals.
 * Used for owner-manager tax planning (salary vs. dividend optimization).
 *
 * Sources:
 * - Federal brackets: ITA s.117(2), CRA T1 General Guide
 * - Provincial brackets: Provincial income tax acts, CRA Schedule 428
 * - Basic Personal Amount: ITA s.118(1), indexed annually
 *
 * Updated for 2026 tax year.
 */
import type { Province } from './types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TaxBracket {
  /** Lower bound of the bracket (inclusive) */
  from: number
  /** Upper bound (exclusive), null for top bracket */
  to: number | null
  /** Marginal rate (decimal, e.g. 0.205 = 20.5%) */
  rate: number
}

export interface PersonalTaxSchedule {
  jurisdiction: 'federal' | Province
  taxYear: number
  brackets: TaxBracket[]
  /** Basic Personal Amount (non-refundable credit base) */
  basicPersonalAmount: number
}

export interface PersonalTaxEstimate {
  province: Province
  taxableIncome: number
  federalTax: number
  provincialTax: number
  combinedTax: number
  effectiveRate: number
  marginalRate: number
}

// ── Federal brackets (2026) ─────────────────────────────────────────────────

/**
 * Federal T1 brackets for 2026 (ITA s.117(2)).
 * Source: CRA current-year tax rates and income brackets.
 */
export const FEDERAL_BRACKETS_2026: TaxBracket[] = [
  { from: 0,       to: 58_523,  rate: 0.14 },
  { from: 58_523,  to: 117_045, rate: 0.205 },
  { from: 117_045, to: 181_440, rate: 0.26 },
  { from: 181_440, to: 258_482, rate: 0.29 },
  { from: 258_482, to: null,    rate: 0.33 },
]

/** Federal Basic Personal Amount for 2026 */
export const FEDERAL_BPA_2026 = 16_452

/** @deprecated Use FEDERAL_BRACKETS_2026 */
export const FEDERAL_BRACKETS_2025 = FEDERAL_BRACKETS_2026
/** @deprecated Use FEDERAL_BPA_2026 */
export const FEDERAL_BPA_2025 = FEDERAL_BPA_2026

// ── Provincial brackets (2026) ──────────────────────────────────────────────

/**
 * Provincial personal income tax brackets for 2026.
 * Source: Provincial finance ministry publications, CRA Schedule 428.
 */
export const PROVINCIAL_PERSONAL_BRACKETS: Record<Province, { brackets: TaxBracket[]; bpa: number }> = {
  ON: {
    brackets: [
      { from: 0,       to: 53_891,  rate: 0.0505 },
      { from: 53_891,  to: 107_785, rate: 0.0915 },
      { from: 107_785, to: 150_000, rate: 0.1116 },
      { from: 150_000, to: 220_000, rate: 0.1216 },
      { from: 220_000, to: null,    rate: 0.1316 },
    ],
    bpa: 12_989,
  },
  QC: {
    brackets: [
      { from: 0,       to: 54_345,  rate: 0.14 },
      { from: 54_345,  to: 108_680, rate: 0.19 },
      { from: 108_680, to: 132_245, rate: 0.24 },
      { from: 132_245, to: null,    rate: 0.2575 },
    ],
    bpa: 18_952,
  },
  BC: {
    brackets: [
      { from: 0,       to: 50_363,  rate: 0.056 },
      { from: 50_363,  to: 100_728, rate: 0.077 },
      { from: 100_728, to: 115_648, rate: 0.105 },
      { from: 115_648, to: 140_430, rate: 0.1229 },
      { from: 140_430, to: 190_405, rate: 0.147 },
      { from: 190_405, to: 265_545, rate: 0.168 },
      { from: 265_545, to: null,    rate: 0.205 },
    ],
    bpa: 13_216,
  },
  AB: {
    brackets: [
      { from: 0,       to: 61_200,  rate: 0.08 },
      { from: 61_200,  to: 154_259, rate: 0.10 },
      { from: 154_259, to: 185_111, rate: 0.12 },
      { from: 185_111, to: 246_813, rate: 0.13 },
      { from: 246_813, to: 370_220, rate: 0.14 },
      { from: 370_220, to: null,    rate: 0.15 },
    ],
    bpa: 22_769,
  },
  SK: {
    brackets: [
      { from: 0,       to: 54_532,  rate: 0.105 },
      { from: 54_532,  to: 155_805, rate: 0.125 },
      { from: 155_805, to: null,    rate: 0.145 },
    ],
    bpa: 20_381,
  },
  MB: {
    brackets: [
      { from: 0,       to: 47_564,  rate: 0.108 },
      { from: 47_564,  to: 101_200, rate: 0.1275 },
      { from: 101_200, to: null,    rate: 0.174 },
    ],
    bpa: 15_780,
  },
  NB: {
    brackets: [
      { from: 0,       to: 52_333,  rate: 0.094 },
      { from: 52_333,  to: 104_666, rate: 0.14 },
      { from: 104_666, to: 193_861, rate: 0.16 },
      { from: 193_861, to: null,    rate: 0.195 },
    ],
    bpa: 13_664,
  },
  NS: {
    brackets: [
      { from: 0,       to: 30_995,  rate: 0.0879 },
      { from: 30_995,  to: 61_991,  rate: 0.1495 },
      { from: 61_991,  to: 97_417,  rate: 0.1667 },
      { from: 97_417,  to: 157_124, rate: 0.175 },
      { from: 157_124, to: null,    rate: 0.21 },
    ],
    bpa: 11_932,
  },
  PE: {
    brackets: [
      { from: 0,       to: 33_928,  rate: 0.095 },
      { from: 33_928,  to: 65_820,  rate: 0.1347 },
      { from: 65_820,  to: 106_890, rate: 0.166 },
      { from: 106_890, to: 142_520, rate: 0.1762 },
      { from: 142_520, to: 200_000, rate: 0.19 },
      { from: 200_000, to: null,    rate: 0.20 },
    ],
    bpa: 15_000,
  },
  NL: {
    brackets: [
      { from: 0,       to: 44_678,  rate: 0.087 },
      { from: 44_678,  to: 89_354,  rate: 0.145 },
      { from: 89_354,  to: 159_528, rate: 0.158 },
      { from: 159_528, to: 223_340, rate: 0.178 },
      { from: 223_340, to: 285_319, rate: 0.198 },
      { from: 285_319, to: 570_638, rate: 0.208 },
      { from: 570_638, to: 1_141_275, rate: 0.213 },
      { from: 1_141_275, to: null,  rate: 0.218 },
    ],
    bpa: 11_188,
  },
  YT: {
    brackets: [
      { from: 0,       to: 58_523,  rate: 0.064 },
      { from: 58_523,  to: 117_045, rate: 0.09 },
      { from: 117_045, to: 181_440, rate: 0.109 },
      { from: 181_440, to: 500_000, rate: 0.128 },
      { from: 500_000, to: null,    rate: 0.15 },
    ],
    bpa: 16_452,
  },
  NT: {
    brackets: [
      { from: 0,       to: 53_003,  rate: 0.059 },
      { from: 53_003,  to: 106_009, rate: 0.086 },
      { from: 106_009, to: 172_346, rate: 0.122 },
      { from: 172_346, to: null,    rate: 0.1405 },
    ],
    bpa: 18_198,
  },
  NU: {
    brackets: [
      { from: 0,       to: 55_801,  rate: 0.04 },
      { from: 55_801,  to: 111_602, rate: 0.07 },
      { from: 111_602, to: 181_439, rate: 0.09 },
      { from: 181_439, to: null,    rate: 0.115 },
    ],
    bpa: 19_659,
  },
}

// ── Calculation helpers ─────────────────────────────────────────────────────

/**
 * Calculate tax payable on taxable income using a set of brackets.
 */
export function calculateBracketTax(taxableIncome: number, brackets: TaxBracket[]): number {
  let tax = 0
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.from) break
    const upper = bracket.to ?? Infinity
    const taxableInBracket = Math.min(taxableIncome, upper) - bracket.from
    tax += taxableInBracket * bracket.rate
  }
  return Math.round(tax * 100) / 100
}

/**
 * Get the marginal rate for a given income level.
 */
export function getMarginalRate(taxableIncome: number, brackets: TaxBracket[]): number {
  let rate = brackets[0].rate
  for (const bracket of brackets) {
    if (taxableIncome > bracket.from) {
      rate = bracket.rate
    }
  }
  return rate
}

/**
 * Get the federal personal tax schedule for 2026.
 */
export function getFederalPersonalSchedule(): PersonalTaxSchedule {
  return {
    jurisdiction: 'federal',
    taxYear: 2026,
    brackets: FEDERAL_BRACKETS_2026,
    basicPersonalAmount: FEDERAL_BPA_2026,
  }
}

/**
 * Get the provincial personal tax schedule for 2026.
 */
export function getProvincialPersonalSchedule(province: Province): PersonalTaxSchedule {
  const prov = PROVINCIAL_PERSONAL_BRACKETS[province]
  return {
    jurisdiction: province,
    taxYear: 2026,
    brackets: prov.brackets,
    basicPersonalAmount: prov.bpa,
  }
}

/**
 * Estimate combined federal + provincial personal income tax.
 * Applies basic personal amount as a non-refundable credit (15% federal, lowest provincial rate).
 */
export function estimatePersonalTax(province: Province, taxableIncome: number): PersonalTaxEstimate {
  const fedBrackets = FEDERAL_BRACKETS_2026
  const provData = PROVINCIAL_PERSONAL_BRACKETS[province]

  // Federal tax minus BPA credit
  const rawFedTax = calculateBracketTax(taxableIncome, fedBrackets)
  const fedBpaCredit = FEDERAL_BPA_2026 * fedBrackets[0].rate
  const federalTax = Math.max(0, Math.round((rawFedTax - fedBpaCredit) * 100) / 100)

  // Provincial tax minus BPA credit
  const rawProvTax = calculateBracketTax(taxableIncome, provData.brackets)
  const provBpaCredit = provData.bpa * provData.brackets[0].rate
  const provincialTax = Math.max(0, Math.round((rawProvTax - provBpaCredit) * 100) / 100)

  const combinedTax = Math.round((federalTax + provincialTax) * 100) / 100
  const effectiveRate = taxableIncome > 0 ? Math.round((combinedTax / taxableIncome) * 10000) / 10000 : 0

  const fedMarginal = getMarginalRate(taxableIncome, fedBrackets)
  const provMarginal = getMarginalRate(taxableIncome, provData.brackets)
  const marginalRate = Math.round((fedMarginal + provMarginal) * 10000) / 10000

  return {
    province,
    taxableIncome,
    federalTax,
    provincialTax,
    combinedTax,
    effectiveRate,
    marginalRate,
  }
}

/**
 * Get combined federal + provincial marginal rate for a given income.
 * Useful for salary vs. dividend analysis.
 */
export function getCombinedMarginalRate(province: Province, taxableIncome: number): number {
  const fedMarginal = getMarginalRate(taxableIncome, FEDERAL_BRACKETS_2026)
  const provMarginal = getMarginalRate(taxableIncome, PROVINCIAL_PERSONAL_BRACKETS[province].brackets)
  return Math.round((fedMarginal + provMarginal) * 10000) / 10000
}
