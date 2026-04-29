import type { SpendingControl } from './types.js'

export interface SpendingCheckResult {
  allowed: boolean
  reason?: string
  requiresDualApproval: boolean
}

export function checkSpendingControl(control: SpendingControl, amountCents: number): SpendingCheckResult {
  if (amountCents > control.perTransactionLimitCents) {
    return {
      allowed: false,
      reason: `Amount ${amountCents} exceeds per-transaction limit of ${control.perTransactionLimitCents}`,
      requiresDualApproval: amountCents > control.requiresDualApprovalAboveCents,
    }
  }
  return {
    allowed: true,
    requiresDualApproval: amountCents > control.requiresDualApprovalAboveCents,
  }
}

export function validateDailySpend(control: SpendingControl, todaySpendCents: number, newAmountCents: number): boolean {
  return todaySpendCents + newAmountCents <= control.dailyLimitCents
}

export function validateMonthlySpend(control: SpendingControl, monthSpendCents: number, newAmountCents: number): boolean {
  return monthSpendCents + newAmountCents <= control.monthlyLimitCents
}
