/**
 * Zonga — Refund Flow Workflow
 *
 * Full refund lifecycle with ledger reversal,
 * approval gates, and partial refund support.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type RefundFlowStatus =
  | 'refund_requested'
  | 'validating'
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'ledger_reversed'
  | 'provider_refunded'
  | 'completed'
  | 'rejected'
  | 'failed'

const TRANSITIONS: readonly Transition<RefundFlowStatus>[] = [
  { from: 'refund_requested', to: 'validating', label: 'Start validation', auditEvent: 'refund.validation_started' },
  { from: 'validating', to: 'pending_approval', label: 'Requires approval', auditEvent: 'refund.pending_approval' },
  { from: 'validating', to: 'rejected', label: 'Validation failed', auditEvent: 'refund.rejected_validation' },
  { from: 'pending_approval', to: 'approved', label: 'Approve refund', auditEvent: 'refund.approved', requiredRole: 'finance' },
  { from: 'pending_approval', to: 'rejected', label: 'Reject refund', auditEvent: 'refund.rejected_approval', requiredRole: 'finance' },
  { from: 'approved', to: 'processing', label: 'Begin processing', auditEvent: 'refund.processing' },
  { from: 'processing', to: 'ledger_reversed', label: 'Ledger entries reversed', auditEvent: 'refund.ledger_reversed' },
  { from: 'ledger_reversed', to: 'provider_refunded', label: 'Provider refund issued', auditEvent: 'refund.provider_issued' },
  { from: 'provider_refunded', to: 'completed', label: 'Refund complete', auditEvent: 'refund.completed' },
  { from: 'processing', to: 'failed', label: 'Processing failed', auditEvent: 'refund.failed' },
  { from: 'ledger_reversed', to: 'failed', label: 'Provider refund failed', auditEvent: 'refund.provider_failed' },
  { from: 'failed', to: 'processing', label: 'Retry refund', auditEvent: 'refund.retried' },
] as const

export const refundFlow = {
  name: 'refund_flow' as const,
  transitions: TRANSITIONS,
  validate: (from: RefundFlowStatus, to: RefundFlowStatus) =>
    validateTransition('refund_flow', TRANSITIONS, from, to),
  attempt: (from: RefundFlowStatus, to: RefundFlowStatus) =>
    attemptTransition('refund_flow', TRANSITIONS, from, to),
  getAvailable: (from: RefundFlowStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
