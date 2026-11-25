/**
 * @nzila/tax — Corporate installment calculator
 *
 * Determines whether a corporation must pay installments and
 * calculates required amounts under CRA rules.
 *
 * Sources:
 * - ITA s.157: Monthly installment requirements
 * - CRA Guide T7B-CORP: "Paying Your Corporate Income Taxes"
 * - Installment threshold: $3,000 net tax owing (ITA s.157(2.1))
 * - Methods: Standard (prior year), Reduced (prior-prior year), Current year estimate
 */

/** Threshold below which no installments are required (ITA s.157(2.1)) */
export const INSTALLMENT_THRESHOLD = 3_000

/**
 * Input for installment calculation.
 */
export interface InstallmentInput {
  /** Current-year tax for one CRA instalment basis. Test federal and provincial
   * obligations separately; provincial Quebec/Alberta tax is not in the CRA basis. */
  estimatedCurrentYearTax: number
  /** Immediately preceding-year tax on that same instalment basis */
  priorYearTax: number
  /** Two-years-prior tax on the same separately tested instalment basis */
  priorPriorYearTax?: number
  /** Full 12-month year only; short-year schedules are not supported. */
  monthsInYear?: number
  /** Whether this is a CCPC qualifying for quarterly installments */
  isSmallCcpc?: boolean
}

/**
 * Result of installment calculation.
 */
export interface InstallmentResult {
  /** Whether installments are required */
  required: boolean
  /** Reason installments are / aren't required */
  reason: string
  /** CRA rule reference */
  rule: string
  /** Frequency of payments */
  frequency: 'monthly' | 'quarterly' | 'none'
  /** Number of installment payments */
  numberOfPayments: number
  /** Scalar illustration: first payment for the recommended method. The reduced
   * method has uneven later payments that this result does not expose. */
  amountPerPayment: number
  /** Total installment obligation for the year */
  totalObligation: number
  /** Comparison of all three CRA methods */
  methods: {
    /** Method 1: Based on estimated current year tax */
    currentYearEstimate: number
    /** Method 2: Based on prior year tax */
    priorYearMethod: number
    /** Method 3: First 2 based on prior-prior year, last 10 on prior year */
    reducedMethod: number | null
    /** Which method produces the lowest total */
    recommended: 'currentYear' | 'priorYear' | 'reduced'
  }
  /** Nominal due dates before weekend/public-holiday extensions */
  dueDates: string[]
}

/**
 * Calculate whether installments are required and the amounts under each CRA method.
 *
 * CRA offers 3 methods — corporations can use whichever gives the lowest installments:
 * 1. Current year estimate: divide estimated tax by 12 (or 4)
 * 2. Prior year: divide last year's tax by 12 (or 4)
 * 3. Reduced: first 2 payments based on year before last / 12, remaining based on (last year - first 2) / 10
 */
export function calculateInstallments(
  input: InstallmentInput,
  fiscalYearEnd: string,
  taxYear: number,
): InstallmentResult {
  const months = input.monthsInYear ?? 12
  if (months !== 12) throw new RangeError('Short-year instalment schedules require a separate verified calculation')
  const isQuarterly = input.isSmallCcpc ?? false
  const frequency = isQuarterly ? 'quarterly' : 'monthly'
  const numPayments = isQuarterly ? 4 : months

  // ── Check threshold ──
  if (input.priorYearTax <= INSTALLMENT_THRESHOLD || input.estimatedCurrentYearTax <= INSTALLMENT_THRESHOLD) {
    return {
      required: false,
      reason: `Current estimate ($${input.estimatedCurrentYearTax}) or prior year tax ($${input.priorYearTax}) is at or below the $${INSTALLMENT_THRESHOLD} threshold`,
      rule: 'ITA s.157(2.1): No installments required if tax ≤ $3,000',
      frequency: 'none',
      numberOfPayments: 0,
      amountPerPayment: 0,
      totalObligation: 0,
      methods: {
        currentYearEstimate: 0,
        priorYearMethod: 0,
        reducedMethod: null,
        recommended: 'currentYear',
      },
      dueDates: [],
    }
  }

  // ── Method 1: Current year estimate ──
  const currentYearPerPayment = Math.round((input.estimatedCurrentYearTax / numPayments) * 100) / 100

  // ── Method 2: Prior year ──
  const priorYearPerPayment = Math.round((input.priorYearTax / numPayments) * 100) / 100

  // ── Method 3: Reduced (requires prior-prior year data) ──
  let reducedPerPayment: number | null = null
  let reducedTotal: number | null = null
  if (input.priorPriorYearTax != null) {
    if (isQuarterly) {
      // First payment: prior-prior / 4, remaining 3: (prior - first) / 3
      const first = Math.round((input.priorPriorYearTax / 4) * 100) / 100
      const rest = Math.max(0, Math.round(((input.priorYearTax - first) / 3) * 100) / 100)
      reducedPerPayment = first // show the first payment amount
      reducedTotal = first + rest * 3
    } else {
      // First 2 months: prior-prior / 12, remaining 10: (prior - first 2 total) / 10
      const firstTwo = Math.round((input.priorPriorYearTax / 12) * 100) / 100
      const remaining = Math.max(0, Math.round(((input.priorYearTax - firstTwo * 2) / 10) * 100) / 100)
      reducedPerPayment = firstTwo
      reducedTotal = firstTwo * 2 + remaining * 10
    }
  }

  // ── Determine best method ──
  const currentTotal = currentYearPerPayment * numPayments
  const priorTotal = priorYearPerPayment * numPayments

  let recommended: 'currentYear' | 'priorYear' | 'reduced' = 'currentYear'
  let bestTotal = currentTotal
  if (priorTotal < bestTotal) {
    recommended = 'priorYear'
    bestTotal = priorTotal
  }
  if (reducedTotal != null && reducedTotal < bestTotal) {
    recommended = 'reduced'
    bestTotal = reducedTotal
  }

  const bestPerPayment =
    recommended === 'currentYear'
      ? currentYearPerPayment
      : recommended === 'priorYear'
        ? priorYearPerPayment
        : reducedPerPayment!

  // ── Generate due dates ──
  // Nominal dates only, before applicable weekend/public-holiday extensions.
  // CRA: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-payments/paying-instalments/instalment-dates.html
  const match = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(fiscalYearEnd)
  if (!match) throw new RangeError('Fiscal year end must be MM-DD or YYYY-MM-DD')
  const [, mm, dd] = match.map(Number)
  const fye = new Date(Date.UTC(taxYear, mm - 1, dd))
  if (fye.getUTCMonth() !== mm - 1 || fye.getUTCDate() !== dd) throw new RangeError('Invalid fiscal year end')
  const monthEnd = new Date(Date.UTC(taxYear, mm, 0)).getUTCDate() === dd
  const dueDates: string[] = []
  const step = isQuarterly ? 3 : 1
  for (let i = 0; i < numPayments; i++) {
    const target = new Date(Date.UTC(taxYear, mm - 1 - (months - step) + i * step + 1, 0))
    if (!monthEnd) target.setUTCDate(Math.min(dd, target.getUTCDate()))
    dueDates.push(target.toISOString().split('T')[0])
  }

  return {
    required: true,
    reason: `Tax exceeds $${INSTALLMENT_THRESHOLD} threshold — installments required`,
    rule: 'ITA s.157(1): Monthly (or quarterly for eligible CCPCs) installments',
    frequency,
    numberOfPayments: numPayments,
    amountPerPayment: Math.round(bestPerPayment * 100) / 100,
    totalObligation: Math.round(bestTotal * 100) / 100,
    methods: {
      currentYearEstimate: Math.round(currentTotal * 100) / 100,
      priorYearMethod: Math.round(priorTotal * 100) / 100,
      reducedMethod: reducedTotal != null ? Math.round(reducedTotal * 100) / 100 : null,
      recommended,
    },
    dueDates,
  }
}

/**
 * Calculate installment interest on late or insufficient payments.
 * CRA charges prescribed interest (compounded daily) on deficient installments.
 *
 * @param requiredAmount  Amount that should have been paid
 * @param actualPaid      Amount actually paid
 * @param daysLate        Number of days the payment was late
 * @param prescribedRate  CRA prescribed interest rate (quarterly, see prescribed-interest.ts)
 */
export function calculateInstallmentInterest(
  requiredAmount: number,
  actualPaid: number,
  daysLate: number,
  prescribedRate: number,
): { interest: number; shortfall: number } {
  const shortfall = Math.max(0, requiredAmount - actualPaid)
  if (shortfall <= 0 || daysLate <= 0) {
    return { interest: 0, shortfall: 0 }
  }
  // CRA compounds daily: I = P * ((1 + r/365)^d - 1)
  const dailyRate = prescribedRate / 365
  const interest = shortfall * (Math.pow(1 + dailyRate, daysLate) - 1)
  return {
    interest: Math.round(interest * 100) / 100,
    shortfall: Math.round(shortfall * 100) / 100,
  }
}
