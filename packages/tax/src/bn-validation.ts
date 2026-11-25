/**
 * @nzila/tax — CRA Business Number validation
 *
 * Validates Canadian Business Numbers (BN) and program account numbers
 * against CRA-published format rules plus legacy local validation policy.
 * Passing validation does not establish assignment or registration. The retained
 * Luhn and nonzero-reference restrictions have not been corroborated by a
 * current authoritative CRA specification; do not label them CRA-verified.
 *
 * Sources:
 * - CRA RC2 guide: "The Business Number and Your CRA Program Accounts"
 * - BN format: 9 digits; Luhn is retained local policy, not an attested CRA rule
 * - Program account: BN + 2-letter program ID + 4-digit reference number
 *   e.g. 123456789 RC 0001
 *
 *   Program IDs:
 *     RC — Corporate income tax
 *     RP — Payroll deductions
 *     RT — GST/HST
 *     RR — Registered charity
 *     RM — Import/export
 *     RZ — Information returns
 *     RD — Excise duties
 *     RE — Excise tax
 */
import { z } from 'zod'

// ── Valid CRA program identifier codes ──────────────────────────────────────

export const CRA_PROGRAM_IDS = [
  'RC', // Corporate income tax
  'RP', // Payroll deductions
  'RT', // GST/HST
  'RR', // Registered charity
  'RM', // Import/export
  'RZ', // Information returns
  'RD', // Excise duties
  'RE', // Excise tax
  'RG', // Air travellers security charge
  'RN', // Insurance premium tax
  'LT', // Luxury tax
  'RU', // Underused housing tax
  'PT', // Global minimum tax
] as const

export type CraProgramId = (typeof CRA_PROGRAM_IDS)[number]

// ── Luhn check ──────────────────────────────────────────────────────────────

/**
 * Validate a 9-digit BN using the Luhn algorithm (mod-10).
 * This legacy local check is not currently verified as an authoritative CRA rule.
 * Source for the format/program list (not this checksum policy):
 * https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/business-registration/business-number-program-account/need-program-accounts.html
 */
function luhnCheck(digits: string): boolean {
  let sum = 0
  let alternate = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

// ── Validation results ──────────────────────────────────────────────────────

export interface BnValidationResult {
  valid: boolean
  bn9?: string           // The 9-digit root BN
  programId?: CraProgramId
  referenceNumber?: string // 4-digit reference
  errors: string[]
}

// ── Core validators ─────────────────────────────────────────────────────────

/**
 * Validate a 9-digit CRA Business Number.
 * Accepts formats: "123456789", "123 456 789", "123-456-789"
 */
export function validateBusinessNumber(input: string): BnValidationResult {
  const cleaned = input.replace(/[\s\-]/g, '')
  const errors: string[] = []

  if (!/^\d{9}$/.test(cleaned)) {
    errors.push('Business Number must be exactly 9 digits')
    return { valid: false, errors }
  }

  if (!luhnCheck(cleaned)) {
    errors.push('Business Number fails Luhn check digit validation')
    return { valid: false, bn9: cleaned, errors }
  }

  return { valid: true, bn9: cleaned, errors: [] }
}

/**
 * Validate a full CRA program account number.
 * Format: 123456789 RC 0001 (or variations with/without spaces/dashes)
 */
export function validateProgramAccount(input: string): BnValidationResult {
  const cleaned = input.replace(/[\s\-]/g, '').toUpperCase()
  const errors: string[] = []

  // Expected: 9 digits + 2 letters + 4 digits = 15 chars
  const match = /^(\d{9})([A-Z]{2})(\d{4})$/.exec(cleaned)
  if (!match) {
    errors.push('Program account must be 9 digits + 2-letter program ID + 4-digit reference (e.g. 123456789RC0001)')
    return { valid: false, errors }
  }

  const [, bn9, programId, refNum] = match

  // Validate BN root
  if (!luhnCheck(bn9)) {
    errors.push('Business Number portion fails Luhn check digit validation')
  }

  // Validate program ID
  if (!CRA_PROGRAM_IDS.includes(programId as CraProgramId)) {
    errors.push(`Unknown CRA program ID "${programId}". Valid IDs: ${CRA_PROGRAM_IDS.join(', ')}`)
  }

  // Retained local policy: nonzero reference. Not independently CRA-attested.
  const refInt = parseInt(refNum, 10)
  if (refInt < 1) {
    errors.push('Reference number must be 0001 or higher')
  }

  return {
    valid: errors.length === 0,
    bn9,
    programId: programId as CraProgramId,
    referenceNumber: refNum,
    errors,
  }
}

/**
 * Format a BN for display: "123 456 789" or "123 456 789 RC 0001"
 */
export function formatBusinessNumber(bn9: string, programId?: string, refNum?: string): string {
  const formatted = `${bn9.slice(0, 3)} ${bn9.slice(3, 6)} ${bn9.slice(6, 9)}`
  if (programId && refNum) {
    return `${formatted} ${programId} ${refNum}`
  }
  return formatted
}

// ── Zod schemas for form validation ─────────────────────────────────────────

/** Zod schema that validates a 9-digit BN with Luhn check */
export const BusinessNumberSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-]/g, ''))
  .refine((v) => /^\d{9}$/.test(v), { message: 'Business Number must be exactly 9 digits' })
  .refine((v) => luhnCheck(v), { message: 'Invalid Business Number check digit' })

/** Zod schema for a full program account (BN + program ID + ref) */
export const ProgramAccountSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-]/g, '').toUpperCase())
  .refine((v) => /^\d{9}[A-Z]{2}\d{4}$/.test(v), {
    message: 'Format: 9 digits + 2-letter program ID + 4-digit reference',
  })
  .refine(
    (v) => {
      const bn9 = v.slice(0, 9)
      return luhnCheck(bn9)
    },
    { message: 'Invalid Business Number check digit' },
  )
  .refine(
    (v) => {
      const programId = v.slice(9, 11)
      return CRA_PROGRAM_IDS.includes(programId as CraProgramId)
    },
    { message: 'Unknown CRA program identifier' },
  )
  .refine((v) => Number(v.slice(11)) >= 1, { message: 'Reference number must be 0001 or higher' })

/**
 * Validate a Quebec Enterprise Number (NEQ) — 10 digits.
 * Used alongside BN for Quebec orgs registered with Revenu Québec.
 */
export function validateNeq(input: string): { valid: boolean; neq?: string; errors: string[] } {
  const cleaned = input.replace(/[\s\-]/g, '')
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, errors: ['NEQ must be exactly 10 digits'] }
  }
  return { valid: true, neq: cleaned, errors: [] }
}
