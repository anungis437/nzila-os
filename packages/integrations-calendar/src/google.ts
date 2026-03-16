/**
 * Nzila OS — Calendar Integration: Google Calendar Adapter
 *
 * Syncs calendars and events via Google Calendar API v3.
 * Requires OAuth2 scopes: calendar.readonly or calendar
 */

import { z } from 'zod'
import type {
  CalendarClient,
  CalendarSource,
  CalendarEvent,
  CalendarAttendee,
} from './types'

// ── Google API response schemas ─────────────────────────────────────────────

export const googleCalendarSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().nullable().optional(),
  timeZone: z.string().optional(),
  accessRole: z.string().optional(), // owner, writer, reader
  primary: z.boolean().optional(),
})

export type GoogleCalendarResource = z.infer<typeof googleCalendarSchema>

export const googleEventSchema = z.object({
  id: z.string(),
  summary: z.string().nullable().default('(No Title)'),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  hangoutLink: z.string().nullable().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  status: z.string().optional(), // confirmed, tentative, cancelled
  recurringEventId: z.string().nullable().optional(),
  organizer: z.object({
    email: z.string().optional(),
    displayName: z.string().nullable().optional(),
  }).optional(),
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().nullable().optional(),
    responseStatus: z.string(), // needsAction, declined, tentative, accepted
    organizer: z.boolean().optional(),
    optional: z.boolean().optional(),
  })).optional(),
})

export type GoogleEventResource = z.infer<typeof googleEventSchema>

// ── Google transport interface ──────────────────────────────────────────────

export interface GoogleCalendarTransport {
  listCalendars(): Promise<GoogleCalendarResource[]>
  listEvents(calendarId: string, timeMin?: string): Promise<GoogleEventResource[]>
}

// ── Mapping functions ───────────────────────────────────────────────────────

export function mapGoogleCalendar(cal: GoogleCalendarResource): CalendarSource {
  return {
    externalId: cal.id,
    provider: 'GOOGLE',
    calendarName: cal.summary,
    description: cal.description ?? undefined,
    timezone: cal.timeZone ?? undefined,
    isShared: cal.accessRole !== 'owner',
    syncEnabled: true,
  }
}

const GOOGLE_RESPONSE_MAP: Record<string, CalendarAttendee['responseStatus']> = {
  accepted: 'accepted',
  declined: 'declined',
  tentative: 'tentative',
  needsAction: 'needs_action',
}

export function mapGoogleEvent(event: GoogleEventResource, calendarId: string): CalendarEvent {
  const isAllDay = !event.start.dateTime && !!event.start.date
  return {
    externalId: event.id,
    provider: 'GOOGLE',
    calendarId,
    title: event.summary ?? '(No Title)',
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    meetingUrl: event.hangoutLink ?? undefined,
    status: (event.status as CalendarEvent['status']) ?? 'confirmed',
    startTime: event.start.dateTime ?? event.start.date ?? '',
    endTime: event.end.dateTime ?? event.end.date ?? '',
    allDay: isAllDay,
    isRecurring: event.recurringEventId != null,
    organizerEmail: event.organizer?.email ?? undefined,
    organizerName: event.organizer?.displayName ?? undefined,
    attendeeCount: event.attendees?.length ?? 0,
  }
}

export function mapGoogleAttendees(event: GoogleEventResource): CalendarAttendee[] {
  if (!event.attendees) return []
  return event.attendees.map((att) => ({
    externalId: `${event.id}-${att.email}`,
    provider: 'GOOGLE' as const,
    eventId: event.id,
    email: att.email,
    displayName: att.displayName ?? undefined,
    responseStatus: GOOGLE_RESPONSE_MAP[att.responseStatus] ?? 'needs_action',
    isOrganizer: att.organizer ?? false,
    isOptional: att.optional ?? false,
  }))
}

/**
 * Create a CalendarClient for Google Calendar.
 */
export function createGoogleCalendarClient(transport: GoogleCalendarTransport): CalendarClient {
  return {
    provider: 'GOOGLE',

    async fetchCalendars(): Promise<CalendarSource[]> {
      const cals = await transport.listCalendars()
      return cals.map(mapGoogleCalendar)
    },

    async fetchEvents(_orgId: string, calendarId: string, since?: string): Promise<CalendarEvent[]> {
      const events = await transport.listEvents(calendarId, since)
      return events.map((e) => mapGoogleEvent(e, calendarId))
    },

    async fetchAttendees(_orgId: string, _eventId: string): Promise<CalendarAttendee[]> {
      return []
    },

    async healthCheck() {
      const start = Date.now()
      try {
        await transport.listCalendars()
        return { ok: true, latencyMs: Date.now() - start, details: 'Google Calendar API accessible' }
      } catch {
        return { ok: false, latencyMs: Date.now() - start, details: 'Google Calendar API unreachable' }
      }
    },
  }
}
