/**
 * @nzila/qbo — Chart of Accounts mapping (Nzila ↔ QBO)
 *
 * Bidirectional mapping between Nzila's internal account taxonomy
 * and QBO chart of accounts. Detects mapping drift and provides
 * auto-resolution for common Canadian accounting categories.
 *
 * @module @nzila/qbo/coa-mapping
 */
import type { QboClient } from './client'
import { qboAccounts } from './client'
import type { QboAccount, AccountClassification, AccountType } from './types'

// ── Nzila standard account categories ────────────────────────────────────────

export type NzilaAccountCategory =
  | 'cash'
  | 'accounts-receivable'
  | 'accounts-payable'
  | 'revenue'
  | 'cogs'
  | 'operating-expense'
  | 'payroll-expense'
  | 'tax-expense'
  | 'interest-expense'
  | 'depreciation'
  | 'rd-expense'
  | 'fixed-asset'
  | 'other-current-asset'
  | 'long-term-liability'
  | 'equity'
  | 'retained-earnings'
  | 'other-income'
  | 'other-expense'

export interface CoaMapping {
  nzilaCategory: NzilaAccountCategory
  qboAccountId: string
  qboAccountName: string
  qboClassification: AccountClassification
  qboAccountType: AccountType
  confidence: 'exact' | 'inferred' | 'manual'
  lastSyncedAt: string
}

export interface CoaMappingResult {
  mapped: CoaMapping[]
  unmappedNzila: NzilaAccountCategory[]
  unmappedQbo: QboAccount[]
  drifts: CoaDrift[]
}

export interface CoaDrift {
  nzilaCategory: NzilaAccountCategory
  field: string
  expectedValue: string
  actualValue: string
  qboAccountId: string
}

// ── Default mapping rules ────────────────────────────────────────────────────

const DEFAULT_MAPPING_RULES: Record<NzilaAccountCategory, {
  classifications: AccountClassification[]
  accountTypes: AccountType[]
  namePatterns: RegExp[]
}> = {
  'cash':                { classifications: ['Asset'],     accountTypes: ['Bank'],                    namePatterns: [/bank|cash|chequing|checking|savings/i] },
  'accounts-receivable': { classifications: ['Asset'],     accountTypes: ['Accounts Receivable'],     namePatterns: [/receivable|a\/r|ar/i] },
  'accounts-payable':    { classifications: ['Liability'], accountTypes: ['Accounts Payable'],        namePatterns: [/payable|a\/p|ap/i] },
  'revenue':             { classifications: ['Revenue'],   accountTypes: ['Income'],                  namePatterns: [/revenue|sales|income|service/i] },
  'cogs':                { classifications: ['Expense'],   accountTypes: ['Cost of Goods Sold'],      namePatterns: [/cost of (goods|sales)|cogs/i] },
  'operating-expense':   { classifications: ['Expense'],   accountTypes: ['Expense'],                 namePatterns: [/operating|office|rent|utilities|insurance/i] },
  'payroll-expense':     { classifications: ['Expense'],   accountTypes: ['Expense'],                 namePatterns: [/payroll|salary|wages|benefits|cpp|ei/i] },
  'tax-expense':         { classifications: ['Expense'],   accountTypes: ['Expense'],                 namePatterns: [/tax|income tax|corporate tax/i] },
  'interest-expense':    { classifications: ['Expense'],   accountTypes: ['Expense', 'Other Expense'], namePatterns: [/interest expense|loan interest/i] },
  'depreciation':        { classifications: ['Expense'],   accountTypes: ['Expense', 'Other Expense'], namePatterns: [/depreciation|amortization|cca/i] },
  'rd-expense':          { classifications: ['Expense'],   accountTypes: ['Expense'],                 namePatterns: [/r&d|research|development|sr&ed|sred/i] },
  'fixed-asset':         { classifications: ['Asset'],     accountTypes: ['Fixed Asset'],              namePatterns: [/equipment|furniture|vehicle|computer|leasehold/i] },
  'other-current-asset': { classifications: ['Asset'],     accountTypes: ['Other Current Asset'],      namePatterns: [/prepaid|deposit|inventory/i] },
  'long-term-liability': { classifications: ['Liability'], accountTypes: ['Long Term Liability'],      namePatterns: [/loan|mortgage|note payable/i] },
  'equity':              { classifications: ['Equity'],    accountTypes: ['Equity'],                   namePatterns: [/equity|capital|share|common/i] },
  'retained-earnings':   { classifications: ['Equity'],    accountTypes: ['Equity'],                   namePatterns: [/retained|accumulated/i] },
  'other-income':        { classifications: ['Revenue'],   accountTypes: ['Other Income'],             namePatterns: [/other income|gain|interest income/i] },
  'other-expense':       { classifications: ['Expense'],   accountTypes: ['Other Expense'],            namePatterns: [/other expense|loss|write-off/i] },
}

// ── Core mapping functions ───────────────────────────────────────────────────

/**
 * Auto-map a QBO account to a Nzila category based on type + name pattern matching.
 */
export function inferNzilaCategory(account: QboAccount): { category: NzilaAccountCategory; confidence: 'exact' | 'inferred' } | null {
  // Pass 1: exact match by account type
  for (const [category, rules] of Object.entries(DEFAULT_MAPPING_RULES)) {
    if (
      rules.classifications.includes(account.Classification) &&
      rules.accountTypes.includes(account.AccountType)
    ) {
      // Check name pattern for higher confidence
      const nameMatch = rules.namePatterns.some((p) => p.test(account.Name) || p.test(account.FullyQualifiedName))
      return {
        category: category as NzilaAccountCategory,
        confidence: nameMatch ? 'exact' : 'inferred',
      }
    }
  }

  // Pass 2: name-only matching (for miscategorized accounts)
  for (const [category, rules] of Object.entries(DEFAULT_MAPPING_RULES)) {
    const nameMatch = rules.namePatterns.some((p) => p.test(account.Name) || p.test(account.FullyQualifiedName))
    if (nameMatch) {
      return { category: category as NzilaAccountCategory, confidence: 'inferred' }
    }
  }

  return null
}

/**
 * Build a complete CoA mapping between Nzila categories and QBO accounts.
 * Fetches all active QBO accounts and auto-maps them.
 */
export async function buildCoaMapping(qbo: QboClient): Promise<CoaMappingResult> {
  const qboAccountsList = await qboAccounts.list(qbo, "WHERE Active = true")
  const now = new Date().toISOString()

  const mapped: CoaMapping[] = []
  const usedCategories = new Set<NzilaAccountCategory>()
  const mappedQboIds = new Set<string>()

  // Auto-map each QBO account
  for (const account of qboAccountsList) {
    const inference = inferNzilaCategory(account)
    if (inference && !usedCategories.has(inference.category)) {
      mapped.push({
        nzilaCategory: inference.category,
        qboAccountId: account.Id,
        qboAccountName: account.Name,
        qboClassification: account.Classification,
        qboAccountType: account.AccountType,
        confidence: inference.confidence,
        lastSyncedAt: now,
      })
      usedCategories.add(inference.category)
      mappedQboIds.add(account.Id)
    }
  }

  const allCategories = Object.keys(DEFAULT_MAPPING_RULES) as NzilaAccountCategory[]
  const unmappedNzila = allCategories.filter((c) => !usedCategories.has(c))
  const unmappedQbo = qboAccountsList.filter((a) => !mappedQboIds.has(a.Id))

  return { mapped, unmappedNzila, unmappedQbo, drifts: [] }
}

/**
 * Map a specific Nzila category to a QBO account ID (manual override).
 */
export function createManualMapping(
  nzilaCategory: NzilaAccountCategory,
  account: QboAccount,
): CoaMapping {
  return {
    nzilaCategory,
    qboAccountId: account.Id,
    qboAccountName: account.Name,
    qboClassification: account.Classification,
    qboAccountType: account.AccountType,
    confidence: 'manual',
    lastSyncedAt: new Date().toISOString(),
  }
}

/**
 * Detect drift between an existing mapping and the current QBO state.
 * Returns drift entries for any account whose name or type has changed.
 */
export async function detectMappingDrifts(
  qbo: QboClient,
  existingMappings: CoaMapping[],
): Promise<CoaDrift[]> {
  const drifts: CoaDrift[] = []

  for (const mapping of existingMappings) {
    try {
      const current = await qbo.get<QboAccount>('Account', mapping.qboAccountId)

      if (current.Name !== mapping.qboAccountName) {
        drifts.push({
          nzilaCategory: mapping.nzilaCategory,
          field: 'Name',
          expectedValue: mapping.qboAccountName,
          actualValue: current.Name,
          qboAccountId: mapping.qboAccountId,
        })
      }

      if (current.AccountType !== mapping.qboAccountType) {
        drifts.push({
          nzilaCategory: mapping.nzilaCategory,
          field: 'AccountType',
          expectedValue: mapping.qboAccountType,
          actualValue: current.AccountType,
          qboAccountId: mapping.qboAccountId,
        })
      }

      if (!current.Active) {
        drifts.push({
          nzilaCategory: mapping.nzilaCategory,
          field: 'Active',
          expectedValue: 'true',
          actualValue: 'false',
          qboAccountId: mapping.qboAccountId,
        })
      }
    } catch {
      drifts.push({
        nzilaCategory: mapping.nzilaCategory,
        field: 'Existence',
        expectedValue: 'exists',
        actualValue: 'deleted or inaccessible',
        qboAccountId: mapping.qboAccountId,
      })
    }
  }

  return drifts
}

/**
 * Sync the chart of accounts: build mapping, detect drifts, return full result.
 */
export async function syncChartOfAccounts(
  qbo: QboClient,
  existingMappings: CoaMapping[] = [],
): Promise<CoaMappingResult> {
  const result = await buildCoaMapping(qbo)

  if (existingMappings.length > 0) {
    result.drifts = await detectMappingDrifts(qbo, existingMappings)
  }

  return result
}
