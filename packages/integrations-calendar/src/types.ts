/**
 * Nzila OS — Calendar Integration: Core Types
 *
 * Types for calendar system integrations (Outlook, Google Calendar, etc.)
 */

import { z } from 'zod'

// ── Provider / Status enums ─────────────────────────────────────────────────

export const CalendarProviderSchema = z.enum([
  'OUTLOOK', 'GOOGLE', 'APPLE', 'CALDAV', 'CUSTOM',
])

export const EventStatusSchema = z.enum(['confirmed', 'tentative', 'cancelled'])

export const AttendeeResponseSchema = z.enum([
  'accepted', 'declined', 'tentative', 'needs_action', 'delegated',
])

export const EventTypeSchema = z.enum([
  'meeting', 'bargaining_session', 'grievance_hearing', 'arbitration',
  'steward_training', 'membership_meeting', 'strike_vote', 'ratification_vote',
  'executive_board', 'committee', 'social_event', 'deadline', 'other',
])

export type CalendarProvider = z.infer<typeof CalendarProviderSchema>
export type EventStatus = z.infer<typeof EventStatusSchema>
export type AttendeeResponse = z.infer<typeof AttendeeResponseSchema>
export type EventType = z.infer<typeof EventTypeSchema>

// ── Domain objects ──────────────────────────────────────────────────────────

export interface CalendarSource {
  readonly externalId: string
  readonly provider: CalendarProvider
  readonly calendarName: string
  readonly description?: string
  readonly timezone?: string
  readonly ownerEmail?: string
  readonly isShared: boolean
  readonly syncEnabled: boolean
}

export interface CalendarEvent {
  readonly externalId: string
  readonly provider: CalendarProvider
  readonly calendarId: string
  readonly title: string
  readonly description?: string
  readonly location?: string
  readonly meetingUrl?: string
  readonly eventType?: EventType
  readonly status: EventStatus
  readonly startTime: string
  readonly endTime: string
  readonly allDay: boolean
  readonly isRecurring: boolean
  readonly organizerEmail?: string
  readonly organizerName?: string
  readonly attendeeCount: number
}

export interface CalendarAttendee {
  readonly externalId: string
  readonly provider: CalendarProvider
  readonly eventId: string
  readonly email: string
  readonly displayName?: string
  readonly responseStatus: AttendeeResponse
  readonly isOrganizer: boolean
  readonly isOptional: boolean
}

export interface RecurrencePattern {
  readonly externalId: string
  readonly provider: CalendarProvider
  readonly eventId: string
  readonly frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  readonly intervalCount: number
  readonly daysOfWeek?: string
  readonly count?: number
  readonly untilDate?: string
}

// ── Sync result ─────────────────────────────────────────────────────────────

export interface CalendarSyncResult {
  readonly provider: CalendarProvider
  readonly calendarsSynced: number
  readonly eventsSynced: number
  readonly attendeesSynced: number
  readonly errors: string[]
}

// ── Client interface (adapter port) ─────────────────────────────────────────

export interface CalendarClient {
  readonly provider: CalendarProvider
  fetchCalendars(orgId: string): Promise<CalendarSource[]>
  fetchEvents(orgId: string, calendarId: string, since?: string): Promise<CalendarEvent[]>
  fetchAttendees(orgId: string, eventId: string): Promise<CalendarAttendee[]>
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; details?: string }>
}
