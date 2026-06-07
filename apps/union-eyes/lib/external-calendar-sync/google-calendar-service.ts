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
  try {
    const [connection] = await db
      .select()
      .from(externalCalendarConnections)
      .where(eq(externalCalendarConnections.id, connectionId))
      .limit(1);

    if (!connection || connection.provider !== 'google') {
      throw new Error('Google Calendar connection not found');
    }

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
      .where(eq(externalCalendarConnections.id, connectionId));

    return credentials.access_token!;
  } catch (error) {
// Mark connection as failed
    await db
      .update(externalCalendarConnections)
      .set({
        syncStatus: 'failed',
        syncError: error instanceof Error ? error.message : 'Token refresh failed',
      })
      .where(eq(externalCalendarConnections.id, connectionId));
    
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

  return oauth2Client;
}

// ============================================================================
// CALENDAR LIST
// ============================================================================

/**
 * List all Google calendars for a user
 */
export async function listGoogleCalendars(connectionId: string) {
  try {
    const oauth2Client = await getAuthenticatedClient(connectionId);
    
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

/**
 * Import events from Google Calendar
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
) {
  try {
    const oauth2Client = await getAuthenticatedClient(connectionId);
    
    const params: calendar_v3.Params$Resource$Events$List = {
      auth: oauth2Client,
      calendarId: googleCalendarId,
      singleEvents: true,
      orderBy: 'startTime',
    };

    if (options?.syncToken) {
      // Incremental sync
      params.syncToken = options.syncToken;
    } else {
      // Full sync
      params.timeMin = options?.timeMin?.toISOString() || new Date().toISOString();
      if (options?.timeMax) {
        params.timeMax = options.timeMax.toISOString();
      }
      params.maxResults = 2500;
    }

    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    const newSyncToken = response.data.nextSyncToken;

    // Get local calendar
    const [localCalendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, localCalendarId))
      .limit(1);

    if (!localCalendar) {
      throw new Error('Local calendar not found');
    }

    let importedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    for (const googleEvent of events) {
      try {
        // Check if event is deleted
        if (googleEvent.status === 'cancelled') {
          await handleDeletedGoogleEvent(localCalendarId, googleEvent.id!);
          deletedCount++;
          continue;
        }

        // Check if event already exists
        const [existingEvent] = await db
          .select()
          .from(calendarEvents)
          .where(
            and(
              eq(calendarEvents.calendarId, localCalendarId),
              eq(calendarEvents.externalEventId, googleEvent.id!)
            )
          )
          .limit(1);

        const eventData = mapGoogleEventToLocal(googleEvent, localCalendarId, localCalendar.organizationId);

        if (existingEvent) {
          // Update existing event
          await db
            .update(calendarEvents)
            .set({
              ...eventData,
              updatedAt: new Date(),
            })
            .where(eq(calendarEvents.id, existingEvent.id));
          updatedCount++;
        } else {
          // Create new event
          await db.insert(calendarEvents).values(eventData);
          importedCount++;
        }
      } catch (_error) {
}
    }

    // Update sync token
    await updateSyncToken(connectionId, googleCalendarId, newSyncToken || null);

    return {
      imported: importedCount,
      updated: updatedCount,
      deleted: deletedCount,
      total: events.length,
    };
  } catch (error) {
throw error;
  }
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
    const oauth2Client = await getAuthenticatedClient(connectionId);
    
    // Get local event
    const [localEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, localEventId))
      .limit(1);

    if (!localEvent) {
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
        .where(eq(calendarEvents.id, localEventId));

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
    const oauth2Client = await getAuthenticatedClient(connectionId);
    
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
 * Handle deleted Google event
 */
async function handleDeletedGoogleEvent(calendarId: string, googleEventId: string) {
  try {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.calendarId, calendarId),
          eq(calendarEvents.externalEventId, googleEventId)
        )
      )
      .limit(1);

    if (event) {
      await db
        .update(calendarEvents)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(calendarEvents.id, event.id));
    }
  } catch (_error) {
}
}

/**
 * Update sync token for incremental sync
 */
async function updateSyncToken(
  connectionId: string,
  googleCalendarId: string,
  syncToken: string | null
) {
  try {
    const [connection] = await db
      .select({ calendarMappings: externalCalendarConnections.calendarMappings })
      .from(externalCalendarConnections)
      .where(eq(externalCalendarConnections.id, connectionId))
      .limit(1);

    const mappings: CalendarMapping[] = Array.isArray(connection?.calendarMappings)
      ? (connection.calendarMappings as CalendarMapping[])
      : [];

    let found = false;
    const updatedMappings = mappings.map((mapping) => {
      if (mapping.externalId !== googleCalendarId) {
        return mapping;
      }

      found = true;
      return {
        ...mapping,
        syncToken: syncToken || undefined,
      };
    });

    await db
      .update(externalCalendarConnections)
      .set({
        calendarMappings: found ? updatedMappings : mappings,
        lastSyncAt: new Date(),
        syncStatus: 'synced',
        updatedAt: new Date(),
      })
      .where(eq(externalCalendarConnections.id, connectionId));
  } catch (_error) {
}
}

/**
 * Get sync token for a calendar
 */
export function getSyncToken(_connection: unknown, _googleCalendarId: string): string | null {
  const connection = _connection as { calendarMappings?: CalendarMapping[] | null };
  const mappings = Array.isArray(connection.calendarMappings) ? connection.calendarMappings : [];
  const mapping = mappings.find((item) => item.externalId === _googleCalendarId);
  return mapping?.syncToken || null;
}

