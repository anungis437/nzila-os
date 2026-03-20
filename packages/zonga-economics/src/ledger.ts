/**
 * @nzila/zonga-economics — Double-Entry Ledger Engine
 *
 * Immutable, auditable, double-entry accounting.
 * Every financial mutation produces balanced debit/credit entries.
 */
import type {
  EconomicEntry,
  EconomicTransaction,
  EconomicAccount,
  AccountBalanceSnapshot,
  ReconciliationResult,
} from './types'
import { EntryDirection, TransactionStatus } from './types'

// ── Ledger Invariants ─────────────────────────────────────────────────────

export interface LedgerValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly totalDebits: number
  readonly totalCredits: number
}

/**
 * Validate that a set of ledger entries is balanced.
 * Double-entry: sum of debits MUST equal sum of credits.
 */
export function validateLedgerEntries(
  entries: readonly EconomicEntry[],
): LedgerValidationResult {
  const errors: string[] = []

  if (entries.length === 0) {
    return { valid: false, errors: ['No entries provided'], totalDebits: 0, totalCredits: 0 }
  }

  if (entries.length < 2) {
    errors.push('Double-entry requires at least 2 entries')
  }

  let totalDebits = 0
  let totalCredits = 0

  for (const entry of entries) {
    if (entry.amount <= 0) {
      errors.push(`Entry ${entry.id}: amount must be positive (got ${entry.amount})`)
    }
    if (entry.direction === EntryDirection.DEBIT) {
      totalDebits += entry.amount
    } else {
      totalCredits += entry.amount
    }
  }

  // Use cents-precision comparison to avoid floating-point issues
  const discrepancy = Math.abs(totalDebits - totalCredits)
  if (discrepancy > 0.001) {
    errors.push(
      `Ledger imbalance: debits=${totalDebits.toFixed(6)}, credits=${totalCredits.toFixed(6)}, discrepancy=${discrepancy.toFixed(6)}`,
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    totalDebits,
    totalCredits,
  }
}

/**
 * Validate a complete transaction — entries must be balanced and status consistent.
 */
export function validateTransaction(
  transaction: EconomicTransaction,
): LedgerValidationResult {
  const entryResult = validateLedgerEntries(transaction.entries)
  const errors = [...entryResult.errors]

  if (transaction.status === TransactionStatus.POSTED && !transaction.postedAt) {
    errors.push('Posted transaction must have postedAt timestamp')
  }

  if (!transaction.correlationId) {
    errors.push('Transaction must have a correlationId for audit tracing')
  }

  const currencies = new Set(transaction.entries.map((e) => e.currency))
  if (currencies.size > 1) {
    errors.push(`Transaction entries span multiple currencies: ${[...currencies].join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    totalDebits: entryResult.totalDebits,
    totalCredits: entryResult.totalCredits,
  }
}

/**
 * Build a balanced pair of entries for a simple transfer.
 * Debits the source, credits the destination.
 */
export function buildTransferEntries(params: {
  transactionId: string
  sourceAccountId: string
  destinationAccountId: string
  amount: number
  currency: string
  description: string
  sourceBalanceAfter: number
  destinationBalanceAfter: number
}): readonly [EconomicEntry, EconomicEntry] {
  const now = new Date()
  const debit: EconomicEntry = {
    id: `entry_${params.transactionId}_d`,
    transactionId: params.transactionId,
    accountId: params.sourceAccountId,
    direction: EntryDirection.DEBIT,
    amount: params.amount,
    currency: params.currency as any,
    balanceAfter: params.sourceBalanceAfter,
    description: params.description,
    createdAt: now,
  }
  const credit: EconomicEntry = {
    id: `entry_${params.transactionId}_c`,
    transactionId: params.transactionId,
    accountId: params.destinationAccountId,
    direction: EntryDirection.CREDIT,
    amount: params.amount,
    currency: params.currency as any,
    balanceAfter: params.destinationBalanceAfter,
    description: params.description,
    createdAt: now,
  }
  return [debit, credit] as const
}

/**
 * Compute account balance from entries.
 * Credits increase balance, debits decrease.
 */
export function computeBalanceFromEntries(
  entries: readonly EconomicEntry[],
): number {
  let balance = 0
  for (const entry of entries) {
    if (entry.direction === EntryDirection.CREDIT) {
      balance += entry.amount
    } else {
      balance -= entry.amount
    }
  }
  return balance
}

/**
 * Reconcile an account — compare computed balance from entries vs recorded balance.
 */
export function reconcileAccount(
  account: EconomicAccount,
  entries: readonly EconomicEntry[],
  asOf?: Date,
): ReconciliationResult {
  const accountEntries = entries.filter((e) => e.accountId === account.id)
  const filtered = asOf
    ? accountEntries.filter((e) => e.createdAt <= asOf)
    : accountEntries

  const computedBalance = computeBalanceFromEntries(filtered)
  const discrepancy = Math.abs(computedBalance - account.balance)

  return {
    accountId: account.id,
    computedBalance,
    recordedBalance: account.balance,
    discrepancy,
    isBalanced: discrepancy < 0.001,
    entryCount: filtered.length,
    asOf: asOf ?? new Date(),
  }
}

/**
 * Take a balance snapshot for an account.
 */
export function snapshotBalance(account: EconomicAccount): AccountBalanceSnapshot {
  return {
    accountId: account.id,
    balance: account.balance,
    holdBalance: account.holdBalance,
    availableBalance: account.balance - account.holdBalance,
    currency: account.currency,
    asOf: new Date(),
  }
}
