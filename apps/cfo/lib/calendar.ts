/**
 * Calendar — Outlook & Google Calendar
 *
 * Provides calendar scheduling for CFO tasks: filing deadlines,
 * audit appointments, month-end close reminders, and board meetings.
 *
 * @module cfo/calendar
 */

import {
  createOutlookCalendarClient as createOutlookClient,
  createGoogleCalendarClient as createGoogleClient,
  type GraphCalendarTransport as BaseGraphCalendarTransport,
  type GoogleCalendarTransport as BaseGoogleCalendarTransport,
} from '@nzila/integrations-calendar'

// ── Types ───────────────────────────────────────────────────────────────────

export interface GraphCalendarTransport { accessToken: string; baseUrl?: string }
export interface GoogleCalendarTransport {
  accessToken: string
  baseUrl?: string
}

interface CalendarEntry { externalId: string; name: string }
interface CalendarEvent { externalId: string; title: string; start: string; end: string }

interface CalendarClient {
  fetchCalendars(userId: string): Promise<CalendarEntry[]>
  fetchEvents(userId: string, calendarId: string, since?: string): Promise<CalendarEvent[]>
  healthCheck(): Promise<{ ok: boolean; provider: string }>
}

type GraphCalendarsResult = Awaited<ReturnType<BaseGraphCalendarTransport['listCalendars']>>
type GraphEventsResult = Awaited<ReturnType<BaseGraphCalendarTransport['listEvents']>>
type GoogleCalendarsResult = Awaited<ReturnType<BaseGoogleCalendarTransport['listCalendars']>>
type GoogleEventsResult = Awaited<ReturnType<BaseGoogleCalendarTransport['listEvents']>>

function mapCalendar(cal: { externalId: string; calendarName: string }): CalendarEntry {
  return { externalId: cal.externalId, name: cal.calendarName }
}

function mapEvent(event: { externalId: string; title: string; startTime: string; endTime: string }): CalendarEvent {
  return {
    externalId: event.externalId,
    title: event.title,
    start: event.startTime,
    end: event.endTime,
  }
}

function createOutlookTransport(config: GraphCalendarTransport): BaseGraphCalendarTransport {
  const baseUrl = config.baseUrl ?? 'https://graph.microsoft.com/v1.0'

  return {
    async listCalendars(userId: string) {
      const target = userId ? `users/${encodeURIComponent(userId)}` : 'me'
      const response = await fetch(`${baseUrl}/${target}/calendars`, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Graph calendars fetch failed: ${response.status}`)
      }

      const json = (await response.json()) as { value?: unknown[] }
      return Array.isArray(json.value) ? (json.value as GraphCalendarsResult) : []
    },
    async listEvents(userId: string, calendarId: string, since?: string) {
      const target = userId ? `users/${encodeURIComponent(userId)}` : 'me'
      const params = new URLSearchParams()
      if (since) params.set('startDateTime', since)
      const query = params.toString()
      const response = await fetch(
        `${baseUrl}/${target}/calendars/${encodeURIComponent(calendarId)}/events${query ? `?${query}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        },
      )

      if (!response.ok) {
        throw new Error(`Graph events fetch failed: ${response.status}`)
      }

      const json = (await response.json()) as { value?: unknown[] }
      return Array.isArray(json.value) ? (json.value as GraphEventsResult) : []
    },
  }
}

function createGoogleTransport(config: GoogleCalendarTransport): BaseGoogleCalendarTransport {
  const baseUrl = config.baseUrl ?? 'https://www.googleapis.com/calendar/v3'

  return {
    async listCalendars() {
      const response = await fetch(`${baseUrl}/users/me/calendarList`, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Google calendars fetch failed: ${response.status}`)
      }

      const json = (await response.json()) as { items?: unknown[] }
      return Array.isArray(json.items) ? (json.items as GoogleCalendarsResult) : []
    },
    async listEvents(calendarId: string, since?: string) {
      const params = new URLSearchParams()
      if (since) params.set('timeMin', since)
      params.set('singleEvents', 'true')
      params.set('orderBy', 'startTime')
      const response = await fetch(
        `${baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        },
      )

      if (!response.ok) {
        throw new Error(`Google events fetch failed: ${response.status}`)
      }

      const json = (await response.json()) as { items?: unknown[] }
      return Array.isArray(json.items) ? (json.items as GoogleEventsResult) : []
    },
  }
}

// ── Factories ───────────────────────────────────────────────────────────────

export function createOutlookCalendarClient(transport: GraphCalendarTransport, userId: string): CalendarClient {
  const client = createOutlookClient(createOutlookTransport(transport), userId)
  return {
    async fetchCalendars(_userId) {
      const calendars = await client.fetchCalendars('')
      return calendars.map(mapCalendar)
    },
    async fetchEvents(_user, calendarId, since) {
      const events = await client.fetchEvents('', calendarId, since)
      return events.map(mapEvent)
    },
    async healthCheck() {
      const health = await client.healthCheck()
      return { ok: health.ok, provider: 'outlook' }
    },
  }
}

export function createGoogleCalendarClient(transport: GoogleCalendarTransport): CalendarClient {
  const client = createGoogleClient(createGoogleTransport(transport))
  return {
    async fetchCalendars(_userId) {
      const calendars = await client.fetchCalendars('')
      return calendars.map(mapCalendar)
    },
    async fetchEvents(_user, calendarId, since) {
      const events = await client.fetchEvents('', calendarId, since)
      return events.map(mapEvent)
    },
    async healthCheck() {
      const health = await client.healthCheck()
      return { ok: health.ok, provider: 'google' }
    },
  }
}

// ── CFO Facades ─────────────────────────────────────────────────────────────

export type CalendarProvider = 'outlook' | 'google'

export interface CFOCalendarEvent {
  title: string
  description: string
  startDate: string
  endDate: string
  allDay?: boolean
  attendees?: string[]
  location?: string
  reminderMinutes?: number
  category?: 'filing_deadline' | 'audit' | 'month_end' | 'board_meeting' | 'tax_installment' | 'other'
}

/**
 * Fetch upcoming CFO-relevant calendar events from Outlook.
 */
export async function fetchOutlookCFOEvents(
  transport: GraphCalendarTransport,
  userId: string,
  since?: string,
) {
  const client = createOutlookCalendarClient(transport, userId)
  const calendars = await client.fetchCalendars('')
  const events = []
  for (const cal of calendars) {
    const calEvents = await client.fetchEvents('', cal.externalId, since)
    events.push(...calEvents)
  }
  return events
}

/**
 * Fetch upcoming CFO-relevant calendar events from Google.
 */
export async function fetchGoogleCFOEvents(
  transport: GoogleCalendarTransport,
  since?: string,
) {
  const client = createGoogleCalendarClient(transport)
  const calendars = await client.fetchCalendars('')
  const events = []
  for (const cal of calendars) {
    const calEvents = await client.fetchEvents('', cal.externalId, since)
    events.push(...calEvents)
  }
  return events
}

/**
 * Check calendar provider health.
 */
export async function checkCalendarHealth(
  provider: CalendarProvider,
  transport: GraphCalendarTransport | GoogleCalendarTransport,
  userId?: string,
) {
  if (provider === 'outlook') {
    const client = createOutlookCalendarClient(transport as GraphCalendarTransport, userId ?? '')
    return client.healthCheck()
  }
  const client = createGoogleCalendarClient(transport as GoogleCalendarTransport)
  return client.healthCheck()
}

/**
 * Schedule recurring tax filing deadlines for a fiscal year.
 */
export function getCanadianTaxDeadlines(taxYear: number): CFOCalendarEvent[] {
  return [
    {
      title: `T2 Corporate Tax Filing Deadline — FY${taxYear}`,
      description: `6 months after fiscal year-end. File T2 return and pay balance owing.`,
      startDate: `${taxYear + 1}-06-30`,
      endDate: `${taxYear + 1}-06-30`,
      allDay: true,
      category: 'filing_deadline',
      reminderMinutes: 14400, // 10 days
    },
    {
      title: `GST/HST Q1 Filing — FY${taxYear}`,
      description: `File GST/HST return for Q1.`,
      startDate: `${taxYear}-04-30`,
      endDate: `${taxYear}-04-30`,
      allDay: true,
      category: 'filing_deadline',
      reminderMinutes: 10080, // 7 days
    },
    {
      title: `GST/HST Q2 Filing — FY${taxYear}`,
      description: `File GST/HST return for Q2.`,
      startDate: `${taxYear}-07-31`,
      endDate: `${taxYear}-07-31`,
      allDay: true,
      category: 'filing_deadline',
    },
    {
      title: `GST/HST Q3 Filing — FY${taxYear}`,
      description: `File GST/HST return for Q3.`,
      startDate: `${taxYear}-10-31`,
      endDate: `${taxYear}-10-31`,
      allDay: true,
      category: 'filing_deadline',
    },
    {
      title: `GST/HST Q4 Filing — FY${taxYear}`,
      description: `File GST/HST return for Q4.`,
      startDate: `${taxYear + 1}-01-31`,
      endDate: `${taxYear + 1}-01-31`,
      allDay: true,
      category: 'filing_deadline',
    },
    {
      title: `T4/T4A Filing Deadline — FY${taxYear}`,
      description: `File T4 and T4A information returns.`,
      startDate: `${taxYear + 1}-02-28`,
      endDate: `${taxYear + 1}-02-28`,
      allDay: true,
      category: 'filing_deadline',
      reminderMinutes: 20160, // 14 days
    },
    {
      title: `Corporate Tax Instalment — Q1 ${taxYear}`,
      description: `Quarterly corporate tax instalment payment due.`,
      startDate: `${taxYear}-03-31`,
      endDate: `${taxYear}-03-31`,
      allDay: true,
      category: 'tax_installment',
    },
    {
      title: `Corporate Tax Instalment — Q2 ${taxYear}`,
      description: `Quarterly corporate tax instalment payment due.`,
      startDate: `${taxYear}-06-30`,
      endDate: `${taxYear}-06-30`,
      allDay: true,
      category: 'tax_installment',
    },
    {
      title: `Corporate Tax Instalment — Q3 ${taxYear}`,
      description: `Quarterly corporate tax instalment payment due.`,
      startDate: `${taxYear}-09-30`,
      endDate: `${taxYear}-09-30`,
      allDay: true,
      category: 'tax_installment',
    },
    {
      title: `Corporate Tax Instalment — Q4 ${taxYear}`,
      description: `Quarterly corporate tax instalment payment due.`,
      startDate: `${taxYear}-12-31`,
      endDate: `${taxYear}-12-31`,
      allDay: true,
      category: 'tax_installment',
    },
  ]
}
