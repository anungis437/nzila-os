/**
 * @nzila/tax — Bulk Business Number validation
 *
 * Batch validators for CSV imports and mass onboarding.
 * Wraps the core bn-validation.ts functions with:
 * - Array-based batch processing
 * - Summary statistics
 * - Validation audit log structure
 *
 * Sources:
 * - CRA RC2: Business Number format & program accounts
 * - CRA "Confirming a GST/HST account number" (RT verification)
 *
 * @module @nzila/tax/bn-validation-bulk
 */
import {
  validateBusinessNumber,
  validateProgramAccount,
  validateNeq,
  formatBusinessNumber,
  type BnValidationResult,
  type CraProgramId,
  CRA_PROGRAM_IDS,
} from './bn-validation'

// ── Bulk validation ─────────────────────────────────────────────────────────

export interface BulkValidationItem {
  /** Original input string */
  input: string
  /** Row index / line number (for CSV error reporting) */
  rowIndex: number
  /** Validation result */
  result: BnValidationResult
  /** Formatted display string (if valid) */
  formatted: string | null
}

export interface BulkValidationSummary {
  /** Total inputs processed */
  total: number
  /** Count of valid BNs */
  valid: number
  /** Count of invalid BNs */
  invalid: number
  /** Count of duplicates (same BN9 appearing multiple times) */
  duplicates: number
  /** List of unique BN9s found */
  uniqueBn9s: string[]
  /** Validation rate (valid / total) */
  validationRate: number
}

export interface BulkValidationResult {
  items: BulkValidationItem[]
  summary: BulkValidationSummary
}

/**
 * Validate an array of Business Numbers in batch.
 * Returns individual results + aggregate statistics.
 */
export function validateBusinessNumbers(inputs: string[]): BulkValidationResult {
  const items: BulkValidationItem[] = []
  const bn9Set = new Set<string>()
  let valid = 0
  let duplicates = 0

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i].trim()
    if (!input) continue

    const result = validateBusinessNumber(input)
    const formatted = result.valid && result.bn9 ? formatBusinessNumber(result.bn9) : null

    if (result.valid && result.bn9) {
      if (bn9Set.has(result.bn9)) {
        duplicates++
      }
      bn9Set.add(result.bn9)
      valid++
    }

    items.push({ input, rowIndex: i, result, formatted })
  }

  return {
    items,
    summary: {
      total: items.length,
      valid,
      invalid: items.length - valid,
      duplicates,
      uniqueBn9s: Array.from(bn9Set),
      validationRate: items.length > 0 ? Math.round((valid / items.length) * 10000) / 10000 : 0,
    },
  }
}

/**
 * Validate an array of full program accounts (BN + program ID + reference) in batch.
 */
export function validateProgramAccounts(inputs: string[]): BulkValidationResult {
  const items: BulkValidationItem[] = []
  const bn9Set = new Set<string>()
  let valid = 0
  let duplicates = 0

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i].trim()
    if (!input) continue

    const result = validateProgramAccount(input)
    const formatted = result.valid && result.bn9 && result.programId && result.referenceNumber
      ? formatBusinessNumber(result.bn9, result.programId, result.referenceNumber)
      : null

    if (result.valid && result.bn9) {
      const key = `${result.bn9}${result.programId}${result.referenceNumber}`
      if (bn9Set.has(key)) {
        duplicates++
      }
      bn9Set.add(key)
      valid++
    }

    items.push({ input, rowIndex: i, result, formatted })
  }

  return {
    items,
    summary: {
      total: items.length,
      valid,
      invalid: items.length - valid,
      duplicates,
      uniqueBn9s: Array.from(bn9Set),
      validationRate: items.length > 0 ? Math.round((valid / items.length) * 10000) / 10000 : 0,
    },
  }
}

/**
 * Validate an array of Quebec NEQ numbers in batch.
 */
export function validateNeqs(inputs: string[]): BulkValidationResult {
  const items: BulkValidationItem[] = []
  const neqSet = new Set<string>()
  let valid = 0
  let duplicates = 0

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i].trim()
    if (!input) continue
    const result = validateNeq(input)
    const formatted = result.valid && result.neq ? result.neq : null

    if (result.valid && result.neq) {
      if (neqSet.has(result.neq)) {
        duplicates++
      }
      neqSet.add(result.neq)
      valid++
    }

    // Adapt NEQ result to BnValidationResult shape for type compatibility
    items.push({
      input,
      rowIndex: i,
      result: {
        valid: result.valid,
        errors: result.errors,
        bn9: result.neq,
      },
      formatted,
    })
  }

  return {
    items,
    summary: {
      total: items.length,
      valid,
      invalid: items.length - valid,
      duplicates,
      uniqueBn9s: Array.from(neqSet),
      validationRate: items.length > 0 ? Math.round((valid / items.length) * 10000) / 10000 : 0,
    },
  }
}

// ── Validation audit log ────────────────────────────────────────────────────

export interface BnValidationAuditEntry {
  /** Timestamp of validation */
  timestamp: string
  /** Input that was validated */
  input: string
  /** Validation type */
  type: 'bn9' | 'program-account' | 'neq'
  /** Whether it passed */
  valid: boolean
  /** BN9 root (if extractable) */
  bn9: string | null
  /** Program ID (if applicable) */
  programId: CraProgramId | null
  /** Actor who triggered the validation */
  actorId: string
  /** Errors (if any) */
  errors: string[]
}

/**
 * Build an audit entry for a BN validation event.
 * For compliance logging — track who validated what and when.
 */
export function buildValidationAuditEntry(
  input: string,
  type: BnValidationAuditEntry['type'],
  result: BnValidationResult | { valid: boolean; neq?: string; errors: string[] },
  actorId: string,
): BnValidationAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    input,
    type,
    valid: result.valid,
    bn9: 'bn9' in result ? (result.bn9 ?? null) : null,
    programId: 'programId' in result ? ((result.programId as CraProgramId) ?? null) : null,
    actorId,
    errors: result.errors,
  }
}

// ── Program account discovery helper ────────────────────────────────────────

/**
 * For a given BN9, generate all possible program account numbers.
 * Useful for suggesting which accounts to verify with CRA.
 *
 * Note: This generates FORMAT-valid combos, not CRA-confirmed accounts.
 * Actual verification requires CRA's "Confirming a GST/HST account" service
 * or direct CRA correspondence.
 */
export interface ProgramAccountSuggestion {
  programAccount: string
  programId: CraProgramId
  description: string
  formatted: string
}

export function generatePossibleProgramAccounts(bn9: string): ProgramAccountSuggestion[] {
  const bnResult = validateBusinessNumber(bn9)
  if (!bnResult.valid || !bnResult.bn9) return []

  const descriptions: Record<CraProgramId, string> = {
    RC: 'Corporate Income Tax',
    RP: 'Payroll Deductions',
    RT: 'GST/HST',
    RR: 'Registered Charity',
    RM: 'Import/Export',
    RZ: 'Information Returns',
    RD: 'Excise Duties',
    RE: 'Excise Tax',
    RG: 'Air Travellers Security Charge',
    RN: 'Insurance Premium Tax',
    LT: 'Luxury Tax',
    RU: 'Underused Housing Tax',
    PT: 'Global Minimum Tax',
  }

  return CRA_PROGRAM_IDS.map((pid) => ({
    programAccount: `${bnResult.bn9}${pid}0001`,
    programId: pid,
    description: descriptions[pid],
    formatted: formatBusinessNumber(bnResult.bn9!, pid, '0001'),
  }))
}
