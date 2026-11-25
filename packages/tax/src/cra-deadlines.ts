/**
 * @nzila/tax — CRA deadline auto-calculator
 *
 * Computes nominal filing/payment dates for ordinary corporate filers.
 * Apply the applicable jurisdiction's weekend/public-holiday extension separately;
 * this module does not contain a verified statutory holiday calendar.
 *
 * Sources:
 * - T2 filing: ITA s.150(1)(a) — 6 months after fiscal year end
 * - T2 payment: ITA s.157(1)(b) — 2 months after FYE (3 months for certain CCPCs)
 * - CO-17: Revenu Québec corporate filing guidance — 6 months after FYE (same as federal)
 * - GST/HST annual: ETA s.238(1) — 3 months after fiscal year end
 * - T5 / RL-3: CRA T5 / Revenu Québec RL-3 filing guidance — last day of February following calendar year
 * - T4 / T4A: CRA filing guidance; T5013: CRA T4068, dependent on partner composition
 * - CRA T4068 partnership guide; Revenu Québec filing-frequency guidance
 * Source scope excludes special financial-institution and individual GST filers.
 */
import type { Province } from './types'

export interface AutoDeadline {
  type: string
  label: string
  dueDate: string  // Nominal ISO date, before weekend/public-holiday extensions
  rule: string     // human-readable CRA rule
}

/**
 * Parse a fiscal year end string (MM-DD) and a year to get a Date.
 */
function parseFiscalYearEnd(fiscalYearEnd: string, year: number): Date {
  const match = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(fiscalYearEnd)
  if (!match) throw new RangeError('Fiscal year end must be MM-DD or YYYY-MM-DD')
  const [, mm, dd] = match.map(Number)
  const date = new Date(Date.UTC(year, mm - 1, dd))
  if (date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) {
    throw new RangeError('Fiscal year end must be a valid date')
  }
  return date
}

/**
 * Format a Date to ISO date string (YYYY-MM-DD).
 */
function toIso(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Add months to a date, clamping to the last day of the target month.
 *
 * Native Date.setMonth() overflows: Jan 31 + 1 month → Mar 3 (not Feb 28).
 * Preserve month-end dates; otherwise clamp to the last valid day, using UTC.
 */
function addMonths(d: Date, months: number): Date {
  const day = d.getUTCDate()
  const sourceMonthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0))
  // CRA month-end periods stay at month end; otherwise retain the day, clamped.
  target.setUTCDate(day === sourceMonthEnd ? target.getUTCDate() : Math.min(day, target.getUTCDate()))
  return target
}

/**
 * Last day of a given month/year.
 */
function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0))
}

/**
 * Calculate nominal deadlines in the documented ordinary-corporate scope.
 *
 * @param fiscalYearEnd  MM-DD format (e.g. "12-31")
 * @param taxYear        The calendar year the fiscal year ends in (e.g. 2025)
 * @param province       Province of registration (affects CO-17 / QST)
 * @param options        Optional: isCcpc (affects payment deadline), gstFrequency
 */
export function calculateCorporateDeadlines(
  fiscalYearEnd: string,
  taxYear: number,
  province: Province,
  options?: {
    isCcpc?: boolean
    /** Retained for compatibility; income alone cannot establish three-month eligibility. */
    priorYearTaxableIncome?: number
    gstFilingFrequency?: 'monthly' | 'quarterly' | 'annual'
    /** Caller has established all CRA three-month balance conditions: CCPC throughout
     * the year, SBD claimed this/prior year, and own/associated business-limit tests.
     * isCcpc or a $500,000 income amount alone does not establish eligibility. */
    qualifiesForThreeMonthPayment?: boolean
    /** Omit unless a partnership has this same fiscal period and these partner types.
     * A corporate filer does not automatically owe a T5013 return. */
    partnershipPartnerTypes?: 'individuals' | 'corporations' | 'mixed'
  },
): AutoDeadline[] {
  const fye = parseFiscalYearEnd(fiscalYearEnd, taxYear)
  const deadlines: AutoDeadline[] = []

  // ── T2 Corporate filing: 6 months after FYE ──
  const t2Filing = addMonths(fye, 6)
  deadlines.push({
    type: 'federal_filing',
    label: `${taxYear} — Federal T2 Filing`,
    dueDate: toIso(t2Filing),
    rule: 'ITA s.150(1)(a): 6 months after fiscal year end',
  })

  // ── T2 Corporate payment: 2 months after FYE (3 months for qualifying CCPCs) ──
  // https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-payments/paying-your-balance-corporation-tax/balance-day.html
  // Unknown eligibility must not silently extend the general two-month deadline.
  const qualifiesFor3Months = options?.isCcpc === true && options.qualifiesForThreeMonthPayment === true
  const paymentMonths = qualifiesFor3Months ? 3 : 2
  const t2Payment = addMonths(fye, paymentMonths)
  deadlines.push({
    type: 'federal_payment',
    label: `${taxYear} — Federal T2 Balance Due`,
    dueDate: toIso(t2Payment),
    rule: qualifiesFor3Months
      ? 'ITA s.157(1)(b): 3 months after FYE (qualifying CCPC)'
      : 'ITA s.157(1)(b): 2 months after FYE',
  })

  // ── CO-17 (Quebec only): same 6-month rule ──
  if (province === 'QC') {
    deadlines.push({
      type: 'provincial_filing',
      label: `${taxYear} — Quebec CO-17 Filing`,
      dueDate: toIso(t2Filing), // same deadline
      rule: 'Revenu Québec: 6 months after fiscal year end',
    })
    deadlines.push({
      type: 'provincial_payment',
      label: `${taxYear} — Quebec CO-17 Balance Due`,
      dueDate: toIso(addMonths(fye, 2)),
      rule: 'Revenu Québec: balance due within 2 months after fiscal year end',
    })
  }

  // ── GST/HST annual return: 3 months after FYE ──
  if (options?.gstFilingFrequency === 'annual' || !options?.gstFilingFrequency) {
    const gstDeadline = addMonths(fye, 3)
    deadlines.push({
      type: 'indirect_filing',
      label: `${taxYear} — GST/HST Annual Return`,
      dueDate: toIso(gstDeadline),
      rule: 'ETA s.238(1): 3 months after fiscal year end',
    })
    // Ordinary annual corporate GST/HST return and payment are both due in 3 months.
    deadlines.push({
      type: 'indirect_payment',
      label: `${taxYear} — GST/HST Annual Payment`,
      dueDate: toIso(gstDeadline),
      rule: 'ETA: ordinary annual corporate filer, 3 months after fiscal year end',
    })
  }

  // ── QST annual (Quebec only) ──
  // RQ requires matching GST/QST reporting frequencies. The monthly/quarterly
  // schedules are outside this annual QST entry; never label those filers annual.
  // https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/reporting-gsthst-and-qst/filing-frequency/
  if (province === 'QC' && (!options?.gstFilingFrequency || options.gstFilingFrequency === 'annual')) {
    const qstDeadline = addMonths(fye, 3)
    deadlines.push({
      type: 'indirect_filing',
      label: `${taxYear} — QST Annual Return`,
      dueDate: toIso(qstDeadline),
      rule: 'QSTA: 3 months after fiscal year end',
    })
  }

  // ── T5 / RL-3 (investment income slips): Feb 28 following calendar year ──
  const t5Deadline = lastDayOfMonth(taxYear + 1, 1) // Feb 28/29
  deadlines.push({
    type: 'federal_filing',
    label: `${taxYear} — T5 Information Return`,
    dueDate: toIso(t5Deadline),
    rule: 'CRA T5 Guide: last day of February following calendar year',
  })
  if (province === 'QC') {
    deadlines.push({
      type: 'provincial_filing',
      label: `${taxYear} — RL-3 Relevé`,
      dueDate: toIso(t5Deadline),
      rule: 'TAA: last day of February following calendar year',
    })
  }

  // ── T4 / T4A (employment/pension slips): Feb 28 following calendar year ──
  deadlines.push({
    type: 'federal_filing',
    label: `${taxYear} — T4 / T4A Information Return`,
    dueDate: toIso(t5Deadline),
    rule: 'ITA: last day of February following calendar year',
  })

  // CRA T4068: all individuals -> March 31; all corporations -> five months
  // after this partnership period; mixed -> earlier of those two dates.
  // Unknown partner composition produces no purported partnership deadline.
  if (options?.partnershipPartnerTypes) {
    const march31 = new Date(Date.UTC(taxYear + 1, 2, 31))
    const fiveMonths = addMonths(fye, 5)
    const types = options.partnershipPartnerTypes
    const due = types === 'individuals' ? march31 : types === 'corporations' ? fiveMonths
      : new Date(Math.min(march31.getTime(), fiveMonths.getTime()))
    deadlines.push({
      type: 'federal_filing',
      label: `${taxYear} — T5013 Partnership Information`,
      dueDate: toIso(due),
      rule: 'CRA T4068 / Income Tax Regulations s.229: deadline depends on partner composition',
    })
  }

  return deadlines
}

/**
 * Calculate quarterly GST/HST filing deadlines for a fiscal year.
 */
export function calculateQuarterlyGstDeadlines(
  fiscalYearEnd: string,
  taxYear: number,
): AutoDeadline[] {
  const fye = parseFiscalYearEnd(fiscalYearEnd, taxYear)
  const deadlines: AutoDeadline[] = []

  for (let q = 1; q <= 4; q++) {
    // Each quarter ends 3 months apart, starting from FYE - 12 months + 3*q
    const quarterEnd = addMonths(fye, -12 + 3 * q)
    const filingDue = addMonths(quarterEnd, 1) // 1 month after quarter end
    deadlines.push({
      type: 'indirect_filing',
      label: `${taxYear} Q${q} — GST/HST Quarterly Return`,
      dueDate: toIso(filingDue),
      rule: 'ETA: 1 month after reporting period end',
    })
  }

  return deadlines
}

/**
 * Calculate monthly GST/HST filing deadlines for a fiscal year.
 */
export function calculateMonthlyGstDeadlines(
  fiscalYearEnd: string,
  taxYear: number,
): AutoDeadline[] {
  const fye = parseFiscalYearEnd(fiscalYearEnd, taxYear)
  const deadlines: AutoDeadline[] = []

  for (let m = 1; m <= 12; m++) {
    const monthEnd = addMonths(fye, -12 + m)
    const filingDue = addMonths(monthEnd, 1) // 1 month after period end
    deadlines.push({
      type: 'indirect_filing',
      label: `${taxYear} M${m} — GST/HST Monthly Return`,
      dueDate: toIso(filingDue),
      rule: 'ETA: 1 month after reporting period end',
    })
  }

  return deadlines
}
