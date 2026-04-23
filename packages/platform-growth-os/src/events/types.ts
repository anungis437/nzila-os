/**
 * @nzila/platform-growth-os — Conference/Event Pipeline types
 *
 * Captures leads from conferences, conventions, and CLC events.
 * Bridges event attendance → ICP scoring → post-event sequence enrollment.
 */
import type { GrowthScope } from '../types'

// ── Event definition ──────────────────────────────────────────────────────────

export type EventType =
  | 'cupe_convention'
  | 'clc_convention'
  | 'union_conference'
  | 'hr_conference'
  | 'sector_summit'
  | 'labour_relations_seminar'
  | 'trade_show'
  | 'webinar'
  | 'roundtable'
  | 'other'

export interface ConferenceEvent {
  id: string
  scope: GrowthScope
  name: string
  eventType: EventType
  location: string | null
  province: string | null
  startDate: string
  endDate: string
  attendanceCount: number | null
  /** Number of leads captured at this event. */
  leadsCaptered: number
  /** Number of leads that booked a demo. */
  demosBooked: number
  /** Notes from event debrief. */
  debrief: string
  createdAt: string
  updatedAt: string
}

// ── Event lead ─────────────────────────────────────────────────────────────

export type LeadCaptureMethod =
  | 'badge_scan'
  | 'business_card'
  | 'manual_entry'
  | 'qr_code'
  | 'speaker_session'
  | 'booth_conversation'

export type EventLeadStatus =
  | 'captured'
  | 'qualified'
  | 'enrolled_sequence'
  | 'demo_booked'
  | 'demo_completed'
  | 'converted'
  | 'disqualified'

export interface EventLead {
  id: string
  scope: GrowthScope
  eventId: string
  contactName: string
  contactEmail: string | null
  contactTitle: string | null
  /** Organisation name as spoken — may not match canonical union name yet. */
  rawOrgName: string
  /** Resolved to a TargetOrganisation ID after enrichment. */
  resolvedTargetOrgId: string | null
  localNumber: string | null
  memberCountEstimate: number | null
  captureMethod: LeadCaptureMethod
  status: EventLeadStatus
  /** Summary of the conversation at the event. */
  conversationNotes: string
  /** Pain points mentioned. */
  painPointsDiscussed: string[]
  /** Follow-up sequence instance ID once enrolled. */
  sequenceInstanceId: string | null
  /** CRM deal ID once created. */
  dealEngineId: string | null
  capturedAt: string
  updatedAt: string
}

// ── Conference Day 0→10 playbook state ───────────────────────────────────────

export type PlaybookPhase =
  | 'pre_event'     // event is upcoming: prep target list, prepare demos
  | 'at_event'      // event is live: capture leads, book demos
  | 'day0'          // day of event / end of day: send immediate follow-ups
  | 'day2'          // 48h post: LinkedIn + value-add email
  | 'day5'          // 5 days post: ROI + case study
  | 'day10'         // 10 days post: final close attempt
  | 'post_event'    // >10 days: transition unresponsive leads to re-engagement sequence

export interface ConferencePlaybookState {
  eventId: string
  currentPhase: PlaybookPhase
  /** Total leads captured. */
  totalLeads: number
  /** Leads enrolled in post-event sequence. */
  enrolled: number
  /** Demos booked from this event. */
  demosBooked: number
  /** Pilots proposed from this event. */
  pilotsProposed: number
  /** Pilots signed from this event. */
  pilotsSigned: number
  lastUpdatedAt: string
}
