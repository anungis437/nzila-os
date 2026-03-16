import { describe, it, expect } from 'vitest'
import {
  googleCalendarSchema,
  googleEventSchema,
  mapGoogleCalendar,
  mapGoogleEvent,
  mapGoogleAttendees,
  createGoogleCalendarClient,
  type GoogleCalendarResource,
  type GoogleEventResource,
  type GoogleCalendarTransport,
} from './google'

// ── Fixtures ────────────────────────────────────────────────────────────────

const gCal: GoogleCalendarResource = {
  id: 'cal@group.calendar.google.com',
  summary: 'Local 42 Events',
  description: 'Union event calendar',
  timeZone: 'America/Toronto',
  accessRole: 'owner',
  primary: false,
}

const gEvent: GoogleEventResource = {
  id: 'g-evt-1',
  summary: 'Membership Meeting',
  description: 'Monthly general membership meeting',
  location: 'Community Hall',
  hangoutLink: 'https://meet.google.com/abc-defg-hij',
  start: { dateTime: '2025-07-15T18:00:00-04:00', timeZone: 'America/Toronto' },
  end: { dateTime: '2025-07-15T20:00:00-04:00', timeZone: 'America/Toronto' },
  status: 'confirmed',
  recurringEventId: null,
  organizer: { email: 'admin@local42.ca', displayName: 'Local 42 Admin' },
  attendees: [
    { email: 'member1@local42.ca', displayName: 'Member One', responseStatus: 'accepted', organizer: false, optional: false },
    { email: 'member2@local42.ca', displayName: null, responseStatus: 'needsAction', organizer: false, optional: true },
  ],
}

// ── Schema tests ────────────────────────────────────────────────────────────

describe('googleCalendarSchema', () => {
  it('parses a full calendar', () => {
    const result = googleCalendarSchema.parse(gCal)
    expect(result.summary).toBe('Local 42 Events')
  })

  it('parses a minimal calendar', () => {
    const result = googleCalendarSchema.parse({ id: 'x', summary: 'Test' })
    expect(result.id).toBe('x')
  })
})

describe('googleEventSchema', () => {
  it('parses a full event', () => {
    const result = googleEventSchema.parse(gEvent)
    expect(result.attendees).toHaveLength(2)
  })

  it('defaults summary to (No Title) when undefined', () => {
    const result = googleEventSchema.parse({
      id: 'e1',
      start: { date: '2025-01-01' },
      end: { date: '2025-01-02' },
    })
    expect(result.summary).toBe('(No Title)')
  })
})

// ── Mapping tests ───────────────────────────────────────────────────────────

describe('mapGoogleCalendar', () => {
  it('maps a Google calendar to CalendarSource', () => {
    const result = mapGoogleCalendar(gCal)
    expect(result).toEqual({
      externalId: 'cal@group.calendar.google.com',
      provider: 'GOOGLE',
      calendarName: 'Local 42 Events',
      description: 'Union event calendar',
      timezone: 'America/Toronto',
      isShared: false,
      syncEnabled: true,
    })
  })

  it('marks non-owner calendars as shared', () => {
    const shared = { ...gCal, accessRole: 'reader' }
    expect(mapGoogleCalendar(shared).isShared).toBe(true)
  })
})

describe('mapGoogleEvent', () => {
  it('maps a Google event to CalendarEvent', () => {
    const result = mapGoogleEvent(gEvent, 'cal-1')
    expect(result.externalId).toBe('g-evt-1')
    expect(result.provider).toBe('GOOGLE')
    expect(result.calendarId).toBe('cal-1')
    expect(result.title).toBe('Membership Meeting')
    expect(result.location).toBe('Community Hall')
    expect(result.meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
    expect(result.status).toBe('confirmed')
    expect(result.allDay).toBe(false)
    expect(result.isRecurring).toBe(false)
    expect(result.attendeeCount).toBe(2)
  })

  it('detects all-day events from date-only start', () => {
    const allDay: GoogleEventResource = {
      ...gEvent,
      start: { date: '2025-07-15' },
      end: { date: '2025-07-16' },
    }
    const result = mapGoogleEvent(allDay, 'cal-1')
    expect(result.allDay).toBe(true)
    expect(result.startTime).toBe('2025-07-15')
  })

  it('detects recurring events', () => {
    const recurring = { ...gEvent, recurringEventId: 'parent-1' }
    expect(mapGoogleEvent(recurring, 'cal-1').isRecurring).toBe(true)
  })

  it('uses (No Title) when summary is null', () => {
    const parsed = googleEventSchema.parse({
      ...gEvent,
      summary: null,
    })
    expect(mapGoogleEvent(parsed, 'cal-1').title).toBe('(No Title)')
  })
})

describe('mapGoogleAttendees', () => {
  it('maps event attendees', () => {
    const result = mapGoogleAttendees(gEvent)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      externalId: 'g-evt-1-member1@local42.ca',
      provider: 'GOOGLE',
      eventId: 'g-evt-1',
      email: 'member1@local42.ca',
      displayName: 'Member One',
      responseStatus: 'accepted',
      isOrganizer: false,
      isOptional: false,
    })
    expect(result[1]!.responseStatus).toBe('needs_action')
    expect(result[1]!.isOptional).toBe(true)
    expect(result[1]!.displayName).toBeUndefined()
  })

  it('returns empty array when no attendees', () => {
    const noAtt = { ...gEvent, attendees: undefined }
    expect(mapGoogleAttendees(noAtt)).toEqual([])
  })
})

// ── Client factory test ─────────────────────────────────────────────────────

describe('createGoogleCalendarClient', () => {
  it('returns a client with GOOGLE provider', () => {
    const transport: GoogleCalendarTransport = {
      listCalendars: async () => [gCal],
      listEvents: async () => [gEvent],
    }
    const client = createGoogleCalendarClient(transport)
    expect(client.provider).toBe('GOOGLE')
  })

  it('fetchCalendars maps through transport', async () => {
    const transport: GoogleCalendarTransport = {
      listCalendars: async () => [gCal],
      listEvents: async () => [],
    }
    const client = createGoogleCalendarClient(transport)
    const cals = await client.fetchCalendars('org1')
    expect(cals).toHaveLength(1)
    expect(cals[0]!.calendarName).toBe('Local 42 Events')
  })

  it('healthCheck returns ok on success', async () => {
    const transport: GoogleCalendarTransport = {
      listCalendars: async () => [],
      listEvents: async () => [],
    }
    const client = createGoogleCalendarClient(transport)
    const health = await client.healthCheck()
    expect(health.ok).toBe(true)
  })

  it('healthCheck returns not ok on failure', async () => {
    const transport: GoogleCalendarTransport = {
      listCalendars: async () => { throw new Error('auth expired') },
      listEvents: async () => [],
    }
    const client = createGoogleCalendarClient(transport)
    const health = await client.healthCheck()
    expect(health.ok).toBe(false)
  })
})
