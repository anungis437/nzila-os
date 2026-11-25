/**
 * @nzila/tax — CRA prescribed interest rates
 *
 * CRA publishes prescribed interest rates quarterly under IC07-1.
 * These rates affect:
 * - Installment interest (corporate & personal)
 * - Refund interest
 * - Taxable benefit on employee / shareholder loans
 * - Late filing penalties
 *
 * Source: CRA Information Circular IC07-1
 * Base rate = 3-month Government of Canada Treasury Bill yield
 * (rounded up to nearest whole %, plus applicable add-ons)
 *
 * Rates from 2023 Q1 through 2026 Q4 (update quarterly).
 * Each quarter is published at CRA /tax/prescribed-interest-rates/YYYY-qN.html.
 */

export interface PrescribedRateQuarter {
  /** Year (e.g. 2025) */
  year: number
  /** Quarter 1–4 */
  quarter: 1 | 2 | 3 | 4
  /** Start date of quarter (ISO) */
  startDate: string
  /** End date of quarter (ISO) */
  endDate: string
  /** Base rate (3-month T-bill yield, rounded up) */
  baseRate: number
  /** Corporate installment/arrears interest: base + 4% */
  corporateArrearsRate: number
  /** Non-corporate refund interest: base + 2%. */
  refundRate: number
  /** Taxable benefit rate on employee/shareholder loans: base + 0% */
  taxableBenefitRate: number
  /** Corporate refund interest: base. */
  corporateRefundRate: number
}

/**
 * CRA prescribed interest rates table.
 * Updated quarterly from CRA IC07-1.
 *
 * Formula:
 * - Corporate arrears = base + 4%
 * - Non-corporate arrears = base + 4%
 * - Refund (non-corp) = base + 2%
 * - Refund (corporate) = base throughout the quarters in this table
 * - Taxable benefit = base
 */
export const PRESCRIBED_RATES: PrescribedRateQuarter[] = [
  // 2023
  { year: 2023, quarter: 1, startDate: '2023-01-01', endDate: '2023-03-31', baseRate: 0.04, corporateArrearsRate: 0.08, refundRate: 0.06, taxableBenefitRate: 0.04, corporateRefundRate: 0.04 },
  { year: 2023, quarter: 2, startDate: '2023-04-01', endDate: '2023-06-30', baseRate: 0.05, corporateArrearsRate: 0.09, refundRate: 0.07, taxableBenefitRate: 0.05, corporateRefundRate: 0.05 },
  { year: 2023, quarter: 3, startDate: '2023-07-01', endDate: '2023-09-30', baseRate: 0.05, corporateArrearsRate: 0.09, refundRate: 0.07, taxableBenefitRate: 0.05, corporateRefundRate: 0.05 },
  { year: 2023, quarter: 4, startDate: '2023-10-01', endDate: '2023-12-31', baseRate: 0.05, corporateArrearsRate: 0.09, refundRate: 0.07, taxableBenefitRate: 0.05, corporateRefundRate: 0.05 },
  // 2024
  { year: 2024, quarter: 1, startDate: '2024-01-01', endDate: '2024-03-31', baseRate: 0.06, corporateArrearsRate: 0.10, refundRate: 0.08, taxableBenefitRate: 0.06, corporateRefundRate: 0.06 },
  { year: 2024, quarter: 2, startDate: '2024-04-01', endDate: '2024-06-30', baseRate: 0.06, corporateArrearsRate: 0.10, refundRate: 0.08, taxableBenefitRate: 0.06, corporateRefundRate: 0.06 },
  { year: 2024, quarter: 3, startDate: '2024-07-01', endDate: '2024-09-30', baseRate: 0.05, corporateArrearsRate: 0.09, refundRate: 0.07, taxableBenefitRate: 0.05, corporateRefundRate: 0.05 },
  { year: 2024, quarter: 4, startDate: '2024-10-01', endDate: '2024-12-31', baseRate: 0.05, corporateArrearsRate: 0.09, refundRate: 0.07, taxableBenefitRate: 0.05, corporateRefundRate: 0.05 },
  // 2025
  { year: 2025, quarter: 1, startDate: '2025-01-01', endDate: '2025-03-31', baseRate: 0.04, corporateArrearsRate: 0.08, refundRate: 0.06, taxableBenefitRate: 0.04, corporateRefundRate: 0.04 },
  { year: 2025, quarter: 2, startDate: '2025-04-01', endDate: '2025-06-30', baseRate: 0.04, corporateArrearsRate: 0.08, refundRate: 0.06, taxableBenefitRate: 0.04, corporateRefundRate: 0.04 },
  { year: 2025, quarter: 3, startDate: '2025-07-01', endDate: '2025-09-30', baseRate: 0.03, corporateArrearsRate: 0.07, refundRate: 0.05, taxableBenefitRate: 0.03, corporateRefundRate: 0.03 },
  { year: 2025, quarter: 4, startDate: '2025-10-01', endDate: '2025-12-31', baseRate: 0.03, corporateArrearsRate: 0.07, refundRate: 0.05, taxableBenefitRate: 0.03, corporateRefundRate: 0.03 },
  // 2026
  { year: 2026, quarter: 1, startDate: '2026-01-01', endDate: '2026-03-31', baseRate: 0.03, corporateArrearsRate: 0.07, refundRate: 0.05, taxableBenefitRate: 0.03, corporateRefundRate: 0.03 },
  { year: 2026, quarter: 2, startDate: '2026-04-01', endDate: '2026-06-30', baseRate: 0.03, corporateArrearsRate: 0.07, refundRate: 0.05, taxableBenefitRate: 0.03, corporateRefundRate: 0.03 },
  { year: 2026, quarter: 3, startDate: '2026-07-01', endDate: '2026-09-30', baseRate: 0.03, corporateArrearsRate: 0.07, refundRate: 0.05, taxableBenefitRate: 0.03, corporateRefundRate: 0.03 },
  { year: 2026, quarter: 4, startDate: '2026-10-01', endDate: '2026-12-31', baseRate: 0.03, corporateArrearsRate: 0.07, refundRate: 0.05, taxableBenefitRate: 0.03, corporateRefundRate: 0.03 },
]

/**
 * Look up the prescribed rate for a given date.
 */
export function getPrescribedRate(asOf: Date | string): PrescribedRateQuarter | undefined {
  const d = typeof asOf === 'string' ? new Date(asOf) : asOf
  const iso = d.toISOString().split('T')[0]
  return PRESCRIBED_RATES.find((r) => iso >= r.startDate && iso <= r.endDate)
}

/**
 * Get the prescribed rate for a specific year and quarter.
 */
export function getPrescribedRateByQuarter(year: number, quarter: 1 | 2 | 3 | 4): PrescribedRateQuarter | undefined {
  return PRESCRIBED_RATES.find((r) => r.year === year && r.quarter === quarter)
}

/**
 * Get the corporate arrears interest rate for a given date.
 * This is the rate used for installment interest, late payments, etc.
 * Outside the table coverage, the legacy 7% fallback is not a verified rate;
 * use getPrescribedRate to detect unsupported dates.
 */
export function getCorporateArrearsRate(asOf: Date | string): number {
  const rate = getPrescribedRate(asOf)
  return rate?.corporateArrearsRate ?? 0.07 // fallback to reasonable default
}

/**
 * Get the taxable benefit rate for employee/shareholder loans.
 * Per ITA s.80.4, loans from employer attract deemed interest at this rate.
 * Outside table coverage, the legacy 3% fallback is not a verified rate;
 * use getPrescribedRate to detect unsupported dates.
 */
export function getTaxableBenefitRate(asOf: Date | string): number {
  const rate = getPrescribedRate(asOf)
  return rate?.taxableBenefitRate ?? 0.03
}

/**
 * Get the most recent prescribed rate entry.
 */
export function getLatestPrescribedRate(): PrescribedRateQuarter {
  return PRESCRIBED_RATES[PRESCRIBED_RATES.length - 1]
}

/**
 * Get all prescribed rates for a given year.
 */
export function getPrescribedRatesForYear(year: number): PrescribedRateQuarter[] {
  return PRESCRIBED_RATES.filter((r) => r.year === year)
}
