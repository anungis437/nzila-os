/**
 * Flow — Order Payment Gating Service
 *
 * Enforces payment requirements before production and procurement.
 * No production without required payment. No PO without financial validation.
 */
import type { Order } from '@/domain/entities'
import { logger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PaymentGateResult {
  allowed: boolean
  blockers: string[]
  order_id: string
  outstanding_balance: number
}

export interface DepositRequirement {
  required: boolean
  percent: number | null
  amount: number | null
  due_before_production: boolean
}

// ── Service ────────────────────────────────────────────────────────────────

export function requiresDeposit(
  order: Pick<Order, 'id' | 'total_amount' | 'payment_status'>,
  depositRule: DepositRequirement,
): boolean {
  if (!depositRule.required) return false
  if (order.payment_status === 'PAID') return false
  return true
}

export function outstandingBalance(
  order: Pick<Order, 'total_amount'>,
  amountPaid: number,
): number {
  return Math.max(0, order.total_amount - amountPaid)
}

export function canStartProduction(
  order: Pick<Order, 'id' | 'total_amount' | 'payment_status' | 'status'>,
  amountPaid: number,
  depositRule: DepositRequirement,
): PaymentGateResult {
  const blockers: string[] = []

  if (order.status === 'CANCELLED') {
    blockers.push('Order is cancelled')
  }

  if (depositRule.due_before_production && depositRule.required) {
    const requiredAmount = depositRule.amount
      ?? (depositRule.percent != null
        ? (order.total_amount * depositRule.percent) / 100
        : 0)

    if (amountPaid < requiredAmount) {
      blockers.push(
        `Deposit required: ${requiredAmount.toFixed(2)} — received: ${amountPaid.toFixed(2)}`,
      )
    }
  }

  if (order.payment_status === 'OVERDUE') {
    blockers.push('Payment is overdue — resolve before production')
  }

  const balance = outstandingBalance(order, amountPaid)

  logger.info('Production gate evaluated', {
    orderId: order.id,
    allowed: blockers.length === 0,
    blockers,
    balance,
  })

  return {
    allowed: blockers.length === 0,
    blockers,
    order_id: order.id,
    outstanding_balance: balance,
  }
}

export function canGeneratePO(
  order: Pick<Order, 'id' | 'total_amount' | 'payment_status' | 'status'>,
  amountPaid: number,
  depositRule: DepositRequirement,
): PaymentGateResult {
  const blockers: string[] = []

  if (order.status === 'CANCELLED') {
    blockers.push('Order is cancelled')
  }

  const validPaymentStatuses = ['PAID', 'PARTIALLY_PAID', 'NOT_REQUIRED']
  if (!validPaymentStatuses.includes(order.payment_status)) {
    blockers.push(`Payment status "${order.payment_status}" does not allow PO generation`)
  }

  if (depositRule.required) {
    const requiredAmount = depositRule.amount
      ?? (depositRule.percent != null
        ? (order.total_amount * depositRule.percent) / 100
        : 0)

    if (amountPaid < requiredAmount) {
      blockers.push(
        `Minimum deposit of ${requiredAmount.toFixed(2)} required before PO — received: ${amountPaid.toFixed(2)}`,
      )
    }
  }

  const balance = outstandingBalance(order, amountPaid)

  logger.info('PO gate evaluated', {
    orderId: order.id,
    allowed: blockers.length === 0,
    blockers,
    balance,
  })

  return {
    allowed: blockers.length === 0,
    blockers,
    order_id: order.id,
    outstanding_balance: balance,
  }
}
