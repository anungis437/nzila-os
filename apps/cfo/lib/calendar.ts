/**
 * Calendar — Outlook & Google Calendar
 *
 * Provides calendar scheduling for CFO tasks: filing deadlines,
 * audit appointments, month-end close reminders, and board meetings.
 * Self-contained stubs until @nzila/integrations-calendar is available.
 *
 * @module cfo/calendar
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface GraphCalendarTransport { accessToken: string; baseUrl?: string }
export interface GoogleCalendarTransport { credentials: Record<string, string> }

interface CalendarEntry { externalId: string; name: string }
interface CalendarEvent { externalId: string; title: string; start: string; end: string }

interface CalendarClient {
  fetchCalendars(userId: string): Promise<CalendarEntry[]>
  fetchEvents(userId: string, calendarId: string, since?: string): Promise<CalendarEvent[]>
  healthCheck(): Promise<{ ok: boolean; provider: string }>
}

// ── Stub Factories ──────────────────────────────────────────────────────────

export function createOutlookCalendarClient(_transport: GraphCalendarTransport, _userId: string): CalendarClient {
  return {
    async fetchCalendars() { return [] },
    async fetchEvents() { return [] },
    async healthCheck() { return { ok: true, provider: 'outlook' } },
  }
}

export function createGoogleCalendarClient(_transport: GoogleCalendarTransport): CalendarClient {
  return {
    async fetchCalendars() { return [] },
    async fetchEvents() { return [] },
    async healthCheck() { return { ok: true, provider: 'google' } },
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
