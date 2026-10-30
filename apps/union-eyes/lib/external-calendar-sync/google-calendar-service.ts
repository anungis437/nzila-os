/**
 * Google Calendar Sync Service
 * 
 * Handles OAuth authentication and bidirectional sync with Google Calendar.
 * 
 * Features:
 * - OAuth 2.0 authentication flow
 * - Import events from Google Calendar
 * - Export events to Google Calendar
 * - Incremental sync using sync tokens
 * - Conflict resolution
 * 
 * @module google-calendar-service
 */

import { google, calendar_v3 } from 'googleapis';
import { db } from '@/db/db';
import { 
  externalCalendarConnections, 
  calendars, 
  calendarEvents,
  type CalendarEvent,
} from '@/db/schema/calendar-schema';
import { eq, and } from 'drizzle-orm';
import { decryptCalendarToken, encryptCalendarToken } from './token-crypto';
import { logger } from '@/lib/logger';

const calendar = google.calendar('v3');

// ============================================================================
// OAUTH CONFIGURATION
// ============================================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3000/api/calendar-sync/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

type CalendarMapping = {
  externalId: string;
  localCalendarId: string;
  syncToken?: string;
  deltaLink?: string;
};

/**
 * Get OAuth2 client
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate authorization URL
 */
export function getAuthorizationUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId, // Pass userId to identify user in callback
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: new Date(tokens.expiry_date!),
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(connectionId: string): Promise<string> {
  let organizationId: string | undefined;
  try {
    const [connection] = await db
      .select()
      .from(externalCalendarConnections)
      .where(eq(externalCalendarConnections.id, connectionId))
      .limit(1);

    if (!connection || connection.provider !== 'google') {
      throw new Error('Google Calendar connection not found');
    }
    organizationId = connection.organizationId;

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: decryptCalendarToken(connection.refreshToken),
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update connection with new tokens
    await db
      .update(externalCalendarConnections)
      .set({
        accessToken: encryptCalendarToken(credentials.access_token!),
        refreshToken: credentials.refresh_token
          ? encryptCalendarToken(credentials.refresh_token)
          : undefined,
        tokenExpiresAt: new Date(credentials.expiry_date!),
        updatedAt: new Date(),
      })
      .where(and(eq(externalCalendarConnections.id, connectionId), eq(externalCalendarConnections.organizationId, connection.organizationId)));

    return credentials.access_token!;
  } catch (error) {
// Mark connection as failed
    if (organizationId) {
      await db
        .update(externalCalendarConnections)
        .set({
          syncStatus: 'failed',
          syncError: error instanceof Error ? error.message : 'Token refresh failed',
        })
        .where(and(eq(externalCalendarConnections.id, connectionId), eq(externalCalendarConnections.organizationId, organizationId)));
    }
    
    throw error;
  }
}

/**
 * Get authenticated OAuth2 client for a connection
 */
async function getAuthenticatedClient(connectionId: string) {
  const [connection] = await db
    .select()
    .from(externalCalendarConnections)
    .where(eq(externalCalendarConnections.id, connectionId))
    .limit(1);

  if (!connection) {
    throw new Error('Connection not found');
  }

  // Check if token needs refresh
  const now = new Date();
  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : new Date(0);
  
  let accessToken = connection.accessToken;
  
  if (now >= expiresAt) {
    accessToken = await refreshAccessToken(connectionId);
  }

  const resolvedAccessToken = decryptCalendarToken(accessToken);
  const resolvedRefreshToken = decryptCalendarToken(connection.refreshToken);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: resolvedAccessToken,
    refresh_token: resolvedRefreshToken,
  });

  return { oauth2Client, organizationId: connection.organizationId };
}

// ============================================================================
// CALENDAR LIST
// ============================================================================

/**
 * List all Google calendars for a user
 */
export async function listGoogleCalendars(connectionId: string) {
  try {
    const { oauth2Client } = await getAuthenticatedClient(connectionId);
    
    const response = await calendar.calendarList.list({
      auth: oauth2Client,
      maxResults: 250,
    });

    return response.data.items || [];
  } catch (error) {
throw error;
  }
}

// ============================================================================
// EVENT SYNC
// ============================================================================

/** Events per list call; Google pages the rest, and the import follows every page. */
export const GOOGLE_PAGE_SIZE = 250;
/** Upper bound on pages per import (12,500 events). An import that hits it is incomplete and says so. */
export const GOOGLE_MAX_PAGES = 50;

export class CalendarImportError extends Error {
  constructor(message: string, readonly detail: { failed: number; pages: number; incomplete: boolean }) {
    super(message);
    this.name = 'CalendarImportError';
  }
}

const isGone = (error: unknown) => {
  const e = error as { code?: number; status?: number; response?: { status?: number } };
  return e?.code === 410 || e?.status === 410 || e?.response?.status === 410;
};

/**
 * Import events from Google Calendar.
 *
 * Every page is followed. The sync token Google returns with the last page is stored only when every page was read and every event
 * was applied; otherwise the import throws, so the caller records a failed sync and the next run starts from the same point rather
 * than the connection being marked synced with events missing. A stored token that Google no longer accepts (410) is dropped and
 * the import falls back to a full sync.
 */
export async function importGoogleEvents(
  connectionId: string,
  localCalendarId: string,
  googleCalendarId: string,
  options?: {
    timeMin?: Date;
    timeMax?: Date;
    syncToken?: string;
  }
): Promise<{ imported: number; updated: number; deleted: number; total: number; pages: number; incremental: boolean }> {
  const { oauth2Client, organizationId } = await getAuthenticatedClient(connectionId);

  const [localCalendar] = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.id, localCalendarId), eq(calendars.organizationId, organizationId)))
    .limit(1);
  // The query is organization-scoped; the explicit check keeps a mis-scoped row from ever being imported into.
  if (!localCalendar || localCalendar.organizationId !== organizationId) {
    throw new Error('Local calendar not found');
  }

  const listParams = (syncToken: string | undefined, pageToken: string | undefined): calendar_v3.Params$Resource$Events$List => {
    const params: calendar_v3.Params$Resource$Events$List = {
      auth: oauth2Client,
      calendarId: googleCalendarId,
      singleEvents: true,
      maxResults: GOOGLE_PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    };
    if (syncToken) {
      // An incremental list accepts neither a time window nor an ordering; Google answers 400 if they are sent with a sync token.
      params.syncToken = syncToken;
    } else {
      params.orderBy = 'startTime';
      params.timeMin = options?.timeMin?.toISOString() || new Date().toISOString();
      if (options?.timeMax) params.timeMax = options.timeMax.toISOString();
    }
    return params;
  };

  let imported = 0;
  let updated = 0;
  let deleted = 0;
  let total = 0;
  let failed = 0;
  let pages = 0;
  let nextSyncToken: string | null | undefined;
  let incomplete = false;
  let syncToken = options?.syncToken;
  const incremental = Boolean(syncToken);

  const applyPage = async (events: calendar_v3.Schema$Event[]) => {
    for (const googleEvent of events) {
      total += 1;
      try {
        if (googleEvent.status === 'cancelled') {
          await handleDeletedGoogleEvent(localCalendarId, googleEvent.id!, organizationId);
          deleted += 1;
          continue;
        }
        const [existingEvent] = await db
          .select()
          .from(calendarEvents)
          .where(and(
            eq(calendarEvents.calendarId, localCalendarId),
            eq(calendarEvents.organizationId, organizationId),
            eq(calendarEvents.externalEventId, googleEvent.id!),
          ))
          .limit(1);
        const eventData = mapGoogleEventToLocal(googleEvent, localCalendarId, localCalendar.organizationId);
        if (existingEvent) {
          await db
            .update(calendarEvents)
            .set({ ...eventData, updatedAt: new Date() })
            .where(and(eq(calendarEvents.id, existingEvent.id), eq(calendarEvents.organizationId, organizationId)));
          updated += 1;
        } else {
          await db.insert(calendarEvents).values(eventData);
          imported += 1;
        }
      } catch (error) {
        failed += 1;
        logger.error('Google calendar event was not applied', { connectionId, eventId: googleEvent.id, error: String(error) });
      }
    }
  };

  const readAllPages = async () => {
    let pageToken: string | undefined;
    do {
      if (pages >= GOOGLE_MAX_PAGES) {
        incomplete = true;
        return;
      }
      const response = await calendar.events.list(listParams(syncToken, pageToken));
      pages += 1;
      await applyPage(response.data.items || []);
      pageToken = response.data.nextPageToken || undefined;
      // Google returns the sync token only with the last page.
      nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  };

  try {
    await readAllPages();
  } catch (error) {
    if (!syncToken || !isGone(error)) throw error;
    // The stored token expired: start again with a full sync over the window and replace the token with the new one.
    logger.warn('Google sync token expired; falling back to a full sync', { connectionId });
    syncToken = undefined;
    imported = updated = deleted = total = failed = pages = 0;
    nextSyncToken = undefined;
    await readAllPages();
  }

  if (failed > 0 || incomplete) {
    throw new CalendarImportError(
      incomplete
        ? `Google calendar import stopped after ${GOOGLE_MAX_PAGES} pages; the remaining events were not read`
        : `${failed} of ${total} Google calendar events were not applied`,
      { failed, pages, incomplete },
    );
  }

  await updateSyncToken(connectionId, organizationId, googleCalendarId, nextSyncToken || null);

  return { imported, updated, deleted, total, pages, incremental };
}

/**
 * Export event to Google Calendar
 */
export async function exportEventToGoogle(
  connectionId: string,
  localEventId: string,
  googleCalendarId: string
) {
  try {
    const { oauth2Client, organizationId } = await getAuthenticatedClient(connectionId);
    
    // Get local event
    const [localEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, localEventId))
      .limit(1);

    if (!localEvent || localEvent.organizationId !== organizationId) {
      throw new Error('Local event not found');
    }

    const googleEvent = mapLocalEventToGoogle(localEvent);

    // Check if event already exists in Google
    if (localEvent.externalEventId) {
      // Update existing event
      const response = await calendar.events.update({
        auth: oauth2Client,
        calendarId: googleCalendarId,
        eventId: localEvent.externalEventId,
        requestBody: googleEvent,
      });

      return response.data;
    } else {
      // Create new event
      const response = await calendar.events.insert({
        auth: oauth2Client,
        calendarId: googleCalendarId,
        requestBody: googleEvent,
      });

      // Update local event with Google event ID
      await db
        .update(calendarEvents)
        .set({
          externalEventId: response.data.id!,
          updatedAt: new Date(),
        })
        .where(and(eq(calendarEvents.id, localEventId), eq(calendarEvents.organizationId, organizationId)));

      return response.data;
    }
  } catch (error) {
throw error;
  }
}

/**
 * Delete event from Google Calendar
 */
export async function deleteEventFromGoogle(
  connectionId: string,
  googleCalendarId: string,
  googleEventId: string
) {
  try {
    const { oauth2Client } = await getAuthenticatedClient(connectionId);
    
    await calendar.events.delete({
      auth: oauth2Client,
      calendarId: googleCalendarId,
      eventId: googleEventId,
    });
  } catch (error) {
throw error;
  }
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Map Google Calendar event to local event format
 */
function mapGoogleEventToLocal(
  googleEvent: calendar_v3.Schema$Event,
  calendarId: string,
  organizationId: string,
) {
  const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
  const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
  const startDate = startTime ? new Date(startTime) : new Date();
  const endDate = endTime ? new Date(endTime) : new Date(startDate.getTime() + 60 * 60 * 1000);
  
  return {
    calendarId,
    organizationId,
    title: googleEvent.summary || 'Untitled Event',
    description: googleEvent.description || null,
    location: googleEvent.location || null,
    locationUrl: googleEvent.hangoutLink || null,
    startTime: startDate,
    endTime: endDate,
    isAllDay: !!googleEvent.start?.date,
    isRecurring: !!googleEvent.recurrence,
    recurrenceRule: googleEvent.recurrence?.[0] || null,
    eventType: 'meeting' as const,
    status: googleEvent.status === 'confirmed' ? 'confirmed' as const : 'scheduled' as const,
    organizerId: googleEvent.creator?.email || 'unknown',
    createdBy: googleEvent.creator?.email || 'google-calendar-sync',
    meetingUrl: googleEvent.hangoutLink || null,
    externalEventId: googleEvent.id,
    metadata: {
      source: 'google',
      htmlLink: googleEvent.htmlLink,
      iCalUID: googleEvent.iCalUID,
    },
  };
}

/**
 * Map local event to Google Calendar event format
 */
function mapLocalEventToGoogle(localEvent: CalendarEvent): calendar_v3.Schema$Event {
  const googleEvent: calendar_v3.Schema$Event = {
    summary: localEvent.title,
    description: localEvent.description,
    location: localEvent.location,
    start: localEvent.isAllDay
      ? { date: localEvent.startTime.toISOString().split('T')[0] }
      : { dateTime: localEvent.startTime.toISOString(), timeZone: localEvent.timezone },
    end: localEvent.isAllDay
      ? { date: localEvent.endTime.toISOString().split('T')[0] }
      : { dateTime: localEvent.endTime.toISOString(), timeZone: localEvent.timezone },
  };

  if (localEvent.recurrenceRule) {
    googleEvent.recurrence = [localEvent.recurrenceRule];
  }

  if (localEvent.meetingUrl) {
    googleEvent.conferenceData = {
      entryPoints: [
        {
          entryPointType: 'video',
          uri: localEvent.meetingUrl,
        },
      ],
    };
  }

  return googleEvent;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Handle deleted Google event. A failure propagates to the import, which counts it and fails the sync rather than leaving a
 * cancelled event looking scheduled.
 */
async function handleDeletedGoogleEvent(calendarId: string, googleEventId: string, organizationId: string) {
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarId, calendarId),
        eq(calendarEvents.organizationId, organizationId),
        eq(calendarEvents.externalEventId, googleEventId)
      )
    )
    .limit(1);

  if (event) {
    await db
      .update(calendarEvents)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, event.id), eq(calendarEvents.organizationId, organizationId)));
  }
}

/**
 * Store the sync token for incremental sync. A failure is not swallowed: the next import would otherwise start from the old token
 * and silently repeat or miss work while the connection reads as synced. The sync status itself is the caller's to set.
 */
async function updateSyncToken(
  connectionId: string,
  organizationId: string,
  googleCalendarId: string,
  syncToken: string | null
) {
  const [connection] = await db
    .select({ calendarMappings: externalCalendarConnections.calendarMappings })
    .from(externalCalendarConnections)
    .where(and(eq(externalCalendarConnections.id, connectionId), eq(externalCalendarConnections.organizationId, organizationId)))
    .limit(1);

  const mappings: CalendarMapping[] = Array.isArray(connection?.calendarMappings)
    ? (connection.calendarMappings as CalendarMapping[])
    : [];

  const updatedMappings = mappings.map((mapping) =>
    mapping.externalId === googleCalendarId ? { ...mapping, syncToken: syncToken || undefined } : mapping,
  );

  await db
    .update(externalCalendarConnections)
    .set({ calendarMappings: updatedMappings, lastSyncAt: new Date(), updatedAt: new Date() })
    .where(and(eq(externalCalendarConnections.id, connectionId), eq(externalCalendarConnections.organizationId, organizationId)));
}

/**
 * Get sync token for a calendar
 */
export function getSyncToken(_connection: any, _googleCalendarId: string): string | null {
  const connection = _connection as { calendarMappings?: CalendarMapping[] | null };
  const mappings = Array.isArray(connection.calendarMappings) ? connection.calendarMappings : [];
  const mapping = mappings.find((item) => item.externalId === _googleCalendarId);
  return mapping?.syncToken || null;
}

