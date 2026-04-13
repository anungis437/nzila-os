import { describe, it, expect } from 'vitest'
import {
  graphCalendarSchema,
  graphEventSchema,
  mapGraphCalendar,
  mapGraphEvent,
  mapGraphAttendees,
  createOutlookCalendarClient,
  type GraphCalendar,
  type GraphEvent,
  type GraphCalendarTransport,
} from './outlook'

// ── Fixtures ────────────────────────────────────────────────────────────────

const graphCal: GraphCalendar = {
  id: 'cal-1',
  name: 'Union Calendar',
  color: 'blue',
  owner: { name: 'Alice', address: 'alice@cape.ca' },
  canEdit: true,
  isShared: true,
}

const graphEvent: GraphEvent = {
  id: 'evt-1',
  subject: 'Bargaining Session',
  bodyPreview: 'Q4 bargaining round',
  location: { displayName: 'Room 201' },
  onlineMeeting: { joinUrl: 'https://teams.example/join' },
  start: { dateTime: '2025-06-01T09:00:00', timeZone: 'America/Toronto' },
  end: { dateTime: '2025-06-01T11:00:00', timeZone: 'America/Toronto' },
  isAllDay: false,
  isCancelled: false,
  isOrganizer: true,
  recurrence: null,
  organizer: { emailAddress: { name: 'Alice', address: 'alice@cape.ca' } },
  attendees: [
    { emailAddress: { name: 'Bob', address: 'bob@cape.ca' }, status: { response: 'accepted' }, type: 'required' },
    { emailAddress: { name: 'Carol', address: 'carol@cape.ca' }, status: { response: 'tentativelyAccepted' }, type: 'optional' },
  ],
}

// ── Schema tests ────────────────────────────────────────────────────────────

describe('graphCalendarSchema', () => {
  it('parses a valid calendar', () => {
    expect(graphCalendarSchema.parse(graphCal)).toEqual(graphCal)
  })

  it('parses a minimal calendar', () => {
    const result = graphCalendarSchema.parse({ id: 'c', name: 'My Cal' })
    expect(result).toEqual({ id: 'c', name: 'My Cal' })
  })
})

describe('graphEventSchema', () => {
  it('parses a full event', () => {
    const result = graphEventSchema.parse(graphEvent)
    expect(result.id).toBe('evt-1')
    expect(result.attendees).toHaveLength(2)
  })

  it('parses an event with null optionals', () => {
    const minimal = {
      id: 'evt-2',
      subject: 'Standup',
      start: { dateTime: '2025-01-01T09:00:00', timeZone: 'UTC' },
      end: { dateTime: '2025-01-01T09:15:00', timeZone: 'UTC' },
    }
    expect(graphEventSchema.parse(minimal).subject).toBe('Standup')
  })
})

// ── Mapping tests ───────────────────────────────────────────────────────────

describe('mapGraphCalendar', () => {
  it('maps a Graph calendar to CalendarSource', () => {
    const result = mapGraphCalendar(graphCal)
    expect(result).toEqual({
      externalId: 'cal-1',
      provider: 'OUTLOOK',
      calendarName: 'Union Calendar',
      ownerEmail: 'alice@cape.ca',
      isShared: true,
      syncEnabled: true,
    })
  })

  it('handles missing owner', () => {
    const cal: GraphCalendar = { id: 'x', name: 'Test' }
    const result = mapGraphCalendar(cal)
    expect(result.ownerEmail).toBeUndefined()
    expect(result.isShared).toBe(false)
  })
})

describe('mapGraphEvent', () => {
  it('maps a Graph event to CalendarEvent', () => {
    const result = mapGraphEvent(graphEvent, 'cal-1')
    expect(result.externalId).toBe('evt-1')
    expect(result.provider).toBe('OUTLOOK')
    expect(result.calendarId).toBe('cal-1')
    expect(result.title).toBe('Bargaining Session')
    expect(result.description).toBe('Q4 bargaining round')
    expect(result.location).toBe('Room 201')
    expect(result.meetingUrl).toBe('https://teams.example/join')
    expect(result.status).toBe('confirmed')
    expect(result.allDay).toBe(false)
    expect(result.isRecurring).toBe(false)
    expect(result.organizerEmail).toBe('alice@cape.ca')
    expect(result.attendeeCount).toBe(2)
  })

  it('sets status to cancelled when isCancelled', () => {
    const cancelled = { ...graphEvent, isCancelled: true }
    expect(mapGraphEvent(cancelled, 'cal-1').status).toBe('cancelled')
  })

  it('detects recurring events', () => {
    const recurring = { ...graphEvent, recurrence: { pattern: {} } }
    expect(mapGraphEvent(recurring, 'cal-1').isRecurring).toBe(true)
  })

  it('maps nullable optional fields to undefined and attendeeCount to 0', () => {
    const event: GraphEvent = {
      ...graphEvent,
      bodyPreview: null,
      location: null,
      onlineMeeting: null,
      organizer: undefined,
      attendees: undefined,
      isAllDay: undefined,
    }

    const mapped = mapGraphEvent(event, 'cal-1')
    expect(mapped.description).toBeUndefined()
    expect(mapped.location).toBeUndefined()
    expect(mapped.meetingUrl).toBeUndefined()
    expect(mapped.organizerEmail).toBeUndefined()
    expect(mapped.organizerName).toBeUndefined()
    expect(mapped.attendeeCount).toBe(0)
    expect(mapped.allDay).toBe(false)
  })
})

describe('mapGraphAttendees', () => {
  it('maps event attendees', () => {
    const result = mapGraphAttendees(graphEvent)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      externalId: 'evt-1-bob@cape.ca',
      provider: 'OUTLOOK',
      eventId: 'evt-1',
      email: 'bob@cape.ca',
      displayName: 'Bob',
      responseStatus: 'accepted',
      isOrganizer: false,
      isOptional: false,
    })
    expect(result[1]!.responseStatus).toBe('tentative')
    expect(result[1]!.isOptional).toBe(true)
  })

  it('returns empty array when no attendees', () => {
    const noAtt = { ...graphEvent, attendees: undefined }
    expect(mapGraphAttendees(noAtt)).toEqual([])
  })

  it('falls back to needs_action for unknown attendee response', () => {
    const event: GraphEvent = {
      ...graphEvent,
      attendees: [
        {
          emailAddress: { name: 'Zed', address: 'zed@cape.ca' },
          status: { response: 'mystery' },
        },
      ],
    }

    const result = mapGraphAttendees(event)
    expect(result[0]!.responseStatus).toBe('needs_action')
  })

  it('maps null attendee displayName to undefined', () => {
    const event: GraphEvent = {
      ...graphEvent,
      attendees: [
        {
          emailAddress: { name: null, address: 'nullname@cape.ca' },
          status: { response: 'accepted' },
        },
      ],
    }
    const result = mapGraphAttendees(event)
    expect(result[0]!.displayName).toBeUndefined()
  })
})

// ── Client factory test ─────────────────────────────────────────────────────

describe('createOutlookCalendarClient', () => {
  it('returns a client with OUTLOOK provider', () => {
    const transport: GraphCalendarTransport = {
      listCalendars: async () => [graphCal],
      listEvents: async () => [graphEvent],
    }
    const client = createOutlookCalendarClient(transport, 'u1')
    expect(client.provider).toBe('OUTLOOK')
  })

  it('fetchCalendars maps through transport', async () => {
    const transport: GraphCalendarTransport = {
      listCalendars: async () => [graphCal],
      listEvents: async () => [],
    }
    const client = createOutlookCalendarClient(transport, 'u1')
    const cals = await client.fetchCalendars('org1')
    expect(cals).toHaveLength(1)
    expect(cals[0]!.calendarName).toBe('Union Calendar')
  })

  it('fetchEvents maps through transport', async () => {
    const transport: GraphCalendarTransport = {
      listCalendars: async () => [],
      listEvents: async () => [graphEvent],
    }
    const client = createOutlookCalendarClient(transport, 'u1')
    const events = await client.fetchEvents('org1', 'cal-1')
    expect(events).toHaveLength(1)
    expect(events[0]!.title).toBe('Bargaining Session')
  })

  it('healthCheck returns ok on success', async () => {
    const transport: GraphCalendarTransport = {
      listCalendars: async () => [],
      listEvents: async () => [],
    }
    const client = createOutlookCalendarClient(transport, 'u1')
    const health = await client.healthCheck()
    expect(health.ok).toBe(true)
  })

  it('healthCheck returns not ok on failure', async () => {
    const transport: GraphCalendarTransport = {
      listCalendars: async () => { throw new Error('timeout') },
      listEvents: async () => [],
    }
    const client = createOutlookCalendarClient(transport, 'u1')
    const health = await client.healthCheck()
    expect(health.ok).toBe(false)
  })

  it('fetchAttendees returns empty array because attendees are embedded in events', async () => {
    const transport: GraphCalendarTransport = {
      listCalendars: async () => [],
      listEvents: async () => [],
    }
    const client = createOutlookCalendarClient(transport, 'u1')
    await expect(client.fetchAttendees('org1', 'evt-1')).resolves.toEqual([])
  })
})
