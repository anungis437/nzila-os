/**
 * @nzila/zonga-control-plane — Economic Enforcer
 *
 * Production-grade economic integrity enforcement.
 * Validates double-entry invariants on every write,
 * runs reconciliation, and blocks invalid payouts.
 */
import type {
  ControlPlaneContext,
  EconomicIntegrityResult,
} from './types'
import { SystemEventType, AuditSeverity } from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'

// ── Ledger Integrity Validator ────────────────────────────────────────────

export interface LedgerEntry {
  readonly id: string
  readonly transactionId: string
  readonly accountId: string
  readonly direction: 'debit' | 'credit'
  readonly amount: number
  readonly currency: string
  readonly createdAt: Date
}

export interface LedgerTransaction {
  readonly id: string
  readonly entries: readonly LedgerEntry[]
  readonly status: 'pending' | 'posted' | 'reversed'
  readonly correlationId: string
  readonly createdAt: Date
  readonly postedAt?: Date
}

export interface PayoutRecord {
  readonly id: string
  readonly creatorId: string
  readonly amount: number
  readonly currency: string
  readonly status: string
  readonly ledgerTransactionId?: string
}

export interface RevenueRecord {
  readonly id: string
  readonly type: string
  readonly amount: number
  readonly currency: string
  readonly ledgerEntryId?: string
}

/**
 * Validate that a set of entries satisfies double-entry invariants.
 * MUST be called on every ledger write.
 */
export function validateLedgerIntegrity(
  entries: readonly LedgerEntry[],
): { valid: boolean; errors: readonly string[]; totalDebits: number; totalCredits: number } {
  const errors: string[] = []

  if (entries.length < 2) {
    errors.push('Double-entry requires at least 2 entries')
  }

  let totalDebits = 0
  let totalCredits = 0

  for (const entry of entries) {
    if (entry.amount <= 0) {
      errors.push(`Entry ${entry.id}: amount must be positive (got ${entry.amount})`)
    }
    if (entry.direction === 'debit') {
      totalDebits += entry.amount
    } else {
      totalCredits += entry.amount
    }
  }

  const discrepancy = Math.abs(totalDebits - totalCredits)
  if (discrepancy > 0.001) {
    errors.push(
      `Ledger imbalance: debits=${totalDebits.toFixed(4)}, credits=${totalCredits.toFixed(4)}, discrepancy=${discrepancy.toFixed(4)}`,
    )
  }

  return { valid: errors.length === 0, errors, totalDebits, totalCredits }
}

/**
 * Enforce economic integrity — runs all checks and emits system events.
 */
export function enforceEconomicIntegrity(
  context: ControlPlaneContext,
  transactions: readonly LedgerTransaction[],
  payouts: readonly PayoutRecord[],
  revenues: readonly RevenueRecord[],
): EconomicIntegrityResult {
  let totalDebits = 0
  let totalCredits = 0
  const unreconciledTransactions: string[] = []

  // Check every transaction for balance
  for (const tx of transactions) {
    const result = validateLedgerIntegrity(tx.entries)
    totalDebits += result.totalDebits
    totalCredits += result.totalCredits
    if (!result.valid) {
      unreconciledTransactions.push(tx.id)
    }
  }

  // Check payouts without ledger backing
  const payoutsWithoutBacking = payouts
    .filter((p) => !p.ledgerTransactionId && p.status !== 'cancelled')
    .map((p) => p.id)

  // Check revenue without ledger entries
  const revenueWithoutLedger = revenues
    .filter((r) => !r.ledgerEntryId)
    .map((r) => r.id)

  const discrepancy = Math.abs(totalDebits - totalCredits)
  const ledgerBalanced = discrepancy < 0.001

  const result: EconomicIntegrityResult = {
    ledgerBalanced,
    totalDebits,
    totalCredits,
    discrepancy,
    unreconciledTransactions,
    payoutsWithoutBacking,
    revenueWithoutLedger,
    checkedAt: new Date(),
  }

  // Emit system events for failures
  if (!ledgerBalanced) {
    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.LEDGER_INTEGRITY_FAILURE,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: context.orgId,
      entityType: 'ledger',
      correlationId: context.correlationId,
      payload: {
        totalDebits,
        totalCredits,
        discrepancy,
        unreconciledCount: unreconciledTransactions.length,
      },
      severity: AuditSeverity.CRITICAL,
    }))
  }

  if (payoutsWithoutBacking.length > 0) {
    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.INVARIANT_VIOLATION_DETECTED,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: context.orgId,
      entityType: 'payout',
      correlationId: context.correlationId,
      payload: {
        invariant: 'no_payout_without_backing',
        payoutIds: payoutsWithoutBacking,
      },
      severity: AuditSeverity.CRITICAL,
    }))
  }

  if (revenueWithoutLedger.length > 0) {
    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.INVARIANT_VIOLATION_DETECTED,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: context.orgId,
      entityType: 'revenue',
      correlationId: context.correlationId,
      payload: {
        invariant: 'no_revenue_without_ledger',
        revenueIds: revenueWithoutLedger,
      },
      severity: AuditSeverity.CRITICAL,
    }))
  }

  if (ledgerBalanced && payoutsWithoutBacking.length === 0 && revenueWithoutLedger.length === 0) {
    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.RECONCILIATION_COMPLETED,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: context.orgId,
      entityType: 'ledger',
      correlationId: context.correlationId,
      payload: { totalDebits, totalCredits, transactionCount: transactions.length },
      severity: AuditSeverity.INFO,
    }))
  }

  return result
}

// ── Reconciliation Service ────────────────────────────────────────────────

export interface AccountBalance {
  readonly accountId: string
  readonly recordedBalance: number
  readonly computedBalance: number
}

/**
 * Reconcile account balances against ledger entries.
 * Returns discrepancies for investigation.
 */
export function reconcileAccounts(
  accounts: readonly AccountBalance[],
): {
  reconciled: boolean
  discrepancies: readonly {
    accountId: string
    recordedBalance: number
    computedBalance: number
    variance: number
  }[]
} {
  const discrepancies: {
    accountId: string
    recordedBalance: number
    computedBalance: number
    variance: number
  }[] = []

  for (const account of accounts) {
    const variance = Math.abs(account.recordedBalance - account.computedBalance)
    if (variance > 0.001) {
      discrepancies.push({
        accountId: account.accountId,
        recordedBalance: account.recordedBalance,
        computedBalance: account.computedBalance,
        variance,
      })
    }
  }

  return {
    reconciled: discrepancies.length === 0,
    discrepancies,
  }
}

/**
 * Check if a payout can proceed — validates economic backing.
 */
export function canExecutePayout(
  payoutAmount: number,
  availableBalance: number,
  hasDispute: boolean,
  hasLedgerBacking: boolean,
): { allowed: boolean; reasons: readonly string[] } {
  const reasons: string[] = []

  if (payoutAmount <= 0) {
    reasons.push('Payout amount must be positive')
  }
  if (payoutAmount > availableBalance) {
    reasons.push(
      `Payout amount (${payoutAmount}) exceeds available balance (${availableBalance})`,
    )
  }
  if (hasDispute) {
    reasons.push('Active dispute — payouts frozen')
  }
  if (!hasLedgerBacking) {
    reasons.push('No ledger backing for payout — economic invariant violated')
  }

  return { allowed: reasons.length === 0, reasons }
}

/**
 * Validate revenue-to-ledger integrity for a specific revenue event.
 * Ensures every revenue event produces a corresponding ledger entry.
 */
export function validateRevenueToLedgerMapping(
  revenueId: string,
  ledgerEntryId: string | null,
): { valid: boolean; error?: string } {
  if (!ledgerEntryId) {
    return {
      valid: false,
      error: `Revenue event ${revenueId} has no corresponding ledger entry`,
    }
  }
  return { valid: true }
}
