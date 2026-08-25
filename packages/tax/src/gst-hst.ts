/**
 * @nzila/tax — GST/HST & QST rate lookup
 *
 * Provincial sales tax rates for every Canadian province/territory.
 * Determines whether a province charges GST-only, HST, or GST + PST/QST.
 *
 * Sources:
 * - CRA GST/HST Info Sheet GI-209
 * - Revenu Québec QST rates
 * - Provincial finance ministry publications
 *
 * All rates current as of 2025–2026.
 */
import type { Province } from './types'

// ── Sales tax regime types ──────────────────────────────────────────────────

export type SalesTaxRegime = 'GST' | 'HST' | 'GST+QST' | 'GST+PST'

export interface ProvincialSalesTax {
  province: Province
  regime: SalesTaxRegime
  /** Federal GST rate (always 5%) */
  gstRate: number
  /** HST rate (combined, replaces GST in HST provinces) */
  hstRate: number | null
  /** Provincial component: PST or QST rate (null if HST or GST-only) */
  pstRate: number | null
  /** Effective total sales tax rate (GST/HST + PST/QST) */
  totalRate: number
  /** Whether PST is recoverable as input tax credit (only HST provinces) */
  provincialPortionRecoverable: boolean
  /** Notes for accountants */
  notes: string
}

/**
 * Federal GST rate — constant across Canada.
 */
export const GST_RATE = 0.05

/**
 * Provincial sales tax rates for all 13 provinces & territories.
 */
export const PROVINCIAL_SALES_TAX: Record<Province, ProvincialSalesTax> = {
  // ── HST provinces (provincial portion recoverable via ITC) ──
  ON: {
    province: 'ON', regime: 'HST', gstRate: 0.05, hstRate: 0.13, pstRate: null,
    totalRate: 0.13, provincialPortionRecoverable: true,
    notes: '13% HST. Ontario point-of-sale rebate on qualifying items.',
  },
  NB: {
    province: 'NB', regime: 'HST', gstRate: 0.05, hstRate: 0.15, pstRate: null,
    totalRate: 0.15, provincialPortionRecoverable: true,
    notes: '15% HST.',
  },
  NS: {
    province: 'NS', regime: 'HST', gstRate: 0.05, hstRate: 0.14, pstRate: null,
    totalRate: 0.14, provincialPortionRecoverable: true,
    notes: '14% HST effective April 1, 2025.',
  },
  PE: {
    province: 'PE', regime: 'HST', gstRate: 0.05, hstRate: 0.15, pstRate: null,
    totalRate: 0.15, provincialPortionRecoverable: true,
    notes: '15% HST.',
  },
  NL: {
    province: 'NL', regime: 'HST', gstRate: 0.05, hstRate: 0.15, pstRate: null,
    totalRate: 0.15, provincialPortionRecoverable: true,
    notes: '15% HST.',
  },

  // ── Quebec: GST + QST (QST not recoverable on federal return) ──
  QC: {
    province: 'QC', regime: 'GST+QST', gstRate: 0.05, hstRate: null, pstRate: 0.09975,
    totalRate: 0.14975, provincialPortionRecoverable: false,
    notes: '5% GST + 9.975% QST. QST claimed separately with Revenu Québec via QST return (not CRA ITC).',
  },

  // ── GST + PST provinces (PST not recoverable) ──
  BC: {
    province: 'BC', regime: 'GST+PST', gstRate: 0.05, hstRate: null, pstRate: 0.07,
    totalRate: 0.12, provincialPortionRecoverable: false,
    notes: '5% GST + 7% BC PST. PST administered by BC Ministry of Finance, not CRA.',
  },
  SK: {
    province: 'SK', regime: 'GST+PST', gstRate: 0.05, hstRate: null, pstRate: 0.06,
    totalRate: 0.11, provincialPortionRecoverable: false,
    notes: '5% GST + 6% SK PST.',
  },
  MB: {
    province: 'MB', regime: 'GST+PST', gstRate: 0.05, hstRate: null, pstRate: 0.07,
    totalRate: 0.12, provincialPortionRecoverable: false,
    notes: '5% GST + 7% MB RST (Retail Sales Tax).',
  },

  // ── GST-only provinces/territories ──
  AB: {
    province: 'AB', regime: 'GST', gstRate: 0.05, hstRate: null, pstRate: null,
    totalRate: 0.05, provincialPortionRecoverable: true,
    notes: '5% GST only. No provincial sales tax.',
  },
  YT: {
    province: 'YT', regime: 'GST', gstRate: 0.05, hstRate: null, pstRate: null,
    totalRate: 0.05, provincialPortionRecoverable: true,
    notes: '5% GST only.',
  },
  NT: {
    province: 'NT', regime: 'GST', gstRate: 0.05, hstRate: null, pstRate: null,
    totalRate: 0.05, provincialPortionRecoverable: true,
    notes: '5% GST only.',
  },
  NU: {
    province: 'NU', regime: 'GST', gstRate: 0.05, hstRate: null, pstRate: null,
    totalRate: 0.05, provincialPortionRecoverable: true,
    notes: '5% GST only.',
  },
}

// ── Lookup helpers ──────────────────────────────────────────────────────────

/**
 * Get the sales tax details for a province.
 */
export function getSalesTax(province: Province): ProvincialSalesTax {
  return PROVINCIAL_SALES_TAX[province]
}

/**
 * Get the total sales tax rate for a province (GST/HST + PST/QST).
 */
export function getTotalSalesTaxRate(province: Province): number {
  return PROVINCIAL_SALES_TAX[province].totalRate
}

/**
 * Calculate sales tax on an amount for a given province.
 * Returns breakdown by component.
 */
export function calculateSalesTax(
  amount: number,
  province: Province,
): {
  subtotal: number
  gst: number
  hst: number | null
  pst: number | null
  total: number
  effectiveRate: number
} {
  const tax = PROVINCIAL_SALES_TAX[province]
  const round2 = (n: number) => Math.round(n * 100) / 100

  if (tax.regime === 'HST') {
    const hst = round2(amount * tax.hstRate!)
    return { subtotal: amount, gst: 0, hst, pst: null, total: round2(amount + hst), effectiveRate: tax.totalRate }
  }

  const gst = round2(amount * tax.gstRate)

  if (tax.regime === 'GST+QST') {
    // QST is calculated on pre-tax amount (changed in 2013; no longer tax-on-tax)
    const pst = round2(amount * tax.pstRate!)
    return { subtotal: amount, gst, hst: null, pst, total: round2(amount + gst + pst), effectiveRate: tax.totalRate }
  }

  if (tax.regime === 'GST+PST') {
    const pst = round2(amount * tax.pstRate!)
    return { subtotal: amount, gst, hst: null, pst, total: round2(amount + gst + pst), effectiveRate: tax.totalRate }
  }

  // GST only
  return { subtotal: amount, gst, hst: null, pst: null, total: round2(amount + gst), effectiveRate: tax.totalRate }
}

/**
 * Determine which indirect tax types apply for an entity based on province.
 * Useful for auto-configuring tax accounts at entity setup.
 */
export function getRequiredIndirectTaxTypes(province: Province): Array<'GST' | 'HST' | 'QST'> {
  const tax = PROVINCIAL_SALES_TAX[province]
  switch (tax.regime) {
    case 'HST':
      return ['HST']
    case 'GST+QST':
      return ['GST', 'QST']
    case 'GST+PST':
    case 'GST':
      return ['GST']
  }
}

/**
 * Check if a province requires a separate provincial sales tax return
 * (i.e. PST/RST filed with provincial authority, not CRA).
 */
export function requiresProvincialSalesTaxReturn(province: Province): boolean {
  const regime = PROVINCIAL_SALES_TAX[province].regime
  return regime === 'GST+PST'
}

/**
 * GST/HST registration threshold — $30,000 in revenue over 4 consecutive quarters.
 * Below this, registration is voluntary. Above, it's mandatory.
 * Source: ETA s.148(1)
 */
export const GST_REGISTRATION_THRESHOLD = 30_000

/**
 * Quick-method threshold — eligible if annual taxable revenue ≤ $400,000.
 * Source: ETA s.227(1)
 */
export const GST_QUICK_METHOD_THRESHOLD = 400_000
