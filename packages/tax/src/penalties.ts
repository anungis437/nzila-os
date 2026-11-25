/**
 * @nzila/tax — Late filing & late payment penalties
 *
 * Calculates CRA penalties under ITA s.162 and related provisions.
 *
 * Sources:
 * - ITA s.162(1): Late-filed T2 return penalty (5% + 1%/month, max 12 months)
 * - ITA s.162(2): Repeated late filing (10% + 2%/month, max 20 months)
 * - ITA s.162(7): Failure to file information returns (T4, T5, etc.)
 * - ITA s.163(1): Repeated failure to report income
 * - Excise Tax Act s.280.1: GST/HST late filing penalty
 * - CRA RC4022: General Information for GST/HST Registrants
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface LateFilingPenaltyInput {
  /** Amount of tax owing (balance unpaid at filing deadline) */
  taxOwing: number
  /** Number of complete months the return is late (0–12 or 0–20) */
  monthsLate: number
  /** A qualifying late-filing penalty was payable in one of the preceding 3 tax years. */
  isRepeatOffender?: boolean
  /** CRA sent a demand under ITA s.150(2); required for s.162(2). */
  hasFilingDemand?: boolean
  /** Explicitly late, including less than one complete month. When omitted,
   * legacy callers infer lateness only from a positive monthsLate value. */
  isLate?: boolean
}

export interface LateFilingPenaltyResult {
  /** Total penalty amount */
  penalty: number
  /** Penalty as a percentage of tax owing */
  effectiveRate: number
  /** CRA rule reference */
  rule: string
  /** Human-readable breakdown */
  breakdown: {
    basePenalty: number
    monthlyPenalty: number
    /** Number of months used in the calculation (capped at max) */
    monthsApplied: number
  }
}

export interface GstLatePenaltyInput {
  /** Net GST/HST owing for the reporting period */
  netTaxOwing: number
  /** Number of complete months the return is late */
  monthsLate: number
  /** @deprecated No generic repeat doubling applies to the s.280.1 formula. */
  isRepeatOffender?: boolean
  /** Explicitly late, including less than one complete month. */
  isLate?: boolean
}

export interface GstLatePenaltyResult {
  penalty: number
  interest: number
  total: number
  rule: string
}

export interface InformationReturnPenaltyInput {
  /** Type of return: T4, T5, T5013, NR4, T3, etc. */
  returnType: string
  /** Number of slips (information returns) filed late */
  numberOfSlips: number
  /** Number of days late */
  daysLate: number
}

export interface InformationReturnPenaltyResult {
  penalty: number
  rule: string
  /** Average penalty per slip for display; the legal penalty is per filing/tier. */
  perSlipPenalty: number
}

// ── Constants ───────────────────────────────────────────────────────────────

/** ITA s.162(1) — base penalty for late T2 filing: 5% of unpaid tax */
export const T2_LATE_BASE_RATE = 0.05

/** ITA s.162(1) — additional monthly penalty: 1% per month */
export const T2_LATE_MONTHLY_RATE = 0.01

/** Maximum months for first-time late filer (ITA s.162(1)) */
export const T2_LATE_MAX_MONTHS = 12

/** ITA s.162(2) — repeat offender base rate: 10% */
export const T2_REPEAT_BASE_RATE = 0.10

/** ITA s.162(2) — repeat offender monthly rate: 2% */
export const T2_REPEAT_MONTHLY_RATE = 0.02

/** Maximum months for repeat late filer (ITA s.162(2)) */
export const T2_REPEAT_MAX_MONTHS = 20

/** @deprecated General s.162(7) daily amount, not a per-slip multiplier. */
export const INFO_RETURN_PER_SLIP = 25

/** @deprecated General s.162(7) maximum, not a daily cap per slip. */
export const INFO_RETURN_DAILY_CAP = 2_500

/** Minimum penalty per information return filing (ITA s.162(7.01)) */
export const INFO_RETURN_MINIMUM = 100

/** Maximum penalty per information return filing (ITA s.162(7.01)) */
export const INFO_RETURN_MAXIMUM = 7_500

/** Excise Tax Act s.280.1 — GST/HST late filing: 1% + 0.25%/month (max 12 months) */
export const GST_LATE_BASE_RATE = 0.01

/** GST/HST monthly additional penalty rate */
export const GST_LATE_MONTHLY_RATE = 0.0025

/** GST/HST maximum months for penalty */
export const GST_LATE_MAX_MONTHS = 12

// ── Calculators ─────────────────────────────────────────────────────────────

/**
 * Calculate the ordinary resident-corporation T2 late-filing penalty.
 * Non-resident corporation minimum penalties and gross-negligence penalties
 * require additional facts and are outside this calculator.
 *
 * ITA s.162(1): 5% of unpaid tax + 1% per complete month late (max 12 months).
 * ITA s.162(2): If demanded and previously penalized within 3 years:
 *               10% + 2% per complete month late (max 20 months).
 */
export function calculateT2LateFilingPenalty(input: LateFilingPenaltyInput): LateFilingPenaltyResult {
  if (input.taxOwing <= 0 || !(input.isLate ?? input.monthsLate > 0)) {
    return {
      penalty: 0,
      effectiveRate: 0,
      rule: 'ITA s.162(1): No penalty — tax fully paid or return not late',
      breakdown: { basePenalty: 0, monthlyPenalty: 0, monthsApplied: 0 },
    }
  }

  const isRepeat = input.isRepeatOffender === true && input.hasFilingDemand === true
  const baseRate = isRepeat ? T2_REPEAT_BASE_RATE : T2_LATE_BASE_RATE
  const monthlyRate = isRepeat ? T2_REPEAT_MONTHLY_RATE : T2_LATE_MONTHLY_RATE
  const maxMonths = isRepeat ? T2_REPEAT_MAX_MONTHS : T2_LATE_MAX_MONTHS
  const monthsApplied = Math.max(0, Math.min(Math.floor(input.monthsLate), maxMonths))

  const basePenalty = Math.round(input.taxOwing * baseRate * 100) / 100
  const monthlyPenalty = Math.round(input.taxOwing * monthlyRate * monthsApplied * 100) / 100
  const penalty = Math.round((basePenalty + monthlyPenalty) * 100) / 100
  const effectiveRate = input.taxOwing > 0 ? Math.round((penalty / input.taxOwing) * 10000) / 10000 : 0

  const section = isRepeat ? 's.162(2)' : 's.162(1)'

  return {
    penalty,
    effectiveRate,
    rule: `ITA ${section}: ${(baseRate * 100).toFixed(0)}% base + ${(monthlyRate * 100).toFixed(0)}%/month × ${monthsApplied} months`,
    breakdown: { basePenalty, monthlyPenalty, monthsApplied },
  }
}

/**
 * Calculate the late filing penalty for GST/HST returns.
 *
 * Excise Tax Act s.280.1:
 * - 1% of balance owing
 * - plus 0.25% of balance owing for each complete month late (max 12 months)
 * - Total max: 4% of balance owing
 */
export function calculateGstLatePenalty(input: GstLatePenaltyInput): GstLatePenaltyResult {
  if (input.netTaxOwing <= 0 || !(input.isLate ?? input.monthsLate > 0)) {
    return {
      penalty: 0,
      interest: 0,
      total: 0,
      rule: 'ETA s.280.1: No penalty — tax paid or return not late',
    }
  }

  const monthsApplied = Math.max(0, Math.min(Math.floor(input.monthsLate), GST_LATE_MAX_MONTHS))
  const basePenalty = input.netTaxOwing * GST_LATE_BASE_RATE
  const monthlyPenalty = input.netTaxOwing * GST_LATE_MONTHLY_RATE * monthsApplied
  const penalty = Math.round((basePenalty + monthlyPenalty) * 100) / 100

  return {
    penalty,
    interest: 0, // Interest is separate — use calculateInstallmentInterest with prescribed rate
    total: penalty,
    rule: `ETA s.280.1: 1% + 0.25%/month × ${monthsApplied}`,
  }
}

/**
 * Calculate penalty for late-filed information returns (T4, T5, T5013, NR4, T3).
 *
 * CRA prescribed-return daily tiers and relieving policy apply by return type
 * and total slip count, never by multiplying a daily amount by every slip.
 * T5013 partnership returns instead use ITA s.162(7.1).
 * https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/file-information-returns-slip-summaries/when-to-file.html
 */
export function calculateInformationReturnPenalty(
  input: InformationReturnPenaltyInput,
): InformationReturnPenaltyResult {
  if (input.numberOfSlips <= 0 || input.daysLate <= 0) {
    return {
      penalty: 0,
      rule: 'ITA s.162(7): No penalty — filed on time or no slips',
      perSlipPenalty: 0,
    }
  }

  const type = input.returnType.trim().toUpperCase()
  const days = Math.min(Math.floor(input.daysLate), 100)
  const slips = input.numberOfSlips
  if (!Number.isInteger(slips)) throw new RangeError('Slip count must be an integer')
  if (type === 'T5013') {
    const penalty = Math.max(100, 25 * days)
    return { penalty, perSlipPenalty: Math.round(penalty / slips * 100) / 100,
      rule: 'ITA s.162(7.1): partnership return, $25/day up to 100 days, minimum $100' }
  }
  const prescribed = [
    'AGR-1', 'T4FHSA', 'NR4', 'PART XVIII', 'RC368', 'RC438', 'RC62', 'RRSP',
    'T10', 'T1204', 'T215', 'T2202', 'T3', 'T4', 'T4A', 'T4A(P)', 'T4A-NR',
    'T4A(OAS)', 'T4A-RCA', 'T4E', 'T4PS', 'T4RIF', 'T4RSP', 'T5', 'T5007', 'T5008', 'T5018', 'TFSA',
  ]
  if (!prescribed.includes(type)) throw new RangeError('Unverified information-return penalty category: ' + type)
  const relief = ['NR4', 'T4', 'T4A', 'T4E', 'T5', 'T5018'].includes(type)
  const daily = relief && slips <= 5 ? 0 : relief && slips <= 10 ? 5
    : slips <= 50 ? 10 : slips <= 500 ? 15 : slips <= 2500 ? 25 : slips <= 10000 ? 50 : 75
  const penalty = daily === 0 ? 100 : Math.max(100, daily * days)
  return {
    penalty,
    rule: `ITA s.162(7.01) / CRA ${relief ? 'relieving' : 'legislated'} tier: ${type}, ${slips} slips, ${days} days (maximum 100 days)`,
    perSlipPenalty: Math.round(penalty / slips * 100) / 100,
  }
}
