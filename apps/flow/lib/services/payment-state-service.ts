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

  const payments = await paymentRepo.findByOrder(orderId, orgId)
  const totalPaid = await paymentRepo.totalPaidForOrder(orderId)
  const totalDue = Number(order.total ?? 0)

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
    events: payments.map((p) => ({
      id: p.id,
      event_type: p.provider ?? 'payment',
      amount: Number(p.amountPaid ?? 0),
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

// ── Extended canonical functions ───────────────────────────────────────────

  export type OrderPaymentState =
    | 'NOT_REQUIRED'
    | 'PENDING_DEPOSIT'
    | 'PARTIAL'
    | 'PAID'
    | 'OVERDUE'
    | 'FAILED'

  /**
   * Compute the canonical payment state for an order from its payments.
   * This is the authoritative source — do not derive payment state from
   * the order.paymentStatus column alone; that column should be synced
   * via syncOrderPaymentState.
   */
  export async function computeOrderPaymentState(
    orderId: string,
    orgId: string,
  ): Promise<OrderPaymentState> {
    const snapshot = await getPaymentSnapshotForOrder(orderId, orgId)
    if (!snapshot) return 'NOT_REQUIRED'

    if (!snapshot.deposit_required) return 'NOT_REQUIRED'
    if (snapshot.amount_paid <= 0) return 'PENDING_DEPOSIT'
    if (snapshot.amount_paid >= snapshot.amount_due) return 'PAID'
    return 'PARTIAL'
  }

  /**
   * Sync the order.paymentStatus column to match the computed canonical state.
   * Call after any payment record is created or updated.
   */
  export async function syncOrderPaymentState(
    orderId: string,
    orgId: string,
  ): Promise<OrderPaymentState> {
    const state = await computeOrderPaymentState(orderId, orgId)

    await orderRepo.update(orderId, orgId, {
      paymentStatus: state,
    })

    return state
  }

  /**
   * Return the outstanding balance for an order (amount_due - amount_paid).
   * Returns 0 if no payment record exists.
   */
  export async function getOutstandingBalance(
    orderId: string,
    orgId: string,
  ): Promise<number> {
    const snapshot = await getPaymentSnapshotForOrder(orderId, orgId)
    if (!snapshot) return 0
    return Math.max(0, snapshot.amount_due - snapshot.amount_paid)
  }

  /**
   * Return human-readable reasons why payment is blocking an order.
   * Empty array means the order is payment-clear.
   */
  export async function getPaymentBlockingReasons(
    orderId: string,
    orgId: string,
  ): Promise<string[]> {
    const snapshot = await getPaymentSnapshotForOrder(orderId, orgId)
    if (!snapshot) return []

    const reasons: string[] = []

    if (snapshot.deposit_required) {
      const depositAmount =
        snapshot.deposit_amount ??
        (snapshot.deposit_percent != null ? (snapshot.deposit_percent / 100) * snapshot.amount_due : 0)

      if (snapshot.amount_paid < depositAmount) {
        reasons.push(
          `Deposit required: $${depositAmount.toFixed(2)} — only $${snapshot.amount_paid.toFixed(2)} received`,
        )
      }
    }

    if (snapshot.payment_status === 'OVERDUE') {
      reasons.push('Order has overdue payment')
    }
    if (snapshot.payment_status === 'FAILED') {
      reasons.push('Order has a failed payment requiring resolution')
    }

    return reasons
  }
