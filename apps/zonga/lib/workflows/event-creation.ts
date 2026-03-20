/**
 * Zonga — Event Creation Workflow
 *
 * Lifecycle: draft → venue confirmed → ticketing → published → live → settled.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type EventCreationStatus =
  | 'draft'
  | 'venue_confirmed'
  | 'lineup_confirmed'
  | 'ticketing_configured'
  | 'under_review'
  | 'approved'
  | 'published'
  | 'on_sale'
  | 'sold_out'
  | 'doors_open'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'postponed'
  | 'settling'
  | 'settled'

const TRANSITIONS: readonly Transition<EventCreationStatus>[] = [
  // Setup
  { from: 'draft', to: 'venue_confirmed', label: 'Confirm venue', auditEvent: 'event_venue_confirmed' },
  { from: 'venue_confirmed', to: 'lineup_confirmed', label: 'Confirm lineup', auditEvent: 'event_lineup_confirmed' },
  { from: 'lineup_confirmed', to: 'ticketing_configured', label: 'Configure ticketing', auditEvent: 'event_ticketing_configured' },

  // Review
  { from: 'ticketing_configured', to: 'under_review', label: 'Submit for review', auditEvent: 'event_submitted_for_review' },
  { from: 'under_review', to: 'approved', label: 'Approve event', auditEvent: 'event_approved' },
  { from: 'under_review', to: 'draft', label: 'Request changes', auditEvent: 'event_changes_requested' },

  // Publication & sales
  { from: 'approved', to: 'published', label: 'Publish event', auditEvent: 'event_published' },
  { from: 'published', to: 'on_sale', label: 'Open ticket sales', auditEvent: 'event_tickets_on_sale' },
  { from: 'on_sale', to: 'sold_out', label: 'Sold out', auditEvent: 'event_sold_out' },

  // Live event
  { from: 'on_sale', to: 'doors_open', label: 'Open doors', auditEvent: 'event_doors_open' },
  { from: 'sold_out', to: 'doors_open', label: 'Open doors', auditEvent: 'event_doors_open' },
  { from: 'doors_open', to: 'in_progress', label: 'Event started', auditEvent: 'event_started' },
  { from: 'in_progress', to: 'completed', label: 'Event ended', auditEvent: 'event_completed' },

  // Settlement
  { from: 'completed', to: 'settling', label: 'Begin settlement', auditEvent: 'event_settlement_started' },
  { from: 'settling', to: 'settled', label: 'Settlement complete', auditEvent: 'event_settled' },

  // Cancellation & postponement
  { from: 'draft', to: 'cancelled', label: 'Cancel', auditEvent: 'event_cancelled' },
  { from: 'published', to: 'cancelled', label: 'Cancel', auditEvent: 'event_cancelled' },
  { from: 'on_sale', to: 'cancelled', label: 'Cancel', auditEvent: 'event_cancelled' },
  { from: 'on_sale', to: 'postponed', label: 'Postpone', auditEvent: 'event_postponed' },
  { from: 'postponed', to: 'on_sale', label: 'Reschedule', auditEvent: 'event_rescheduled' },
  { from: 'postponed', to: 'cancelled', label: 'Cancel', auditEvent: 'event_cancelled' },

  // Cancelled events still need settlement (refunds)
  { from: 'cancelled', to: 'settling', label: 'Begin refund settlement', auditEvent: 'event_refund_settlement_started' },
] as const

export const eventCreation = {
  name: 'event_creation' as const,
  transitions: TRANSITIONS,
  validate: (from: EventCreationStatus, to: EventCreationStatus) =>
    validateTransition('event_creation', TRANSITIONS, from, to),
  attempt: (from: EventCreationStatus, to: EventCreationStatus) =>
    attemptTransition('event_creation', TRANSITIONS, from, to),
  getAvailable: (from: EventCreationStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
