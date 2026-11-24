/**
 * @nzila/tax — Payroll remittance thresholds & frequencies
 *
 * CRA assigns payroll remitter types based on average monthly withholding
 * amounts (AMWA). The remitter type determines how often and by when
 * source deductions must be remitted.
 *
 * Sources:
 * - CRA Guide T4001: "Employers' Guide — Payroll Deductions and Remittances"
 * - CRA: "How to remit (pay)" — Remitter types and due dates
 * - Reg. 108(1.1): AMWA calculation
 */

// ── Remitter type thresholds ────────────────────────────────────────────────

export type RemitterType =
  | 'quarterly'            // Confirmed eligibility; AMWA alone is insufficient
  | 'regular'              // AMWA $0 – $24,999.99 absent confirmed quarterly eligibility
  | 'accelerated_threshold1' // AMWA $25,000 – $99,999.99
  | 'accelerated_threshold2' // AMWA ≥ $100,000

export interface RemitterThreshold {
  type: RemitterType
  label: string
  amwaMin: number
  amwaMax: number | null
  frequency: string
  dueDateRule: string
  /** CRA rule reference */
  rule: string
}

/**
 * CRA payroll remitter thresholds.
 * AMWA = Average Monthly Withholding Amount (2 calendar years prior).
 */
export const REMITTER_THRESHOLDS: RemitterThreshold[] = [
  {
    type: 'quarterly',
    label: 'Quarterly Remitter',
    amwaMin: 0,
    amwaMax: 2_999.99,
    frequency: 'Quarterly',
    dueDateRule: '15th of the month following the end of each quarter (Apr 15, Jul 15, Oct 15, Jan 15)',
    rule: 'Confirmed quarterly eligibility: new accounts need monthly withholding below $1,000; accounts open at least 12 months need AMWA below $3,000. Both need perfect compliance.',
  },
  {
    type: 'regular',
    label: 'Regular Remitter',
    amwaMin: 0,
    amwaMax: 24_999.99,
    frequency: 'Monthly',
    dueDateRule: '15th of the month following the month deductions were made',
    rule: 'Reg. 108(1): AMWA below $25,000 unless quarterly eligibility is established',
  },
  {
    type: 'accelerated_threshold1',
    label: 'Accelerated Remitter — Threshold 1',
    amwaMin: 25_000,
    amwaMax: 99_999.99,
    frequency: 'Twice monthly',
    dueDateRule: 'Deductions from 1st–15th: due by 25th. Deductions from 16th–end: due by 10th of next month',
    rule: 'Reg. 108(1.1)(a): AMWA between $25,000 and $99,999.99',
  },
  {
    type: 'accelerated_threshold2',
    label: 'Accelerated Remitter — Threshold 2',
    amwaMin: 100_000,
    amwaMax: null,
    frequency: 'Up to 4 times monthly',
    dueDateRule: 'Due 3rd working day after each fixed monthly period: 1st–7th, 8th–14th, 15th–21st, 22nd–month end',
    rule: 'Reg. 108(1.1)(b): AMWA $100,000 or more',
  },
]

/**
 * Select a conservative remitter frequency from AMWA. Quarterly status requires
 * separate confirmation of all CRA conditions; this function does not establish
 * account age, perfect compliance, new-account MWA, or CRA assignment. Without
 * that confirmation, low AMWA returns regular rather than granting quarterly.
 * Source: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/remitting-source-deductions/how-when-remit-due-dates.html
 */
export function determineRemitterType(
  amwa: number,
  options: { quarterlyEligibilityConfirmed?: boolean } = {},
): RemitterThreshold {
  if (!Number.isFinite(amwa) || amwa < 0) {
    throw new RangeError('AMWA must be a finite non-negative amount')
  }
  if (options.quarterlyEligibilityConfirmed === true && amwa < 3_000) {
    return REMITTER_THRESHOLDS[0]
  }
  for (let i = REMITTER_THRESHOLDS.length - 1; i >= 1; i--) {
    if (amwa >= REMITTER_THRESHOLDS[i].amwaMin) {
      return REMITTER_THRESHOLDS[i]
    }
  }
  return REMITTER_THRESHOLDS[1]
}

/**
 * Calculate AMWA from total annual withholdings.
 * AMWA = total source deductions (CPP + EI + income tax) / number of months with employees.
 */
export function calculateAmwa(totalAnnualWithholdings: number, monthsWithEmployees: number = 12): number {
  if (monthsWithEmployees <= 0) return 0
  return Math.round((totalAnnualWithholdings / monthsWithEmployees) * 100) / 100
}

// ── Payroll remittance due dates ────────────────────────────────────────────

export interface PayrollRemittanceDueDate {
  periodStart: string
  periodEnd: string
  dueDate: string
  remitterType: RemitterType
  label: string
}

/**
 * Generate nominal monthly due dates for a regular remitter.
 * No weekend/public-holiday adjustment: CRA permits receipt on the next business
 * day when the nominal due date is a Saturday, Sunday, or recognized holiday.
 */
export function generateMonthlyRemittanceDueDates(year: number): PayrollRemittanceDueDate[] {
  const dueDates: PayrollRemittanceDueDate[] = []
  for (let m = 0; m < 12; m++) {
    const periodStart = new Date(year, m, 1)
    const periodEnd = new Date(year, m + 1, 0)
    const dueDate = new Date(year, m + 1, 15) // 15th of next month
    dueDates.push({
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      remitterType: 'regular',
      label: `${year}-${String(m + 1).padStart(2, '0')} Payroll Remittance`,
    })
  }
  return dueDates
}

/**
 * Generate nominal quarterly dates for an already-confirmed quarterly remitter.
 * No weekend/public-holiday adjustment; these dates do not establish eligibility.
 */
export function generateQuarterlyRemittanceDueDates(year: number): PayrollRemittanceDueDate[] {
  const quarters = [
    { start: [year, 0, 1], end: [year, 2, 31], due: [year, 3, 15], label: 'Q1' },
    { start: [year, 3, 1], end: [year, 5, 30], due: [year, 6, 15], label: 'Q2' },
    { start: [year, 6, 1], end: [year, 8, 30], due: [year, 9, 15], label: 'Q3' },
    { start: [year, 9, 1], end: [year, 11, 31], due: [year + 1, 0, 15], label: 'Q4' },
  ] as const
  return quarters.map((q) => ({
    periodStart: new Date(q.start[0], q.start[1], q.start[2]).toISOString().split('T')[0],
    periodEnd: new Date(q.end[0], q.end[1], q.end[2]).toISOString().split('T')[0],
    dueDate: new Date(q.due[0], q.due[1], q.due[2]).toISOString().split('T')[0],
    remitterType: 'quarterly' as RemitterType,
    label: `${year} ${q.label} Payroll Remittance`,
  }))
}

// ── CPP / EI contribution constants (2026) ──────────────────────────────────

export const CPP_2026 = {
  /** Maximum pensionable earnings (YMPE) */
  ympe: 74_600,
  /** Second ceiling (YAMPE — CPP2) */
  yampe: 85_000,
  /** Basic exemption */
  basicExemption: 3_500,
  /** Employee/employer CPP1 rate */
  rate: 0.0595,
  /** Employee/employer CPP2 rate (on earnings between YMPE and YAMPE) */
  cpp2Rate: 0.04,
  /** Maximum employee CPP1 contribution */
  maxContribution: 4_230.45,
  /** Maximum employee CPP2 contribution */
  maxCpp2Contribution: 416.00,
} as const

/** Standard Canada-except-Quebec rates; not QPIP or a reduced employer premium. */
export const EI_2026 = {
  /** Maximum insurable earnings */
  maxInsurableEarnings: 68_900,
  /** Employee premium rate */
  employeeRate: 0.0163,
  /** Employer premium rate (1.4x employee) */
  employerRate: 0.02282,
  /** Maximum employee premium */
  maxEmployeePremium: 1_123.07,
  /** Maximum employer premium */
  maxEmployerPremium: 1_572.30,
  /** Small business EI rate reduction — qualifying employers */
  smallBusinessReduction: 0.0,
} as const
