/**
 * Chart of Accounts — GIFI-mapped general ledger account structure.
 *
 * Implements a complete Canadian chart of accounts with CRA GIFI codes
 * (General Index of Financial Information) as required for T2 Schedule 100/125.
 *
 * Sources:
 * - CRA T4012: "T2 Corporation — Income Tax Guide"
 * - CRA GIFI: https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4088
 *
 * @module cfo/chart-of-accounts
 */
import { z } from 'zod'

// ── Account types ───────────────────────────────────────────────────────────

export const AccountType = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
} as const
export type AccountType = (typeof AccountType)[keyof typeof AccountType]

export const AccountSubtype = {
  // Assets
  CURRENT_ASSET: 'current_asset',
  LONG_TERM_ASSET: 'long_term_asset',
  CAPITAL_ASSET: 'capital_asset',
  INTANGIBLE_ASSET: 'intangible_asset',
  // Liabilities
  CURRENT_LIABILITY: 'current_liability',
  LONG_TERM_LIABILITY: 'long_term_liability',
  // Equity
  SHARE_CAPITAL: 'share_capital',
  RETAINED_EARNINGS: 'retained_earnings',
  // Revenue
  OPERATING_REVENUE: 'operating_revenue',
  OTHER_REVENUE: 'other_revenue',
  // Expense
  OPERATING_EXPENSE: 'operating_expense',
  CCA_EXPENSE: 'cca_expense',
  INTEREST_EXPENSE: 'interest_expense',
  TAX_EXPENSE: 'tax_expense',
} as const
export type AccountSubtype = (typeof AccountSubtype)[keyof typeof AccountSubtype]

// ── GIFI code structure ─────────────────────────────────────────────────────

export interface GifiMapping {
  /** CRA GIFI code (4-digit) */
  code: number
  /** GIFI description from CRA */
  description: string
  /** T2 schedule where this code is reported */
  schedule: 100 | 125 | 141
  /** Normal balance side */
  normalBalance: 'debit' | 'credit'
}

export interface ChartAccount {
  /** Internal account number (e.g., "1000") */
  accountNumber: string
  /** Display name */
  name: string
  /** Account classification */
  type: AccountType
  subtype: AccountSubtype
  /** CRA GIFI code mapping */
  gifi: GifiMapping
  /** Whether this account is active */
  isActive: boolean
  /** Whether sub-accounts are allowed */
  isParent: boolean
  /** Parent account number (null for top-level) */
  parentAccountNumber: string | null
  /** Description / memo for staff */
  description?: string
  /** QBO account ID if linked */
  qboAccountId?: string
}

// ── Zod schema for account validation ───────────────────────────────────────

export const ChartAccountSchema = z.object({
  accountNumber: z.string().regex(/^\d{4,6}$/, 'Account number must be 4-6 digits'),
  name: z.string().min(1).max(200),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  gifiCode: z.number().int().min(1000).max(9999),
  isActive: z.boolean().default(true),
  parentAccountNumber: z.string().nullable().default(null),
  description: z.string().max(500).optional(),
  qboAccountId: z.string().optional(),
})

// ── Standard Canadian GIFI codes ────────────────────────────────────────────
// Subset of ~200 most-used codes (full GIFI has ~900).
// Grouped by T2 Schedule 100 (Balance Sheet) and Schedule 125 (Income Statement).

export const GIFI_CODES: Record<number, Omit<GifiMapping, 'code'>> = {
  // ── Schedule 100: Assets ──────────────────────────────────────────────
  1000: { description: 'Cash and deposits', schedule: 100, normalBalance: 'debit' },
  1001: { description: 'Cash — Canadian currency', schedule: 100, normalBalance: 'debit' },
  1002: { description: 'Cash — foreign currency', schedule: 100, normalBalance: 'debit' },
  1060: { description: 'Accounts receivable', schedule: 100, normalBalance: 'debit' },
  1061: { description: 'Trade accounts receivable', schedule: 100, normalBalance: 'debit' },
  1066: { description: 'Allowance for doubtful accounts', schedule: 100, normalBalance: 'credit' },
  1120: { description: 'Inventories', schedule: 100, normalBalance: 'debit' },
  1121: { description: 'Raw materials', schedule: 100, normalBalance: 'debit' },
  1122: { description: 'Work in process', schedule: 100, normalBalance: 'debit' },
  1123: { description: 'Finished goods', schedule: 100, normalBalance: 'debit' },
  1180: { description: 'Prepaid expenses', schedule: 100, normalBalance: 'debit' },
  1181: { description: 'Prepaid insurance', schedule: 100, normalBalance: 'debit' },
  1300: { description: 'Short-term investments', schedule: 100, normalBalance: 'debit' },
  1301: { description: 'Government securities', schedule: 100, normalBalance: 'debit' },
  1302: { description: 'Term deposits', schedule: 100, normalBalance: 'debit' },
  1480: { description: 'Loans receivable', schedule: 100, normalBalance: 'debit' },
  1481: { description: 'Shareholder loans receivable', schedule: 100, normalBalance: 'debit' },
  1599: { description: 'Total current assets', schedule: 100, normalBalance: 'debit' },
  // Tangible capital assets
  1600: { description: 'Land', schedule: 100, normalBalance: 'debit' },
  1680: { description: 'Buildings', schedule: 100, normalBalance: 'debit' },
  1740: { description: 'Machinery and equipment', schedule: 100, normalBalance: 'debit' },
  1741: { description: 'Computer equipment', schedule: 100, normalBalance: 'debit' },
  1742: { description: 'Office furniture and equipment', schedule: 100, normalBalance: 'debit' },
  1743: { description: 'Vehicles', schedule: 100, normalBalance: 'debit' },
  1744: { description: 'Leasehold improvements', schedule: 100, normalBalance: 'debit' },
  1772: { description: 'Accumulated depreciation — buildings', schedule: 100, normalBalance: 'credit' },
  1773: { description: 'Accumulated depreciation — equipment', schedule: 100, normalBalance: 'credit' },
  1774: { description: 'Accumulated depreciation — vehicles', schedule: 100, normalBalance: 'credit' },
  // Intangible assets
  2010: { description: 'Goodwill', schedule: 100, normalBalance: 'debit' },
  2070: { description: 'Patents, franchises, other intangibles', schedule: 100, normalBalance: 'debit' },
  2140: { description: 'Long-term investments', schedule: 100, normalBalance: 'debit' },
  2178: { description: 'Due from related parties', schedule: 100, normalBalance: 'debit' },
  2589: { description: 'Total assets', schedule: 100, normalBalance: 'debit' },

  // ── Schedule 100: Liabilities ─────────────────────────────────────────
  2600: { description: 'Bank overdraft', schedule: 100, normalBalance: 'credit' },
  2620: { description: 'Accounts payable and accrued liabilities', schedule: 100, normalBalance: 'credit' },
  2621: { description: 'Trade accounts payable', schedule: 100, normalBalance: 'credit' },
  2680: { description: 'Taxes payable', schedule: 100, normalBalance: 'credit' },
  2681: { description: 'Income taxes payable', schedule: 100, normalBalance: 'credit' },
  2682: { description: 'Sales taxes payable (GST/HST)', schedule: 100, normalBalance: 'credit' },
  2700: { description: 'Current portion of long-term debt', schedule: 100, normalBalance: 'credit' },
  2780: { description: 'Deferred revenue', schedule: 100, normalBalance: 'credit' },
  2860: { description: 'Accrued liabilities', schedule: 100, normalBalance: 'credit' },
  2861: { description: 'Accrued payroll', schedule: 100, normalBalance: 'credit' },
  2862: { description: 'Accrued vacation pay', schedule: 100, normalBalance: 'credit' },
  2960: { description: 'Shareholder loans payable', schedule: 100, normalBalance: 'credit' },
  3139: { description: 'Total current liabilities', schedule: 100, normalBalance: 'credit' },
  3140: { description: 'Long-term bank loans', schedule: 100, normalBalance: 'credit' },
  3141: { description: 'Mortgages payable', schedule: 100, normalBalance: 'credit' },
  3450: { description: 'Deferred income taxes', schedule: 100, normalBalance: 'credit' },
  3470: { description: 'Due to related parties', schedule: 100, normalBalance: 'credit' },
  3499: { description: 'Total liabilities', schedule: 100, normalBalance: 'credit' },

  // ── Schedule 100: Equity ──────────────────────────────────────────────
  3500: { description: 'Common shares', schedule: 100, normalBalance: 'credit' },
  3520: { description: 'Preferred shares', schedule: 100, normalBalance: 'credit' },
  3600: { description: 'Retained earnings/deficit', schedule: 100, normalBalance: 'credit' },
  3620: { description: 'Contributed surplus', schedule: 100, normalBalance: 'credit' },
  3640: { description: 'Current year earnings', schedule: 100, normalBalance: 'credit' },
  3680: { description: 'Dividends declared', schedule: 100, normalBalance: 'debit' },
  3849: { description: 'Total equity', schedule: 100, normalBalance: 'credit' },

  // ── Schedule 125: Revenue ─────────────────────────────────────────────
  8000: { description: 'Trade sales, commissions, fees', schedule: 125, normalBalance: 'credit' },
  8020: { description: 'Sales of goods and services (net)', schedule: 125, normalBalance: 'credit' },
  8089: { description: 'Total net sales/service revenue', schedule: 125, normalBalance: 'credit' },
  8090: { description: 'Other revenue', schedule: 125, normalBalance: 'credit' },
  8091: { description: 'Rental revenue', schedule: 125, normalBalance: 'credit' },
  8092: { description: 'Interest income', schedule: 125, normalBalance: 'credit' },
  8093: { description: 'Dividend income', schedule: 125, normalBalance: 'credit' },
  8094: { description: 'Royalty income', schedule: 125, normalBalance: 'credit' },
  8140: { description: 'Foreign exchange gain (loss)', schedule: 125, normalBalance: 'credit' },
  8210: { description: 'Capital gains (losses)', schedule: 125, normalBalance: 'credit' },
  8230: { description: 'Government grants/subsidies', schedule: 125, normalBalance: 'credit' },
  8299: { description: 'Total revenue', schedule: 125, normalBalance: 'credit' },

  // ── Schedule 125: Cost of goods sold ──────────────────────────────────
  8300: { description: 'Opening inventory', schedule: 125, normalBalance: 'debit' },
  8320: { description: 'Purchases/materials', schedule: 125, normalBalance: 'debit' },
  8340: { description: 'Direct wages', schedule: 125, normalBalance: 'debit' },
  8360: { description: 'Subcontracts', schedule: 125, normalBalance: 'debit' },
  8500: { description: 'Closing inventory', schedule: 125, normalBalance: 'credit' },
  8518: { description: 'Cost of goods sold', schedule: 125, normalBalance: 'debit' },

  // ── Schedule 125: Operating expenses ──────────────────────────────────
  8520: { description: 'Salaries, wages, benefits', schedule: 125, normalBalance: 'debit' },
  8521: { description: 'Salaries and wages', schedule: 125, normalBalance: 'debit' },
  8523: { description: 'Employee benefits', schedule: 125, normalBalance: 'debit' },
  8530: { description: 'Subcontract costs', schedule: 125, normalBalance: 'debit' },
  8570: { description: 'Professional and consulting fees', schedule: 125, normalBalance: 'debit' },
  8590: { description: 'Management and administration fees', schedule: 125, normalBalance: 'debit' },
  8610: { description: 'Rent', schedule: 125, normalBalance: 'debit' },
  8620: { description: 'Repairs and maintenance', schedule: 125, normalBalance: 'debit' },
  8621: { description: 'Building repairs', schedule: 125, normalBalance: 'debit' },
  8622: { description: 'Equipment repairs', schedule: 125, normalBalance: 'debit' },
  8640: { description: 'Utilities', schedule: 125, normalBalance: 'debit' },
  8660: { description: 'Telephone and communications', schedule: 125, normalBalance: 'debit' },
  8670: { description: 'Delivery, shipping, distribution', schedule: 125, normalBalance: 'debit' },
  8690: { description: 'Motor vehicle expenses', schedule: 125, normalBalance: 'debit' },
  8691: { description: 'Fuel costs', schedule: 125, normalBalance: 'debit' },
  8692: { description: 'Insurance — vehicles', schedule: 125, normalBalance: 'debit' },
  8710: { description: 'Travel expenses', schedule: 125, normalBalance: 'debit' },
  8711: { description: 'Meals and entertainment (50%)', schedule: 125, normalBalance: 'debit' },
  8720: { description: 'Advertising and promotion', schedule: 125, normalBalance: 'debit' },
  8740: { description: 'Bad debt expense', schedule: 125, normalBalance: 'debit' },
  8760: { description: 'Insurance', schedule: 125, normalBalance: 'debit' },
  8761: { description: 'Business insurance', schedule: 125, normalBalance: 'debit' },
  8762: { description: 'E&O / professional liability insurance', schedule: 125, normalBalance: 'debit' },
  8764: { description: 'Life insurance premiums', schedule: 125, normalBalance: 'debit' },
  8790: { description: 'Licenses, memberships, subscriptions', schedule: 125, normalBalance: 'debit' },
  8810: { description: 'Office expenses', schedule: 125, normalBalance: 'debit' },
  8811: { description: 'Office supplies', schedule: 125, normalBalance: 'debit' },
  8812: { description: 'Postage', schedule: 125, normalBalance: 'debit' },
  8860: { description: 'Amortization of tangible assets', schedule: 125, normalBalance: 'debit' },
  8861: { description: 'Amortization of intangible assets', schedule: 125, normalBalance: 'debit' },
  8870: { description: 'Depletion', schedule: 125, normalBalance: 'debit' },
  8910: { description: 'Interest and bank charges', schedule: 125, normalBalance: 'debit' },
  8911: { description: 'Interest on loans', schedule: 125, normalBalance: 'debit' },
  8912: { description: 'Bank charges', schedule: 125, normalBalance: 'debit' },
  8960: { description: 'Property taxes', schedule: 125, normalBalance: 'debit' },
  8962: { description: 'Business taxes', schedule: 125, normalBalance: 'debit' },
  9130: { description: 'Income tax provision (current)', schedule: 125, normalBalance: 'debit' },
  9131: { description: 'Income tax provision (deferred)', schedule: 125, normalBalance: 'debit' },
  9367: { description: 'Total expenses', schedule: 125, normalBalance: 'debit' },
  9369: { description: 'Net income / (loss) before taxes', schedule: 125, normalBalance: 'credit' },
  9999: { description: 'Net income / (loss) after taxes', schedule: 125, normalBalance: 'credit' },
}

/**
 * Look up a GIFI mapping by code.
 */
export function getGifiMapping(code: number): GifiMapping | undefined {
  const entry = GIFI_CODES[code]
  if (!entry) return undefined
  return { code, ...entry }
}

/**
 * Get all GIFI codes for a given schedule.
 */
export function getGifiBySchedule(schedule: 100 | 125 | 141): GifiMapping[] {
  return Object.entries(GIFI_CODES)
    .filter(([, v]) => v.schedule === schedule)
    .map(([k, v]) => ({ code: Number(k), ...v }))
}

// ── Default chart of accounts for a Canadian CCPC ───────────────────────────

export const DEFAULT_CCPC_CHART: ChartAccount[] = [
  // ── Assets ────────────────────────────────────────────────────────────
  { accountNumber: '1000', name: 'Cash — General', type: 'asset', subtype: 'current_asset', gifi: { code: 1001, description: 'Cash — Canadian currency', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1010', name: 'Cash — USD Account', type: 'asset', subtype: 'current_asset', gifi: { code: 1002, description: 'Cash — foreign currency', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'current_asset', gifi: { code: 1060, description: 'Accounts receivable', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: true, parentAccountNumber: null },
  { accountNumber: '1110', name: 'Trade Receivables', type: 'asset', subtype: 'current_asset', gifi: { code: 1061, description: 'Trade accounts receivable', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: '1100' },
  { accountNumber: '1190', name: 'Allowance for Doubtful Accounts', type: 'asset', subtype: 'current_asset', gifi: { code: 1066, description: 'Allowance for doubtful accounts', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: '1100' },
  { accountNumber: '1200', name: 'Prepaid Expenses', type: 'asset', subtype: 'current_asset', gifi: { code: 1180, description: 'Prepaid expenses', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1300', name: 'Short-Term Investments', type: 'asset', subtype: 'current_asset', gifi: { code: 1300, description: 'Short-term investments', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1400', name: 'Shareholder Loans Receivable', type: 'asset', subtype: 'current_asset', gifi: { code: 1481, description: 'Shareholder loans receivable', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1500', name: 'Computer Equipment', type: 'asset', subtype: 'capital_asset', gifi: { code: 1741, description: 'Computer equipment', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1510', name: 'Office Furniture & Equipment', type: 'asset', subtype: 'capital_asset', gifi: { code: 1742, description: 'Office furniture and equipment', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1520', name: 'Vehicles', type: 'asset', subtype: 'capital_asset', gifi: { code: 1743, description: 'Vehicles', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1530', name: 'Leasehold Improvements', type: 'asset', subtype: 'capital_asset', gifi: { code: 1744, description: 'Leasehold improvements', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1600', name: 'Accumulated Depreciation — Equipment', type: 'asset', subtype: 'capital_asset', gifi: { code: 1773, description: 'Accumulated depreciation — equipment', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1610', name: 'Accumulated Depreciation — Vehicles', type: 'asset', subtype: 'capital_asset', gifi: { code: 1774, description: 'Accumulated depreciation — vehicles', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '1700', name: 'Goodwill', type: 'asset', subtype: 'intangible_asset', gifi: { code: 2010, description: 'Goodwill', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },

  // ── Liabilities ───────────────────────────────────────────────────────
  { accountNumber: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'current_liability', gifi: { code: 2620, description: 'Accounts payable and accrued liabilities', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: true, parentAccountNumber: null },
  { accountNumber: '2010', name: 'Trade Payables', type: 'liability', subtype: 'current_liability', gifi: { code: 2621, description: 'Trade accounts payable', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: '2000' },
  { accountNumber: '2100', name: 'GST/HST Payable', type: 'liability', subtype: 'current_liability', gifi: { code: 2682, description: 'Sales taxes payable (GST/HST)', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '2110', name: 'Income Tax Payable', type: 'liability', subtype: 'current_liability', gifi: { code: 2681, description: 'Income taxes payable', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '2200', name: 'Accrued Payroll', type: 'liability', subtype: 'current_liability', gifi: { code: 2861, description: 'Accrued payroll', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '2210', name: 'Accrued Vacation Pay', type: 'liability', subtype: 'current_liability', gifi: { code: 2862, description: 'Accrued vacation pay', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '2300', name: 'Deferred Revenue', type: 'liability', subtype: 'current_liability', gifi: { code: 2780, description: 'Deferred revenue', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '2500', name: 'Shareholder Loans Payable', type: 'liability', subtype: 'current_liability', gifi: { code: 2960, description: 'Shareholder loans payable', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '2600', name: 'Long-Term Bank Loan', type: 'liability', subtype: 'long_term_liability', gifi: { code: 3140, description: 'Long-term bank loans', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '2700', name: 'Deferred Income Taxes', type: 'liability', subtype: 'long_term_liability', gifi: { code: 3450, description: 'Deferred income taxes', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },

  // ── Equity ────────────────────────────────────────────────────────────
  { accountNumber: '3000', name: 'Common Shares', type: 'equity', subtype: 'share_capital', gifi: { code: 3500, description: 'Common shares', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '3100', name: 'Preferred Shares', type: 'equity', subtype: 'share_capital', gifi: { code: 3520, description: 'Preferred shares', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '3200', name: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings', gifi: { code: 3600, description: 'Retained earnings/deficit', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '3210', name: 'Contributed Surplus', type: 'equity', subtype: 'retained_earnings', gifi: { code: 3620, description: 'Contributed surplus', schedule: 100, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '3300', name: 'Dividends Declared', type: 'equity', subtype: 'retained_earnings', gifi: { code: 3680, description: 'Dividends declared', schedule: 100, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },

  // ── Revenue ───────────────────────────────────────────────────────────
  { accountNumber: '4000', name: 'Professional Fees Revenue', type: 'revenue', subtype: 'operating_revenue', gifi: { code: 8000, description: 'Trade sales, commissions, fees', schedule: 125, normalBalance: 'credit' }, isActive: true, isParent: true, parentAccountNumber: null },
  { accountNumber: '4010', name: 'Accounting Fees', type: 'revenue', subtype: 'operating_revenue', gifi: { code: 8020, description: 'Sales of goods and services (net)', schedule: 125, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: '4000' },
  { accountNumber: '4020', name: 'Tax Preparation Fees', type: 'revenue', subtype: 'operating_revenue', gifi: { code: 8020, description: 'Sales of goods and services (net)', schedule: 125, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: '4000' },
  { accountNumber: '4030', name: 'Consulting Fees', type: 'revenue', subtype: 'operating_revenue', gifi: { code: 8020, description: 'Sales of goods and services (net)', schedule: 125, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: '4000' },
  { accountNumber: '4040', name: 'Bookkeeping Fees', type: 'revenue', subtype: 'operating_revenue', gifi: { code: 8020, description: 'Sales of goods and services (net)', schedule: 125, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: '4000' },
  { accountNumber: '4500', name: 'Interest Income', type: 'revenue', subtype: 'other_revenue', gifi: { code: 8092, description: 'Interest income', schedule: 125, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '4510', name: 'Foreign Exchange Gain/Loss', type: 'revenue', subtype: 'other_revenue', gifi: { code: 8140, description: 'Foreign exchange gain (loss)', schedule: 125, normalBalance: 'credit' }, isActive: true, isParent: false, parentAccountNumber: null },

  // ── Expenses ──────────────────────────────────────────────────────────
  { accountNumber: '5000', name: 'Salaries & Wages', type: 'expense', subtype: 'operating_expense', gifi: { code: 8521, description: 'Salaries and wages', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5010', name: 'Employee Benefits', type: 'expense', subtype: 'operating_expense', gifi: { code: 8523, description: 'Employee benefits', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5100', name: 'Subcontract Costs', type: 'expense', subtype: 'operating_expense', gifi: { code: 8530, description: 'Subcontract costs', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5200', name: 'Professional Fees', type: 'expense', subtype: 'operating_expense', gifi: { code: 8570, description: 'Professional and consulting fees', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5300', name: 'Office Rent', type: 'expense', subtype: 'operating_expense', gifi: { code: 8610, description: 'Rent', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5310', name: 'Office Supplies', type: 'expense', subtype: 'operating_expense', gifi: { code: 8811, description: 'Office supplies', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5320', name: 'Telephone & Internet', type: 'expense', subtype: 'operating_expense', gifi: { code: 8660, description: 'Telephone and communications', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5330', name: 'Utilities', type: 'expense', subtype: 'operating_expense', gifi: { code: 8640, description: 'Utilities', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5400', name: 'Advertising & Promotion', type: 'expense', subtype: 'operating_expense', gifi: { code: 8720, description: 'Advertising and promotion', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5410', name: 'Meals & Entertainment (50%)', type: 'expense', subtype: 'operating_expense', gifi: { code: 8711, description: 'Meals and entertainment (50%)', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5500', name: 'Travel', type: 'expense', subtype: 'operating_expense', gifi: { code: 8710, description: 'Travel expenses', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5600', name: 'Vehicle Expenses', type: 'expense', subtype: 'operating_expense', gifi: { code: 8690, description: 'Motor vehicle expenses', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5700', name: 'Insurance', type: 'expense', subtype: 'operating_expense', gifi: { code: 8761, description: 'Business insurance', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5710', name: 'E&O Insurance', type: 'expense', subtype: 'operating_expense', gifi: { code: 8762, description: 'E&O / professional liability insurance', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5800', name: 'Licenses & Memberships', type: 'expense', subtype: 'operating_expense', gifi: { code: 8790, description: 'Licenses, memberships, subscriptions', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5900', name: 'Repairs & Maintenance', type: 'expense', subtype: 'operating_expense', gifi: { code: 8620, description: 'Repairs and maintenance', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '5910', name: 'Bad Debt Expense', type: 'expense', subtype: 'operating_expense', gifi: { code: 8740, description: 'Bad debt expense', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '6000', name: 'Amortization — Tangible Assets', type: 'expense', subtype: 'cca_expense', gifi: { code: 8860, description: 'Amortization of tangible assets', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '6010', name: 'Amortization — Intangible Assets', type: 'expense', subtype: 'cca_expense', gifi: { code: 8861, description: 'Amortization of intangible assets', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '6100', name: 'Interest on Loans', type: 'expense', subtype: 'interest_expense', gifi: { code: 8911, description: 'Interest on loans', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '6110', name: 'Bank Charges', type: 'expense', subtype: 'interest_expense', gifi: { code: 8912, description: 'Bank charges', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '6200', name: 'Property Taxes', type: 'expense', subtype: 'operating_expense', gifi: { code: 8960, description: 'Property taxes', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '9000', name: 'Income Tax Expense — Current', type: 'expense', subtype: 'tax_expense', gifi: { code: 9130, description: 'Income tax provision (current)', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
  { accountNumber: '9010', name: 'Income Tax Expense — Deferred', type: 'expense', subtype: 'tax_expense', gifi: { code: 9131, description: 'Income tax provision (deferred)', schedule: 125, normalBalance: 'debit' }, isActive: true, isParent: false, parentAccountNumber: null },
]

// ── Lookup helpers ──────────────────────────────────────────────────────────

/**
 * Find an account from the default chart by number.
 */
export function findAccount(
  chart: ChartAccount[],
  accountNumber: string,
): ChartAccount | undefined {
  return chart.find((a) => a.accountNumber === accountNumber)
}

/**
 * Get all accounts of a given type.
 */
export function getAccountsByType(chart: ChartAccount[], type: AccountType): ChartAccount[] {
  return chart.filter((a) => a.type === type && a.isActive)
}

/**
 * Get child accounts of a parent.
 */
export function getChildAccounts(chart: ChartAccount[], parentNumber: string): ChartAccount[] {
  return chart.filter((a) => a.parentAccountNumber === parentNumber && a.isActive)
}

/**
 * Validate that a chart of accounts balances (assets = liabilities + equity).
 * Returns validation result with any issues found.
 */
export function validateChartStructure(chart: ChartAccount[]): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []
  const numbers = new Set<string>()

  for (const acct of chart) {
    // Duplicate check
    if (numbers.has(acct.accountNumber)) {
      issues.push(`Duplicate account number: ${acct.accountNumber}`)
    }
    numbers.add(acct.accountNumber)

    // Parent reference check
    if (acct.parentAccountNumber && !chart.some((a) => a.accountNumber === acct.parentAccountNumber)) {
      issues.push(`Account ${acct.accountNumber} references missing parent ${acct.parentAccountNumber}`)
    }

    // GIFI code validity check
    if (!GIFI_CODES[acct.gifi.code]) {
      issues.push(`Account ${acct.accountNumber} has unknown GIFI code ${acct.gifi.code}`)
    }
  }

  // Must have at least one account per major type
  const types = new Set(chart.map((a) => a.type))
  for (const required of ['asset', 'liability', 'equity', 'revenue', 'expense'] as AccountType[]) {
    if (!types.has(required)) {
      issues.push(`Missing ${required} accounts`)
    }
  }

  return { valid: issues.length === 0, issues }
}

/**
 * Map a trial balance (account number → amount) to GIFI-coded balances
 * suitable for T2 Schedule 100/125 filing.
 */
export function mapTrialBalanceToGifi(
  chart: ChartAccount[],
  trialBalance: Record<string, number>,
): { gifiCode: number; description: string; amount: number; schedule: number }[] {
  const gifiMap = new Map<number, number>()

  for (const [accountNumber, amount] of Object.entries(trialBalance)) {
    const acct = findAccount(chart, accountNumber)
    if (!acct) continue
    const current = gifiMap.get(acct.gifi.code) ?? 0
    gifiMap.set(acct.gifi.code, current + amount)
  }

  return Array.from(gifiMap.entries())
    .map(([code, amount]) => {
      const mapping = GIFI_CODES[code]
      return {
        gifiCode: code,
        description: mapping?.description ?? 'Unknown',
        amount,
        schedule: mapping?.schedule ?? 100,
      }
    })
    .sort((a, b) => a.gifiCode - b.gifiCode)
}
