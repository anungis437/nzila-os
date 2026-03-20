/**
 * Nzila OS — Calendar Integration: Outlook (Microsoft Graph) Adapter
 *
 * Syncs calendars and events via Microsoft Graph API.
 * Requires delegated or application Graph permissions:
 *   Calendars.Read, Calendars.ReadWrite
 */

import { z } from 'zod'
import type {
  CalendarClient,
  CalendarSource,
  CalendarEvent,
  CalendarAttendee,
} from './types'

// ── Graph API response schemas ──────────────────────────────────────────────

export const graphCalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  owner: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  canEdit: z.boolean().optional(),
  isShared: z.boolean().optional(),
})

export type GraphCalendar = z.infer<typeof graphCalendarSchema>

export const graphEventSchema = z.object({
  id: z.string(),
  subject: z.string(),
  bodyPreview: z.string().nullable().optional(),
  location: z.object({ displayName: z.string().nullable() }).nullable().optional(),
  onlineMeeting: z.object({ joinUrl: z.string().nullable() }).nullable().optional(),
  start: z.object({ dateTime: z.string(), timeZone: z.string() }),
  end: z.object({ dateTime: z.string(), timeZone: z.string() }),
  isAllDay: z.boolean().optional(),
  isCancelled: z.boolean().optional(),
  isOrganizer: z.boolean().optional(),
  recurrence: z.unknown().nullable().optional(),
  organizer: z.object({
    emailAddress: z.object({ name: z.string().nullable(), address: z.string().nullable() }),
  }).optional(),
  attendees: z.array(z.object({
    emailAddress: z.object({ name: z.string().nullable(), address: z.string() }),
    status: z.object({ response: z.string() }),
    type: z.string().optional(),
  })).optional(),
})

export type GraphEvent = z.infer<typeof graphEventSchema>

// ── Graph client interface ──────────────────────────────────────────────────

export interface GraphCalendarTransport {
  listCalendars(userId: string): Promise<GraphCalendar[]>
  listEvents(userId: string, calendarId: string, since?: string): Promise<GraphEvent[]>
}

// ── Mapping functions ───────────────────────────────────────────────────────

export function mapGraphCalendar(cal: GraphCalendar): CalendarSource {
  return {
    externalId: cal.id,
    provider: 'OUTLOOK',
    calendarName: cal.name,
    ownerEmail: cal.owner?.address ?? undefined,
    isShared: cal.isShared ?? false,
    syncEnabled: true,
  }
}

const GRAPH_RESPONSE_MAP: Record<string, CalendarAttendee['responseStatus']> = {
  accepted: 'accepted',
  declined: 'declined',
  tentativelyAccepted: 'tentative',
  notResponded: 'needs_action',
  none: 'needs_action',
}

export function mapGraphEvent(event: GraphEvent, calendarId: string): CalendarEvent {
  return {
    externalId: event.id,
    provider: 'OUTLOOK',
    calendarId,
    title: event.subject,
    description: event.bodyPreview ?? undefined,
    location: event.location?.displayName ?? undefined,
    meetingUrl: event.onlineMeeting?.joinUrl ?? undefined,
    status: event.isCancelled ? 'cancelled' : 'confirmed',
    startTime: event.start.dateTime,
    endTime: event.end.dateTime,
    allDay: event.isAllDay ?? false,
    isRecurring: event.recurrence != null,
    organizerEmail: event.organizer?.emailAddress?.address ?? undefined,
    organizerName: event.organizer?.emailAddress?.name ?? undefined,
    attendeeCount: event.attendees?.length ?? 0,
  }
}

export function mapGraphAttendees(event: GraphEvent): CalendarAttendee[] {
  if (!event.attendees) return []
  return event.attendees.map((att) => ({
    externalId: `${event.id}-${att.emailAddress.address}`,
    provider: 'OUTLOOK' as const,
    eventId: event.id,
    email: att.emailAddress.address,
    displayName: att.emailAddress.name ?? undefined,
    responseStatus: GRAPH_RESPONSE_MAP[att.status.response] ?? 'needs_action',
    isOrganizer: false,
    isOptional: att.type === 'optional',
  }))
}

/**
 * Create a CalendarClient for Outlook backed by Microsoft Graph.
 */
export function createOutlookCalendarClient(
  transport: GraphCalendarTransport,
  userId: string,
): CalendarClient {
  return {
    provider: 'OUTLOOK',

    async fetchCalendars(): Promise<CalendarSource[]> {
      const cals = await transport.listCalendars(userId)
      return cals.map(mapGraphCalendar)
    },

    async fetchEvents(_orgId: string, calendarId: string, since?: string): Promise<CalendarEvent[]> {
      const events = await transport.listEvents(userId, calendarId, since)
      return events.map((e) => mapGraphEvent(e, calendarId))
    },

    async fetchAttendees(_orgId: string, _eventId: string): Promise<CalendarAttendee[]> {
      // Attendees are embedded in the event response in Graph API
      // The caller should extract them from the event fetch
      return []
    },

    async healthCheck() {
      const start = Date.now()
      try {
        await transport.listCalendars(userId)
        return { ok: true, latencyMs: Date.now() - start, details: 'Graph API accessible' }
      } catch {
        return { ok: false, latencyMs: Date.now() - start, details: 'Graph API unreachable' }
      }
    },
  }
}
