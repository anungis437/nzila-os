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
import {
  CalendarProviderSchema,
  EventStatusSchema,
  AttendeeResponseSchema,
  createGoogleCalendarClient as createGoogleCalendarClientFromBarrel,
  createOutlookCalendarClient,
} from './index'

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

  it('omits optional description/timezone when nullish', () => {
    const cal = {
      ...gCal,
      description: null,
      timeZone: undefined,
    }
    const mapped = mapGoogleCalendar(cal)
    expect(mapped.description).toBeUndefined()
    expect(mapped.timezone).toBeUndefined()
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

  it('falls back for missing dateTime/date and unknown status', () => {
    const parsed = googleEventSchema.parse({
      ...gEvent,
      status: undefined,
      start: {},
      end: {},
    })

    const mapped = mapGoogleEvent(parsed, 'cal-1')
    expect(mapped.status).toBe('confirmed')
    expect(mapped.startTime).toBe('')
    expect(mapped.endTime).toBe('')
  })

  it('maps nullable optional fields to undefined', () => {
    const parsed = googleEventSchema.parse({
      ...gEvent,
      description: null,
      location: null,
      hangoutLink: null,
      organizer: undefined,
      attendees: undefined,
    })

    const mapped = mapGoogleEvent(parsed, 'cal-1')
    expect(mapped.description).toBeUndefined()
    expect(mapped.location).toBeUndefined()
    expect(mapped.meetingUrl).toBeUndefined()
    expect(mapped.organizerEmail).toBeUndefined()
    expect(mapped.organizerName).toBeUndefined()
    expect(mapped.attendeeCount).toBe(0)
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

  it('maps unknown responseStatus to needs_action and defaults flags', () => {
    const event: GoogleEventResource = {
      ...gEvent,
      attendees: [
        { email: 'x@local42.ca', displayName: null, responseStatus: 'unknown_state' },
      ],
    }
    const attendees = mapGoogleAttendees(event)
    expect(attendees[0]!.responseStatus).toBe('needs_action')
    expect(attendees[0]!.isOrganizer).toBe(false)
    expect(attendees[0]!.isOptional).toBe(false)
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

  it('fetchEvents forwards since value and maps results', async () => {
    let capturedSince: string | undefined
    const transport: GoogleCalendarTransport = {
      listCalendars: async () => [],
      listEvents: async (_calendarId, since) => {
        capturedSince = since
        return [gEvent]
      },
    }
    const client = createGoogleCalendarClient(transport)
    const events = await client.fetchEvents('org1', 'cal-1', '2025-01-01T00:00:00Z')

    expect(capturedSince).toBe('2025-01-01T00:00:00Z')
    expect(events).toHaveLength(1)
    expect(events[0]!.title).toBe('Membership Meeting')
  })

  it('fetchAttendees returns empty array (adapter contract)', async () => {
    const client = createGoogleCalendarClient({
      listCalendars: async () => [],
      listEvents: async () => [],
    })
    await expect(client.fetchAttendees('org1', 'evt-1')).resolves.toEqual([])
  })

  it('barrel exports expose client factories and schemas', () => {
    expect(CalendarProviderSchema.parse('GOOGLE')).toBe('GOOGLE')
    expect(EventStatusSchema.parse('confirmed')).toBe('confirmed')
    expect(AttendeeResponseSchema.parse('needs_action')).toBe('needs_action')

    const gClient = createGoogleCalendarClientFromBarrel({
      listCalendars: async () => [],
      listEvents: async () => [],
    })
    const oClient = createOutlookCalendarClient(
      {
        listCalendars: async () => [],
        listEvents: async () => [],
      },
      'user-1',
    )

    expect(gClient.provider).toBe('GOOGLE')
    expect(oClient.provider).toBe('OUTLOOK')
  })
})
