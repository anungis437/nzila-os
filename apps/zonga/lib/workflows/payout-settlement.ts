/**
 * Zonga — Payout Settlement Workflow
 *
 * Lifecycle: accrual → approval → batch → disbursement → reconciliation.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type PayoutSettlementStatus =
  | 'accruing'
  | 'threshold_reached'
  | 'pending_approval'
  | 'approved'
  | 'batched'
  | 'processing'
  | 'disbursed'
  | 'partially_failed'
  | 'failed'
  | 'reconciled'
  | 'disputed'
  | 'frozen'

const TRANSITIONS: readonly Transition<PayoutSettlementStatus>[] = [
  // Accrual
  { from: 'accruing', to: 'threshold_reached', label: 'Payout threshold met', auditEvent: 'payout_threshold_reached' },

  // Approval
  { from: 'threshold_reached', to: 'pending_approval', label: 'Submit for approval', auditEvent: 'payout_submitted_for_approval' },
  { from: 'pending_approval', to: 'approved', label: 'Approve payout', auditEvent: 'payout_approved' },
  { from: 'pending_approval', to: 'frozen', label: 'Freeze (dispute)', auditEvent: 'payout_frozen' },

  // Batching
  { from: 'approved', to: 'batched', label: 'Add to batch', auditEvent: 'payout_batched' },

  // Processing
  { from: 'batched', to: 'processing', label: 'Begin processing', auditEvent: 'payout_processing' },
  { from: 'processing', to: 'disbursed', label: 'Disbursement complete', auditEvent: 'payout_disbursed' },
  { from: 'processing', to: 'partially_failed', label: 'Partial failure', auditEvent: 'payout_partial_failure' },
  { from: 'processing', to: 'failed', label: 'Processing failed', auditEvent: 'payout_failed' },

  // Recovery
  { from: 'partially_failed', to: 'processing', label: 'Retry failed items', auditEvent: 'payout_retry' },
  { from: 'failed', to: 'batched', label: 'Re-batch for retry', auditEvent: 'payout_rebatched' },

  // Reconciliation
  { from: 'disbursed', to: 'reconciled', label: 'Reconciliation complete', auditEvent: 'payout_reconciled' },
  { from: 'partially_failed', to: 'reconciled', label: 'Partial reconciliation', auditEvent: 'payout_partially_reconciled' },

  // Dispute
  { from: 'accruing', to: 'frozen', label: 'Freeze (dispute filed)', auditEvent: 'payout_frozen_dispute' },
  { from: 'frozen', to: 'accruing', label: 'Unfreeze (dispute resolved)', auditEvent: 'payout_unfrozen' },
  { from: 'frozen', to: 'disputed', label: 'Escalate dispute', auditEvent: 'payout_dispute_escalated' },
  { from: 'disputed', to: 'frozen', label: 'Return to frozen', auditEvent: 'payout_dispute_pending' },
  { from: 'disputed', to: 'accruing', label: 'Dispute resolved', auditEvent: 'payout_dispute_resolved' },
] as const

export const payoutSettlement = {
  name: 'payout_settlement' as const,
  transitions: TRANSITIONS,
  validate: (from: PayoutSettlementStatus, to: PayoutSettlementStatus) =>
    validateTransition('payout_settlement', TRANSITIONS, from, to),
  attempt: (from: PayoutSettlementStatus, to: PayoutSettlementStatus) =>
    attemptTransition('payout_settlement', TRANSITIONS, from, to),
  getAvailable: (from: PayoutSettlementStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
