/**
 * @nzila/cfo-core — Financial Validation Gates
 *
 * Pre-report validation layer. Ensures all required inputs are present,
 * no conflicting entries exist, and time ranges are consistent before
 * any financial computation is allowed to proceed.
 *
 * Throws FINANCIAL_VALIDATION_FAILED if any gate fails.
 *
 * @module @nzila/cfo-core/validation
 */

import { z } from 'zod'

// ── Error ───────────────────────────────────────────────────────────────────

export class FinancialValidationError extends Error {
  public readonly code = 'FINANCIAL_VALIDATION_FAILED' as const
  public readonly failures: ValidationFailure[]

  constructor(failures: ValidationFailure[]) {
    super(
      `Financial validation failed: ${failures.map((f) => f.message).join('; ')}`,
    )
    this.name = 'FinancialValidationError'
    this.failures = failures
  }
}

export interface ValidationFailure {
  gate: string
  message: string
  field?: string
}

// ── Gate results ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  failures: ValidationFailure[]
}

// ── Input schemas consumed by gates ─────────────────────────────────────────

const PeriodSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const EntrySchema = z.object({
  account: z.string().min(1),
  amount: z.number(),
  type: z.enum(['debit', 'credit']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// ── Gate functions ──────────────────────────────────────────────────────────

/**
 * Gate 1: Required inputs — orgId, reportId, period, and at least one entry.
 */
export function validateRequiredInputs(params: {
  orgId?: string
  reportId?: string
  period?: { start: string; end: string }
  entries?: unknown[]
}): ValidationResult {
  const failures: ValidationFailure[] = []

  if (!params.orgId || params.orgId.trim() === '') {
    failures.push({ gate: 'required-inputs', message: 'orgId is required', field: 'orgId' })
  }
  if (!params.reportId || params.reportId.trim() === '') {
    failures.push({ gate: 'required-inputs', message: 'reportId is required', field: 'reportId' })
  }
  if (!params.period) {
    failures.push({ gate: 'required-inputs', message: 'period is required', field: 'period' })
  } else {
    const parsed = PeriodSchema.safeParse(params.period)
    if (!parsed.success) {
      failures.push({
        gate: 'required-inputs',
        message: 'period.start and period.end must be YYYY-MM-DD',
        field: 'period',
      })
    }
  }
  if (!params.entries || params.entries.length === 0) {
    failures.push({ gate: 'required-inputs', message: 'At least one entry is required', field: 'entries' })
  }

  return { valid: failures.length === 0, failures }
}

/**
 * Gate 2: Entry schema — every entry must conform to { account, amount, type, date }.
 */
export function validateEntrySchemas(entries: unknown[]): ValidationResult {
  const failures: ValidationFailure[] = []

  for (let i = 0; i < entries.length; i++) {
    const parsed = EntrySchema.safeParse(entries[i])
    if (!parsed.success) {
      failures.push({
        gate: 'entry-schema',
        message: `Entry ${i}: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        field: `entries[${i}]`,
      })
    }
  }

  return { valid: failures.length === 0, failures }
}

/**
 * Gate 3: Time range consistency — all entry dates must fall within the period.
 */
export function validateTimeRange(
  period: { start: string; end: string },
  entries: { date: string }[],
): ValidationResult {
  const failures: ValidationFailure[] = []
  const startTs = new Date(period.start).getTime()
  const endTs = new Date(period.end).getTime()

  if (startTs >= endTs) {
    failures.push({
      gate: 'time-range',
      message: `Period start (${period.start}) must be before end (${period.end})`,
      field: 'period',
    })
    return { valid: false, failures }
  }

  for (let i = 0; i < entries.length; i++) {
    const ts = new Date(entries[i].date).getTime()
    if (ts < startTs || ts > endTs) {
      failures.push({
        gate: 'time-range',
        message: `Entry ${i} date ${entries[i].date} is outside period ${period.start}..${period.end}`,
        field: `entries[${i}].date`,
      })
    }
  }

  return { valid: failures.length === 0, failures }
}

/**
 * Gate 4: No duplicate entries — same account + date + amount + type.
 */
export function validateNoDuplicates(
  entries: { account: string; amount: number; type: string; date: string }[],
): ValidationResult {
  const failures: ValidationFailure[] = []
  const seen = new Set<string>()

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const key = `${e.account}|${e.amount}|${e.type}|${e.date}`
    if (seen.has(key)) {
      failures.push({
        gate: 'no-duplicates',
        message: `Duplicate entry ${i}: ${e.account} ${e.type} ${e.amount} on ${e.date}`,
        field: `entries[${i}]`,
      })
    }
    seen.add(key)
  }

  return { valid: failures.length === 0, failures }
}

/**
 * Gate 5: Amounts must be finite, non-negative numbers.
 */
export function validateAmounts(
  entries: { amount: number }[],
): ValidationResult {
  const failures: ValidationFailure[] = []

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i].amount
    if (!Number.isFinite(a) || a < 0) {
      failures.push({
        gate: 'valid-amounts',
        message: `Entry ${i} has invalid amount: ${a} (must be finite and non-negative)`,
        field: `entries[${i}].amount`,
      })
    }
  }

  return { valid: failures.length === 0, failures }
}

// ── Composite gate ──────────────────────────────────────────────────────────

/**
 * Run all validation gates on a P&L-style input. Throws
 * FINANCIAL_VALIDATION_FAILED if any gate fails.
 */
export function runValidationGates(params: {
  orgId: string
  reportId: string
  period: { start: string; end: string }
  entries: { account: string; amount: number; type: 'debit' | 'credit'; date: string }[]
}): void {
  const allFailures: ValidationFailure[] = []

  const gates = [
    validateRequiredInputs(params),
    validateEntrySchemas(params.entries),
    validateTimeRange(params.period, params.entries),
    validateNoDuplicates(params.entries),
    validateAmounts(params.entries),
  ]

  for (const result of gates) {
    allFailures.push(...result.failures)
  }

  if (allFailures.length > 0) {
    throw new FinancialValidationError(allFailures)
  }
}
