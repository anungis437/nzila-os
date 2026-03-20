/**
 * Zonga — Rights Update Workflow
 *
 * Versioned ownership transfer with immutable history,
 * approval gates, and ledger synchronisation.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type RightsUpdateStatus =
  | 'update_requested'
  | 'validating_splits'
  | 'pending_approval'
  | 'approved'
  | 'applying'
  | 'ledger_synced'
  | 'completed'
  | 'rejected'
  | 'conflict_detected'

const TRANSITIONS: readonly Transition<RightsUpdateStatus>[] = [
  { from: 'update_requested', to: 'validating_splits', label: 'Validate new splits', auditEvent: 'rights.update_validation' },
  { from: 'validating_splits', to: 'pending_approval', label: 'Splits valid, await approval', auditEvent: 'rights.update_pending' },
  { from: 'validating_splits', to: 'rejected', label: 'Invalid splits', auditEvent: 'rights.update_rejected_invalid' },
  { from: 'validating_splits', to: 'conflict_detected', label: 'Version conflict', auditEvent: 'rights.update_conflict' },
  { from: 'pending_approval', to: 'approved', label: 'Approve update', auditEvent: 'rights.update_approved', requiredRole: 'admin' },
  { from: 'pending_approval', to: 'rejected', label: 'Reject update', auditEvent: 'rights.update_rejected', requiredRole: 'admin' },
  { from: 'approved', to: 'applying', label: 'Apply new ownership', auditEvent: 'rights.update_applying' },
  { from: 'applying', to: 'ledger_synced', label: 'Ledger synced', auditEvent: 'rights.ledger_synced' },
  { from: 'ledger_synced', to: 'completed', label: 'Update finalised', auditEvent: 'rights.update_completed' },
  { from: 'conflict_detected', to: 'update_requested', label: 'Re-submit update', auditEvent: 'rights.update_resubmitted' },
] as const

export const rightsUpdate = {
  name: 'rights_update' as const,
  transitions: TRANSITIONS,
  validate: (from: RightsUpdateStatus, to: RightsUpdateStatus) =>
    validateTransition('rights_update', TRANSITIONS, from, to),
  attempt: (from: RightsUpdateStatus, to: RightsUpdateStatus) =>
    attemptTransition('rights_update', TRANSITIONS, from, to),
  getAvailable: (from: RightsUpdateStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
