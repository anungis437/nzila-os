/**
 * @nzila/zonga-control-plane — Payment Recovery
 *
 * Handles payment failure recovery, retry logic, and refund
 * orchestration with ledger reversal integration.
 */
import type { ControlPlaneContext, PaymentRecoveryResult } from './types'
import { SystemEventType, AuditSeverity } from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'

// ── Payment State Types ───────────────────────────────────────────────────

export interface PaymentIntent {
  readonly id: string
  readonly customerId: string
  readonly amount: number
  readonly currency: string
  readonly status: PaymentIntentStatus
  readonly provider: string
  readonly externalRef?: string
  readonly retryCount: number
  readonly maxRetries: number
  readonly createdAt: Date
  readonly lastAttemptAt?: Date
  readonly error?: string
}

export type PaymentIntentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'requires_action'

export interface RefundRequest {
  readonly captureId: string
  readonly amount: number
  readonly reason: string
  readonly requestedBy: string
}

export interface RefundResult {
  readonly refundId: string
  readonly captureId: string
  readonly amount: number
  readonly status: 'pending' | 'processing' | 'succeeded' | 'failed'
  readonly ledgerReversalId?: string
  readonly error?: string
}

// ── Recovery Logic ────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [1000, 5000, 30000, 120000, 600000] as const

/**
 * Attempt to recover a failed payment intent.
 * Uses exponential backoff with maximum retries.
 */
export function planPaymentRecovery(
  intent: PaymentIntent,
): PaymentRecoveryResult {
  if (intent.status === 'succeeded') {
    return {
      intentId: intent.id,
      recovered: true,
      newStatus: 'succeeded',
      retryCount: intent.retryCount,
    }
  }

  if (intent.status === 'cancelled') {
    return {
      intentId: intent.id,
      recovered: false,
      newStatus: 'cancelled',
      retryCount: intent.retryCount,
      error: 'Payment was cancelled — cannot recover',
    }
  }

  if (intent.retryCount >= intent.maxRetries) {
    return {
      intentId: intent.id,
      recovered: false,
      newStatus: 'failed',
      retryCount: intent.retryCount,
      error: `Max retries (${intent.maxRetries}) exhausted`,
    }
  }

  const delayIndex = Math.min(intent.retryCount, RETRY_DELAYS_MS.length - 1)
  const delay = RETRY_DELAYS_MS[delayIndex]!
  const nextRetryAt = new Date(Date.now() + delay)

  return {
    intentId: intent.id,
    recovered: false,
    newStatus: 'pending',
    retryCount: intent.retryCount + 1,
    nextRetryAt,
  }
}

/**
 * Validate a refund request — checks amount bounds and eligibility.
 */
export function validateRefundRequest(
  request: RefundRequest,
  originalAmount: number,
  alreadyRefunded: number,
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = []

  if (request.amount <= 0) {
    errors.push('Refund amount must be positive')
  }

  const remainingRefundable = originalAmount - alreadyRefunded
  if (request.amount > remainingRefundable) {
    errors.push(
      `Refund amount ($${request.amount}) exceeds remaining refundable amount ($${remainingRefundable})`,
    )
  }

  if (!request.reason || request.reason.trim().length < 3) {
    errors.push('Refund must have a reason')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Process a refund with ledger reversal — emits audit events.
 */
export function processRefund(
  context: ControlPlaneContext,
  request: RefundRequest,
  originalAmount: number,
  alreadyRefunded: number,
): RefundResult {
  const validation = validateRefundRequest(request, originalAmount, alreadyRefunded)
  if (!validation.valid) {
    return {
      refundId: `ref_${Date.now()}`,
      captureId: request.captureId,
      amount: request.amount,
      status: 'failed',
      error: validation.errors.join('; '),
    }
  }

  const refundId = `ref_${Date.now()}`
  const ledgerReversalId = `ledger_rev_${Date.now()}`

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.TICKET_REFUNDED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: refundId,
    entityType: 'refund',
    correlationId: context.correlationId,
    payload: {
      captureId: request.captureId,
      amount: request.amount,
      reason: request.reason,
      ledgerReversalId,
      requestedBy: request.requestedBy,
    },
    severity: AuditSeverity.INFO,
  }))

  return {
    refundId,
    captureId: request.captureId,
    amount: request.amount,
    status: 'pending',
    ledgerReversalId,
  }
}
