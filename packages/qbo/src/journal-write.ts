/**
 * @nzila/qbo — High-level journal entry write-back helpers
 *
 * Wraps the generic QBO `client.create('JournalEntry', ...)` with
 * domain-specific helpers for common Canadian accounting scenarios:
 * - Standard journal entries (multi-line debit/credit)
 * - Adjusting entries (month-end / year-end)
 * - Reversing entries (auto-reverse next period)
 * - Tax accrual entries
 *
 * @module @nzila/qbo/journal-write
 */
import type { QboClient } from './client'
import type { QboJournalEntry, QboJournalLine, QboRef } from './types'

// ── Input types ──────────────────────────────────────────────────────────────

export interface JournalLineInput {
  accountId: string
  accountName?: string
  amount: number
  type: 'debit' | 'credit'
  description?: string
  classId?: string
  className?: string
  departmentId?: string
  departmentName?: string
  /** Optional entity (Customer, Vendor, Employee) */
  entity?: {
    type: 'Customer' | 'Vendor' | 'Employee'
    id: string
    name?: string
  }
}

export interface JournalEntryInput {
  txnDate: string // YYYY-MM-DD
  lines: JournalLineInput[]
  memo?: string
  /** Optional: used for adjusting/reversing entry categorization */
  entryType?: 'standard' | 'adjusting' | 'reversing' | 'tax-accrual'
}

export interface PostedJournalEntry {
  id: string
  txnDate: string
  totalDebit: number
  totalCredit: number
  lineCount: number
  entryType: string
  raw: QboJournalEntry
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toQboRef(id: string, name?: string): QboRef {
  return name ? { value: id, name } : { value: id }
}

function buildQboLine(input: JournalLineInput): QboJournalLine {
  const line: QboJournalLine = {
    Amount: Math.abs(input.amount),
    DetailType: 'JournalEntryLineDetail',
    Description: input.description,
    JournalEntryLineDetail: {
      PostingType: input.type === 'debit' ? 'Debit' : 'Credit',
      AccountRef: toQboRef(input.accountId, input.accountName),
    },
  }

  if (input.classId) {
    line.JournalEntryLineDetail.ClassRef = toQboRef(input.classId, input.className)
  }
  if (input.departmentId) {
    line.JournalEntryLineDetail.DepartmentRef = toQboRef(input.departmentId, input.departmentName)
  }
  if (input.entity) {
    line.JournalEntryLineDetail.Entity = {
      Type: input.entity.type,
      EntityRef: toQboRef(input.entity.id, input.entity.name),
    }
  }

  return line
}

/**
 * Validate that debits equal credits before posting.
 * Throws if unbalanced.
 */
export function validateJournalBalance(lines: JournalLineInput[]): {
  totalDebit: number
  totalCredit: number
  balanced: boolean
} {
  let totalDebit = 0
  let totalCredit = 0

  for (const line of lines) {
    if (line.type === 'debit') totalDebit += Math.abs(line.amount)
    else totalCredit += Math.abs(line.amount)
  }

  totalDebit = Math.round(totalDebit * 100) / 100
  totalCredit = Math.round(totalCredit * 100) / 100

  return { totalDebit, totalCredit, balanced: totalDebit === totalCredit }
}

// ── Core posting functions ───────────────────────────────────────────────────

/**
 * Post a journal entry to QBO. Validates balance before sending.
 */
export async function postJournalEntry(
  qbo: QboClient,
  input: JournalEntryInput,
): Promise<PostedJournalEntry> {
  const balance = validateJournalBalance(input.lines)
  if (!balance.balanced) {
    throw new Error(
      `Unbalanced journal entry: debits=${balance.totalDebit}, credits=${balance.totalCredit}. ` +
      `Difference: ${Math.abs(balance.totalDebit - balance.totalCredit)}`,
    )
  }

  if (input.lines.length < 2) {
    throw new Error('Journal entry must have at least 2 lines (debit + credit)')
  }

  const entry: QboJournalEntry = {
    TxnDate: input.txnDate,
    PrivateNote: input.memo ?? `[Nzila] ${input.entryType ?? 'standard'} entry`,
    Line: input.lines.map(buildQboLine),
  }

  const result = await qbo.create<QboJournalEntry>('JournalEntry', entry)

  return {
    id: result.Id ?? '',
    txnDate: input.txnDate,
    totalDebit: balance.totalDebit,
    totalCredit: balance.totalCredit,
    lineCount: input.lines.length,
    entryType: input.entryType ?? 'standard',
    raw: result,
  }
}

/**
 * Post an adjusting entry (month-end or year-end adjustment).
 * Identical to standard JE but tagged as "adjusting" in the memo.
 */
export async function postAdjustingEntry(
  qbo: QboClient,
  input: Omit<JournalEntryInput, 'entryType'>,
): Promise<PostedJournalEntry> {
  return postJournalEntry(qbo, { ...input, entryType: 'adjusting' })
}

/**
 * Post a reversing entry for the next period.
 * Takes the original entry's lines and flips debits ↔ credits.
 */
export async function postReversingEntry(
  qbo: QboClient,
  originalLines: JournalLineInput[],
  reversalDate: string,
  originalMemo?: string,
): Promise<PostedJournalEntry> {
  const reversedLines = originalLines.map((line) => ({
    ...line,
    type: (line.type === 'debit' ? 'credit' : 'debit') as 'debit' | 'credit',
    description: `Reversal: ${line.description ?? ''}`.trim(),
  }))

  return postJournalEntry(qbo, {
    txnDate: reversalDate,
    lines: reversedLines,
    memo: `[Nzila] Reversal of: ${originalMemo ?? 'adjusting entry'}`,
    entryType: 'reversing',
  })
}

/**
 * Post a tax accrual entry (e.g., income tax provision).
 *
 * @param taxExpenseAccountId  QBO account ID for the tax expense (DR)
 * @param taxPayableAccountId  QBO account ID for tax payable (CR)
 * @param amount               The estimated tax amount
 */
export async function postTaxAccrualEntry(
  qbo: QboClient,
  taxExpenseAccountId: string,
  taxPayableAccountId: string,
  amount: number,
  txnDate: string,
  description = 'Estimated income tax provision',
): Promise<PostedJournalEntry> {
  return postJournalEntry(qbo, {
    txnDate,
    lines: [
      {
        accountId: taxExpenseAccountId,
        amount,
        type: 'debit',
        description: `DR: ${description}`,
      },
      {
        accountId: taxPayableAccountId,
        amount,
        type: 'credit',
        description: `CR: ${description}`,
      },
    ],
    memo: `[Nzila] Tax accrual — ${description}`,
    entryType: 'tax-accrual',
  })
}
