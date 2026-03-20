/**
 * Zonga — Economic Invariant Guards (E1–E6)
 *
 * Runtime enforcement of economic invariants at the application boundary.
 * These guards are called by action handlers before economic mutations.
 *
 * E1: No revenue without ledger backing
 * E2: No payout without sufficient balance
 * E3: Ledger always balanced (debits = credits ±$0.001)
 * E4: No negative payouts
 * E5: All economic transactions reversible
 * E6: Settlement batches must be fully reconciled
 */

import { logger } from '@/lib/logger'

export interface EconomicGuardInput {
  /** For E2: payout amount requested */
  payoutAmount?: number
  /** For E2: available balance (revenue - paid) */
  availableBalance?: number
  /** For E1: whether a ledger entry exists for the revenue event */
  hasLedgerBacking?: boolean
  /** For E3: total debits across all accounts */
  totalDebits?: number
  /** For E3: total credits across all accounts */
  totalCredits?: number
  /** For E4: payout amount (checked for negative) */
  amount?: number
}

export interface GuardResult {
  passed: boolean
  invariant: string
  details?: string
}

/** E1: No revenue event may be recorded without a corresponding ledger entry */
export function guardRevenueHasLedgerBacking(hasLedgerBacking: boolean): GuardResult {
  if (!hasLedgerBacking) {
    logger.error('E1 VIOLATION: Revenue recorded without ledger backing')
    return {
      passed: false,
      invariant: 'E1_NO_REVENUE_WITHOUT_LEDGER',
      details: 'Revenue event must have a corresponding ledger entry',
    }
  }
  return { passed: true, invariant: 'E1_NO_REVENUE_WITHOUT_LEDGER' }
}

/** E2: No payout may exceed available balance */
export function guardPayoutWithinBalance(
  payoutAmount: number,
  availableBalance: number,
): GuardResult {
  if (payoutAmount > availableBalance) {
    logger.error('E2 VIOLATION: Payout exceeds available balance', {
      payoutAmount,
      availableBalance,
    })
    return {
      passed: false,
      invariant: 'E2_NO_PAYOUT_EXCEEDING_BALANCE',
      details: `Payout ${payoutAmount} exceeds available balance ${availableBalance}`,
    }
  }
  return { passed: true, invariant: 'E2_NO_PAYOUT_EXCEEDING_BALANCE' }
}

/** E3: Ledger must always be balanced */
export function guardLedgerBalanced(
  totalDebits: number,
  totalCredits: number,
): GuardResult {
  const discrepancy = Math.abs(totalDebits - totalCredits)
  if (discrepancy > 0.001) {
    logger.error('E3 VIOLATION: Ledger imbalanced', {
      totalDebits,
      totalCredits,
      discrepancy,
    })
    return {
      passed: false,
      invariant: 'E3_LEDGER_BALANCED',
      details: `Ledger imbalance: debits=${totalDebits}, credits=${totalCredits}, gap=${discrepancy}`,
    }
  }
  return { passed: true, invariant: 'E3_LEDGER_BALANCED' }
}

/** E4: No negative payouts without explicit reversal rule */
export function guardNoNegativePayout(amount: number): GuardResult {
  if (amount < 0) {
    logger.error('E4 VIOLATION: Negative payout attempted', { amount })
    return {
      passed: false,
      invariant: 'E4_NO_NEGATIVE_PAYOUT',
      details: `Negative payout amount: ${amount}`,
    }
  }
  return { passed: true, invariant: 'E4_NO_NEGATIVE_PAYOUT' }
}

/** E5: Check that a transaction has a reversal path */
export function guardTransactionReversible(
  hasReversalPath: boolean,
  transactionId: string,
): GuardResult {
  if (!hasReversalPath) {
    logger.warn('E5 WARNING: Transaction has no reversal path', { transactionId })
    return {
      passed: false,
      invariant: 'E5_TRANSACTION_REVERSIBLE',
      details: `Transaction ${transactionId} has no reversal mechanism`,
    }
  }
  return { passed: true, invariant: 'E5_TRANSACTION_REVERSIBLE' }
}

/** E6: Validate that a settlement batch is fully reconciled */
export function guardSettlementReconciled(
  totalInstructions: number,
  reconciledCount: number,
): GuardResult {
  if (reconciledCount < totalInstructions) {
    logger.warn('E6 WARNING: Settlement batch not fully reconciled', {
      totalInstructions,
      reconciledCount,
    })
    return {
      passed: false,
      invariant: 'E6_SETTLEMENT_RECONCILED',
      details: `${reconciledCount}/${totalInstructions} instructions reconciled`,
    }
  }
  return { passed: true, invariant: 'E6_SETTLEMENT_RECONCILED' }
}

/** Run all applicable guards for a given input */
export function runEconomicGuards(input: EconomicGuardInput): GuardResult[] {
  const results: GuardResult[] = []

  if (input.hasLedgerBacking !== undefined) {
    results.push(guardRevenueHasLedgerBacking(input.hasLedgerBacking))
  }
  if (input.payoutAmount !== undefined && input.availableBalance !== undefined) {
    results.push(guardPayoutWithinBalance(input.payoutAmount, input.availableBalance))
  }
  if (input.totalDebits !== undefined && input.totalCredits !== undefined) {
    results.push(guardLedgerBalanced(input.totalDebits, input.totalCredits))
  }
  if (input.amount !== undefined) {
    results.push(guardNoNegativePayout(input.amount))
  }

  return results
}
