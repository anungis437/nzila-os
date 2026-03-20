/**
 * @nzila/zonga-payments — Payment Intent Engine
 *
 * Manages payment intent lifecycle, idempotency,
 * expiration, and status transitions.
 */
import type { PaymentIntent, PaymentCapture, PaymentRefund } from './types'
import { PaymentIntentStatus, RefundStatus } from './types'

// ── Status Transitions ───────────────────────────────────────────────────

const INTENT_TRANSITIONS: Record<string, readonly string[]> = {
  [PaymentIntentStatus.CREATED]: [
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.CANCELLED,
  ],
  [PaymentIntentStatus.PROCESSING]: [
    PaymentIntentStatus.REQUIRES_ACTION,
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.CANCELLED,
  ],
  [PaymentIntentStatus.REQUIRES_ACTION]: [
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.FAILED,
  ],
  [PaymentIntentStatus.CAPTURED]: [
    PaymentIntentStatus.REFUNDED,
    PaymentIntentStatus.PARTIALLY_REFUNDED,
  ],
  [PaymentIntentStatus.PARTIALLY_REFUNDED]: [
    PaymentIntentStatus.REFUNDED,
  ],
  [PaymentIntentStatus.FAILED]: [],
  [PaymentIntentStatus.CANCELLED]: [],
  [PaymentIntentStatus.REFUNDED]: [],
}

export interface TransitionResult {
  readonly allowed: boolean
  readonly error: string | null
}

/**
 * Check if a payment intent status transition is valid.
 */
export function canTransitionIntent(
  currentStatus: PaymentIntentStatus,
  targetStatus: PaymentIntentStatus,
): TransitionResult {
  const allowed = INTENT_TRANSITIONS[currentStatus]
  if (!allowed) {
    return { allowed: false, error: `Unknown status: ${currentStatus}` }
  }

  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      error: `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
    }
  }

  return { allowed: true, error: null }
}

/**
 * Get available next statuses for a payment intent.
 */
export function getAvailableIntentTransitions(
  currentStatus: PaymentIntentStatus,
): readonly PaymentIntentStatus[] {
  return (INTENT_TRANSITIONS[currentStatus] ?? []) as PaymentIntentStatus[]
}

// ── Expiration ────────────────────────────────────────────────────────────

/**
 * Check if a payment intent has expired.
 */
export function isIntentExpired(intent: PaymentIntent, now?: Date): boolean {
  const currentTime = now ?? new Date()
  return (
    currentTime > intent.expiresAt &&
    intent.status !== PaymentIntentStatus.CAPTURED &&
    intent.status !== PaymentIntentStatus.REFUNDED &&
    intent.status !== PaymentIntentStatus.PARTIALLY_REFUNDED
  )
}

// ── Refund Calculations ───────────────────────────────────────────────────

export interface RefundSummary {
  readonly totalRefunded: number
  readonly remainingRefundable: number
  readonly refundCount: number
  readonly isFullyRefunded: boolean
}

/**
 * Compute refund summary for a captured payment intent.
 */
export function computeRefundSummary(
  intent: PaymentIntent,
  refunds: readonly PaymentRefund[],
): RefundSummary {
  const completedRefunds = refunds.filter(
    (r) => r.intentId === intent.id && r.status === RefundStatus.COMPLETED,
  )
  const totalRefunded = completedRefunds.reduce((sum, r) => sum + r.amount, 0)
  const rounded = Math.round(totalRefunded * 100) / 100
  const capturedAmount = intent.amount

  return {
    totalRefunded: rounded,
    remainingRefundable: Math.max(0, Math.round((capturedAmount - rounded) * 100) / 100),
    refundCount: completedRefunds.length,
    isFullyRefunded: rounded >= capturedAmount,
  }
}

/**
 * Validate a refund request against the intent.
 */
export function validateRefundRequest(
  intent: PaymentIntent,
  requestedAmount: number,
  existingRefunds: readonly PaymentRefund[],
): TransitionResult {
  if (
    intent.status !== PaymentIntentStatus.CAPTURED &&
    intent.status !== PaymentIntentStatus.PARTIALLY_REFUNDED
  ) {
    return { allowed: false, error: `Cannot refund intent in "${intent.status}" status` }
  }

  if (requestedAmount <= 0) {
    return { allowed: false, error: 'Refund amount must be positive' }
  }

  const summary = computeRefundSummary(intent, existingRefunds)
  if (requestedAmount > summary.remainingRefundable) {
    return {
      allowed: false,
      error: `Requested ${requestedAmount} exceeds refundable ${summary.remainingRefundable}`,
    }
  }

  return { allowed: true, error: null }
}

// ── Idempotency ───────────────────────────────────────────────────────────

/**
 * Check if a payment intent with the same idempotency key already exists.
 */
export function findByIdempotencyKey(
  intents: readonly PaymentIntent[],
  idempotencyKey: string,
): PaymentIntent | undefined {
  return intents.find((i) => i.idempotencyKey === idempotencyKey)
}
