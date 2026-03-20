/**
 * Zonga — Ticket Sale Workflow
 *
 * Lifecycle: browsing → cart → payment → confirmation → scan.
 * Tracks a single ticket purchase through the system.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type TicketSaleStatus =
  | 'browsing'
  | 'selected'
  | 'cart'
  | 'payment_pending'
  | 'payment_processing'
  | 'payment_failed'
  | 'confirmed'
  | 'transferred'
  | 'refund_requested'
  | 'refunded'
  | 'scanned'
  | 'completed'
  | 'expired'
  | 'cancelled'

const TRANSITIONS: readonly Transition<TicketSaleStatus>[] = [
  // Browse → Select → Cart
  { from: 'browsing', to: 'selected', label: 'Select ticket', auditEvent: 'ticket_selected' },
  { from: 'selected', to: 'cart', label: 'Add to cart', auditEvent: 'ticket_added_to_cart' },
  { from: 'selected', to: 'browsing', label: 'Deselect', auditEvent: 'ticket_deselected' },
  { from: 'cart', to: 'browsing', label: 'Remove from cart', auditEvent: 'ticket_removed_from_cart' },

  // Payment flow
  { from: 'cart', to: 'payment_pending', label: 'Initiate payment', auditEvent: 'ticket_payment_initiated' },
  { from: 'payment_pending', to: 'payment_processing', label: 'Processing', auditEvent: 'ticket_payment_processing' },
  { from: 'payment_processing', to: 'confirmed', label: 'Payment succeeded', auditEvent: 'ticket_payment_confirmed' },
  { from: 'payment_processing', to: 'payment_failed', label: 'Payment failed', auditEvent: 'ticket_payment_failed' },
  { from: 'payment_failed', to: 'payment_pending', label: 'Retry payment', auditEvent: 'ticket_payment_retried' },
  { from: 'payment_failed', to: 'cancelled', label: 'Cancel', auditEvent: 'ticket_cancelled' },
  { from: 'payment_pending', to: 'expired', label: 'Payment timeout', auditEvent: 'ticket_payment_expired' },
  { from: 'payment_pending', to: 'cancelled', label: 'Cancel', auditEvent: 'ticket_cancelled' },

  // Post-purchase
  { from: 'confirmed', to: 'transferred', label: 'Transfer ticket', auditEvent: 'ticket_transferred' },
  { from: 'confirmed', to: 'refund_requested', label: 'Request refund', auditEvent: 'ticket_refund_requested' },
  { from: 'refund_requested', to: 'refunded', label: 'Refund approved', auditEvent: 'ticket_refunded' },
  { from: 'refund_requested', to: 'confirmed', label: 'Refund denied', auditEvent: 'ticket_refund_denied' },

  // Event day
  { from: 'confirmed', to: 'scanned', label: 'Ticket scanned', auditEvent: 'ticket_scanned' },
  { from: 'transferred', to: 'scanned', label: 'Ticket scanned (transferee)', auditEvent: 'ticket_scanned' },
  { from: 'scanned', to: 'completed', label: 'Event ended', auditEvent: 'ticket_completed' },
] as const

export const ticketSale = {
  name: 'ticket_sale' as const,
  transitions: TRANSITIONS,
  validate: (from: TicketSaleStatus, to: TicketSaleStatus) =>
    validateTransition('ticket_sale', TRANSITIONS, from, to),
  attempt: (from: TicketSaleStatus, to: TicketSaleStatus) =>
    attemptTransition('ticket_sale', TRANSITIONS, from, to),
  getAvailable: (from: TicketSaleStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
