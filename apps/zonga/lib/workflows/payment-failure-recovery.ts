/**
 * Zonga — Payment Failure Recovery Workflow
 *
 * Handles payment failure retry with exponential backoff,
 * escalation to manual review, and final resolution.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type PaymentFailureRecoveryStatus =
  | 'failed'
  | 'retry_scheduled'
  | 'retrying'
  | 'retry_succeeded'
  | 'max_retries_reached'
  | 'escalated'
  | 'manual_review'
  | 'manually_resolved'
  | 'written_off'
  | 'recovered'

const TRANSITIONS: readonly Transition<PaymentFailureRecoveryStatus>[] = [
  { from: 'failed', to: 'retry_scheduled', label: 'Schedule retry', auditEvent: 'payment.retry_scheduled' },
  { from: 'retry_scheduled', to: 'retrying', label: 'Execute retry', auditEvent: 'payment.retry_executing' },
  { from: 'retrying', to: 'retry_succeeded', label: 'Retry succeeded', auditEvent: 'payment.retry_succeeded' },
  { from: 'retrying', to: 'failed', label: 'Retry failed', auditEvent: 'payment.retry_failed' },
  { from: 'retry_succeeded', to: 'recovered', label: 'Payment recovered', auditEvent: 'payment.recovered' },
  { from: 'failed', to: 'max_retries_reached', label: 'Max retries hit', auditEvent: 'payment.max_retries' },
  { from: 'max_retries_reached', to: 'escalated', label: 'Escalate', auditEvent: 'payment.escalated' },
  { from: 'escalated', to: 'manual_review', label: 'Assign to reviewer', auditEvent: 'payment.manual_review', requiredRole: 'finance' },
  { from: 'manual_review', to: 'manually_resolved', label: 'Resolve manually', auditEvent: 'payment.manually_resolved', requiredRole: 'finance' },
  { from: 'manual_review', to: 'written_off', label: 'Write off', auditEvent: 'payment.written_off', requiredRole: 'finance' },
  { from: 'manually_resolved', to: 'recovered', label: 'Mark recovered', auditEvent: 'payment.recovered_manual' },
  { from: 'failed', to: 'escalated', label: 'Immediate escalation', auditEvent: 'payment.immediate_escalation' },
] as const

export const paymentFailureRecovery = {
  name: 'payment_failure_recovery' as const,
  transitions: TRANSITIONS,
  validate: (from: PaymentFailureRecoveryStatus, to: PaymentFailureRecoveryStatus) =>
    validateTransition('payment_failure_recovery', TRANSITIONS, from, to),
  attempt: (from: PaymentFailureRecoveryStatus, to: PaymentFailureRecoveryStatus) =>
    attemptTransition('payment_failure_recovery', TRANSITIONS, from, to),
  getAvailable: (from: PaymentFailureRecoveryStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
