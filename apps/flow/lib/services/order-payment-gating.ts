/**
 * Flow — Order Payment Gating Service (Canonical)
 *
 * Single source-of-truth for payment gates on every order lifecycle transition.
 * Pure functions — no DB calls. Callers provide the order + context.
 *
 * Gates:
 *  - canGeneratePO: deposit met before PO creation
 *  - canStartProduction: deposit + payment current before production
 *  - canShipOrder: full payment required before shipment release
 *  - explainBlock: human-readable explanation of why a gate is blocked
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

export function canShipOrder(
  order: Pick<Order, 'id' | 'total_amount' | 'payment_status' | 'status'>,
  amountPaid: number,
): PaymentGateResult {
  const blockers: string[] = []

  if (order.status === 'CANCELLED') {
    blockers.push('Order is cancelled')
  }

  if (order.payment_status === 'OVERDUE') {
    blockers.push('Cannot ship with overdue payment')
  }

  const balance = outstandingBalance(order, amountPaid)
  if (balance > 0) {
    blockers.push(`Outstanding balance of ${balance.toFixed(2)} must be settled before shipment`)
  }

  logger.info('Shipment gate evaluated', {
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

export type PaymentGateType = 'po_creation' | 'production_start' | 'shipment'

export function getPaymentGateState(
  order: Pick<Order, 'id' | 'total_amount' | 'payment_status' | 'status'>,
  amountPaid: number,
  depositRule: DepositRequirement,
): Record<PaymentGateType, PaymentGateResult> {
  return {
    po_creation: canGeneratePO(order, amountPaid, depositRule),
    production_start: canStartProduction(order, amountPaid, depositRule),
    shipment: canShipOrder(order, amountPaid),
  }
}

export function explainBlock(result: PaymentGateResult): string {
  if (result.allowed) return 'Gate passed — no blockers.'
  return result.blockers.join(' | ')
}
