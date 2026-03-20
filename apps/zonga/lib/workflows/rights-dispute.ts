/**
 * Zonga — Rights Dispute Workflow
 *
 * Lifecycle: filed → review → evidence → mediation → resolution.
 * Disputes freeze payouts and block further distribution.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type RightsDisputeStatus =
  | 'filed'
  | 'under_review'
  | 'evidence_requested'
  | 'evidence_received'
  | 'mediation'
  | 'mediation_scheduled'
  | 'resolved_in_favor'
  | 'resolved_against'
  | 'resolved_compromise'
  | 'escalated'
  | 'dismissed'

const TRANSITIONS: readonly Transition<RightsDisputeStatus>[] = [
  // Filing → Review
  { from: 'filed', to: 'under_review', label: 'Begin review', auditEvent: 'dispute_review_started' },
  { from: 'filed', to: 'dismissed', label: 'Dismiss (invalid)', auditEvent: 'dispute_dismissed' },

  // Evidence
  { from: 'under_review', to: 'evidence_requested', label: 'Request evidence', auditEvent: 'dispute_evidence_requested' },
  { from: 'evidence_requested', to: 'evidence_received', label: 'Evidence submitted', auditEvent: 'dispute_evidence_received' },
  { from: 'evidence_received', to: 'under_review', label: 'Resume review', auditEvent: 'dispute_review_resumed' },

  // Mediation
  { from: 'under_review', to: 'mediation', label: 'Refer to mediation', auditEvent: 'dispute_mediation_referred' },
  { from: 'evidence_received', to: 'mediation', label: 'Refer to mediation', auditEvent: 'dispute_mediation_referred' },
  { from: 'mediation', to: 'mediation_scheduled', label: 'Schedule mediation', auditEvent: 'dispute_mediation_scheduled' },

  // Resolution
  { from: 'mediation_scheduled', to: 'resolved_in_favor', label: 'Resolved — complainant wins', auditEvent: 'dispute_resolved_in_favor' },
  { from: 'mediation_scheduled', to: 'resolved_against', label: 'Resolved — respondent wins', auditEvent: 'dispute_resolved_against' },
  { from: 'mediation_scheduled', to: 'resolved_compromise', label: 'Resolved — compromise', auditEvent: 'dispute_resolved_compromise' },
  { from: 'under_review', to: 'resolved_in_favor', label: 'Resolved — complainant wins', auditEvent: 'dispute_resolved_in_favor' },
  { from: 'under_review', to: 'resolved_against', label: 'Resolved — respondent wins', auditEvent: 'dispute_resolved_against' },
  { from: 'under_review', to: 'dismissed', label: 'Dismiss', auditEvent: 'dispute_dismissed' },

  // Escalation
  { from: 'mediation', to: 'escalated', label: 'Escalate', auditEvent: 'dispute_escalated' },
  { from: 'escalated', to: 'resolved_in_favor', label: 'Resolved — complainant wins', auditEvent: 'dispute_resolved_in_favor' },
  { from: 'escalated', to: 'resolved_against', label: 'Resolved — respondent wins', auditEvent: 'dispute_resolved_against' },
  { from: 'escalated', to: 'resolved_compromise', label: 'Resolved — compromise', auditEvent: 'dispute_resolved_compromise' },
] as const

export const rightsDispute = {
  name: 'rights_dispute' as const,
  transitions: TRANSITIONS,
  validate: (from: RightsDisputeStatus, to: RightsDisputeStatus) =>
    validateTransition('rights_dispute', TRANSITIONS, from, to),
  attempt: (from: RightsDisputeStatus, to: RightsDisputeStatus) =>
    attemptTransition('rights_dispute', TRANSITIONS, from, to),
  getAvailable: (from: RightsDisputeStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
