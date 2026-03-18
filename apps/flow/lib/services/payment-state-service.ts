/**
 * Flow — Payment State Service
 *
 * Aggregates payment state for a given order or quote.
 * Used by the control-layer payment guard to build PaymentGateCheckResult snapshots.
 * Single source of truth for "what is the payment situation right now?"
 */
import {
  paymentRequirementRepo,
  paymentStatusRepo,
  paymentEventRepo,
} from '@/lib/repositories/workflow-repository'
import { orderRepo, paymentRepo } from '@/lib/repositories'
import { logger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PaymentSnapshot {
  order_id: string
  payment_status: string
  amount_due: number
  amount_paid: number
  deposit_required: boolean
  deposit_amount: number | null
  deposit_percent: number | null
  due_before_production: boolean
  events: PaymentEventSummary[]
}

export interface PaymentEventSummary {
  id: string
  event_type: string
  amount: number
  created_at: Date
}

// ── Service ────────────────────────────────────────────────────────────────

/**
 * Build a complete payment snapshot for the given quote (pre-order context).
 * Used by the payment guard and the audit dispatcher.
 */
export async function getPaymentSnapshotForQuote(quoteId: string): Promise<PaymentSnapshot | null> {
  const requirement = await paymentRequirementRepo.findByQuoteId(quoteId)
  const status = await paymentStatusRepo.findByQuoteId(quoteId)
  const events = await paymentEventRepo.findByQuoteId(quoteId)

  if (!status && !requirement) return null

  return {
    order_id: quoteId, // pre-order, keyed by quoteId
    payment_status: status?.status ?? 'NOT_REQUIRED',
    amount_due: status?.amountDue ?? 0,
    amount_paid: status?.amountPaid ?? 0,
    deposit_required: requirement?.depositRequired ?? false,
    deposit_amount: requirement?.depositAmount ?? null,
    deposit_percent: requirement?.depositPercent ?? null,
    due_before_production: requirement?.dueBeforeProduction ?? false,
    events: (events ?? []).map(e => ({
      id: e.id,
      event_type: e.eventType,
      amount: e.amount,
      created_at: e.createdAt,
    })),
  }
}

/**
 * Build a payment snapshot for the given order (post-conversion context).
 * Loads from the flow_payments table for order-scoped payment records.
 */
export async function getPaymentSnapshotForOrder(
  orderId: string,
  orgId: string,
): Promise<PaymentSnapshot | null> {
  const order = await orderRepo.findById(orderId, orgId)
  if (!order) return null

  const payments = await paymentRepo.findByOrderId(orderId, orgId)
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
  const totalDue = Number(order.totalAmount ?? 0)

  // Check if quote-level requirement exists (via quoteId on the order)
  let depositRequired = false
  let depositAmount: number | null = null
  let depositPercent: number | null = null
  let dueBeforeProduction = false

  if (order.quoteId) {
    const requirement = await paymentRequirementRepo.findByQuoteId(order.quoteId)
    if (requirement) {
      depositRequired = requirement.depositRequired
      depositAmount = requirement.depositAmount ?? null
      depositPercent = requirement.depositPercent ?? null
      dueBeforeProduction = requirement.dueBeforeProduction
    }
  }

  return {
    order_id: orderId,
    payment_status: order.paymentStatus ?? 'PENDING',
    amount_due: totalDue,
    amount_paid: totalPaid,
    deposit_required: depositRequired,
    deposit_amount: depositAmount,
    deposit_percent: depositPercent,
    due_before_production: dueBeforeProduction,
    events: payments.map(p => ({
      id: p.id,
      event_type: p.method ?? 'payment',
      amount: Number(p.amount ?? 0),
      created_at: p.createdAt ?? new Date(),
    })),
  }
}

/**
 * Check whether the deposit requirement for a quote/order has been met.
 */
export async function isDepositMet(quoteId: string): Promise<boolean> {
  const snapshot = await getPaymentSnapshotForQuote(quoteId)
  if (!snapshot) return true // no requirement = cleared
  if (!snapshot.deposit_required) return true
  return snapshot.payment_status === 'PAID' || snapshot.payment_status === 'NOT_REQUIRED'
}
