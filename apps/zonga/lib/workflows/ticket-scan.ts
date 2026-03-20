/**
 * Zonga — Ticket Scan Workflow
 *
 * Handles check-in validation with idempotency,
 * duplicate detection, and offline mode support.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type TicketScanStatus =
  | 'pending_scan'
  | 'scanning'
  | 'validated'
  | 'duplicate_detected'
  | 'invalid_ticket'
  | 'fraud_flagged'
  | 'checked_in'
  | 'offline_queued'
  | 'offline_synced'

const TRANSITIONS: readonly Transition<TicketScanStatus>[] = [
  { from: 'pending_scan', to: 'scanning', label: 'Initiate scan', auditEvent: 'ticket.scan_initiated' },
  { from: 'scanning', to: 'validated', label: 'Ticket validated', auditEvent: 'ticket.scan_validated' },
  { from: 'scanning', to: 'duplicate_detected', label: 'Duplicate scan', auditEvent: 'ticket.scan_duplicate' },
  { from: 'scanning', to: 'invalid_ticket', label: 'Invalid ticket', auditEvent: 'ticket.scan_invalid' },
  { from: 'scanning', to: 'fraud_flagged', label: 'Fraud detected', auditEvent: 'ticket.scan_fraud' },
  { from: 'validated', to: 'checked_in', label: 'Check-in confirmed', auditEvent: 'ticket.checked_in' },
  // Offline support
  { from: 'scanning', to: 'offline_queued', label: 'Queue for offline', auditEvent: 'ticket.offline_queued' },
  { from: 'offline_queued', to: 'offline_synced', label: 'Synced from offline', auditEvent: 'ticket.offline_synced' },
  { from: 'offline_synced', to: 'validated', label: 'Offline validated', auditEvent: 'ticket.offline_validated' },
  { from: 'offline_synced', to: 'duplicate_detected', label: 'Offline duplicate', auditEvent: 'ticket.offline_duplicate' },
] as const

export const ticketScan = {
  name: 'ticket_scan' as const,
  transitions: TRANSITIONS,
  validate: (from: TicketScanStatus, to: TicketScanStatus) =>
    validateTransition('ticket_scan', TRANSITIONS, from, to),
  attempt: (from: TicketScanStatus, to: TicketScanStatus) =>
    attemptTransition('ticket_scan', TRANSITIONS, from, to),
  getAvailable: (from: TicketScanStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
