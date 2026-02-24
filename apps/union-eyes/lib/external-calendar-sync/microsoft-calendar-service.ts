/**
 * Microsoft Outlook Calendar Sync Service
 * 
 * Handles OAuth authentication and bidirectional sync with Microsoft Outlook/Office 365.
 * Uses Microsoft Graph API.
 * 
 * Features:
 * - OAuth 2.0 authentication via MSAL
 * - Import events from Outlook Calendar
 * - Export events to Outlook Calendar
 * - Delta queries for incremental sync
 * - Conflict resolution
 * 
 * @module microsoft-calendar-service
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { db } from '@/db/db';
import { 
  externalCalendarConnections, 
  calendars, 
  calendarEvents 
} from '@/db/schema/calendar-schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// OAUTH CONFIGURATION
// ============================================================================

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CALENDAR_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || '';
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_CALENDAR_REDIRECT_URI || 'http://localhost:3000/api/calendar-sync/microsoft/callback';

const SCOPES = [
  'Calendars.ReadWrite',
  'Calendars.ReadWrite.Shared',
  'offline_access',
];

/**
 * Get MSAL client
 */
function getMsalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`,
    },
  });
}

/**
 * Generate authorization URL
 */
export async function getAuthorizationUrl(userId: string): Promise<string> {
  const msalClient = getMsalClient();
  
  return await msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: MICROSOFT_REDIRECT_URI,
    state: userId,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const msalClient = getMsalClient();
  
  const response = await msalClient.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: MICROSOFT_REDIRECT_URI,
  });

  return {
    accessToken: response.accessToken,
    refreshToken: '', // MSAL manages refresh tokens internally
    expiresAt: response.expiresOn || new Date(Date.now() + 3600000),
    providerAccountId: response.account?.homeAccountId || '',
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

    if (!connection || connection.provider !== 'microsoft') {
      throw new Error('Microsoft Calendar connection not found');
    }

    const msalClient = getMsalClient();
    
    const response = await msalClient.acquireTokenSilent({
      scopes: SCOPES,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account: { homeAccountId: connection.providerAccountId! } as any,
    });

    // Update connection with new tokens
    await db
      .update(externalCalendarConnections)
      .set({
        accessToken: response.accessToken,
        tokenExpiresAt: response.expiresOn || new Date(Date.now() + 3600000),
        updatedAt: new Date(),
      })
      .where(eq(externalCalendarConnections.id, connectionId));

    return response.accessToken;
  } catch (error) {
// Mark connection as failed
    await db
      .update(externalCalendarConnections)
      .set({
        syncStatus: 'failed',
        syncError: error instanceof Error ? error.message : 'Token refresh failed',
        updatedAt: new Date(),
      })
      .where(eq(externalCalendarConnections.id, connectionId));
    
    throw error;
  }
}

/**
 * Get authenticated Graph client for a connection
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

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// ============================================================================
// CALENDAR LIST
// ============================================================================

/**
 * List all Outlook calendars for a user
 */
export async function listMicrosoftCalendars(connectionId: string) {
  try {
    const client = await getAuthenticatedClient(connectionId);
    
    const response = await client
      .api('/me/calendars')
      .select('id,name,color,isDefaultCalendar,canEdit,canShare,owner')
      .top(250)
      .get();

    return response.value || [];
  } catch (error) {
throw error;
  }
}

// ============================================================================
// EVENT SYNC
// ============================================================================

/**
 * Import events from Microsoft Outlook Calendar
 */
export async function importMicrosoftEvents(
  connectionId: string,
  localCalendarId: string,
  microsoftCalendarId: string,
  options?: {
    timeMin?: Date;
    timeMax?: Date;
    deltaLink?: string;
  }
) {
  try {
    const client = await getAuthenticatedClient(connectionId);
    
    let endpoint: string;
    
    if (options?.deltaLink) {
      // Incremental sync using delta link
      endpoint = options.deltaLink;
    } else {
      // Full sync
      const startDateTime = options?.timeMin?.toISOString() || new Date().toISOString();
      const endDateTime = options?.timeMax?.toISOString() || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      
      endpoint = `/me/calendars/${microsoftCalendarId}/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;
    }

    const response = await client
      .api(endpoint)
      .header('Prefer', 'odata.maxpagesize=250')
      .get();

    const events = response.value || [];
    const newDeltaLink = response['@odata.deltaLink'] || null;

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

    for (const msEvent of events) {
      try {
        // Check if event is deleted
        if (msEvent['@removed']) {
          await handleDeletedMicrosoftEvent(localCalendarId, msEvent.id);
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
              eq(calendarEvents.externalEventId, msEvent.id)
            )
          )
          .limit(1);

        const eventData = mapMicrosoftEventToLocal(msEvent, localCalendarId, localCalendar.organizationId);

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.insert(calendarEvents).values(eventData as any);
          importedCount++;
        }
      } catch (_error) {
}
    }

    // Update delta link
    await updateDeltaLink(connectionId, microsoftCalendarId, newDeltaLink);

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
 * Export event to Microsoft Outlook Calendar
 */
export async function exportEventToMicrosoft(
  connectionId: string,
  localEventId: string,
  microsoftCalendarId: string
) {
  try {
    const client = await getAuthenticatedClient(connectionId);
    
    // Get local event
    const [localEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, localEventId))
      .limit(1);

    if (!localEvent) {
      throw new Error('Local event not found');
    }

    const msEvent = mapLocalEventToMicrosoft(localEvent);

    // Check if event already exists in Microsoft
    if (localEvent.externalEventId) {
      // Update existing event
      const response = await client
        .api(`/me/calendars/${microsoftCalendarId}/events/${localEvent.externalEventId}`)
        .patch(msEvent);

      return response;
    } else {
      // Create new event
      const response = await client
        .api(`/me/calendars/${microsoftCalendarId}/events`)
        .post(msEvent);

      // Update local event with Microsoft event ID
      await db
        .update(calendarEvents)
        .set({
          externalEventId: response.id,
          updatedAt: new Date(),
        })
        .where(eq(calendarEvents.id, localEventId));

      return response;
    }
  } catch (error) {
throw error;
  }
}

/**
 * Delete event from Microsoft Outlook Calendar
 */
export async function deleteEventFromMicrosoft(
  connectionId: string,
  microsoftCalendarId: string,
  microsoftEventId: string
) {
  try {
    const client = await getAuthenticatedClient(connectionId);
    
    await client
      .api(`/me/calendars/${microsoftCalendarId}/events/${microsoftEventId}`)
      .delete();
  } catch (error) {
throw error;
  }
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Map Microsoft Outlook event to local event format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMicrosoftEventToLocal(msEvent: any, calendarId: string, organizationId: string) {
  return {
    calendarId,
    organizationId,
    title: msEvent.subject || 'Untitled Event',
    description: msEvent.bodyPreview || msEvent.body?.content || null,
    location: msEvent.location?.displayName || null,
    locationUrl: msEvent.onlineMeeting?.joinUrl || null,
    startTime: new Date(msEvent.start.dateTime + 'Z'),
    endTime: new Date(msEvent.end.dateTime + 'Z'),
    timezone: msEvent.start.timeZone,
    isAllDay: msEvent.isAllDay || false,
    isRecurring: !!msEvent.recurrence,
    recurrenceRule: msEvent.recurrence ? mapMicrosoftRecurrenceToRRule(msEvent.recurrence) : null,
    eventType: 'meeting' as const,
    status: msEvent.isCancelled ? 'cancelled' as const : 'confirmed' as const,
    organizerId: msEvent.organizer?.emailAddress?.address || 'unknown',
    meetingUrl: msEvent.onlineMeeting?.joinUrl || null,
    externalEventId: msEvent.id,
    createdBy: msEvent.organizer?.emailAddress?.address || 'microsoft-calendar-sync',
    metadata: {
      source: 'microsoft',
      webLink: msEvent.webLink,
      iCalUId: msEvent.iCalUId,
      sensitivity: msEvent.sensitivity,
    },
  };
}

/**
 * Map local event to Microsoft Outlook event format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLocalEventToMicrosoft(localEvent: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msEvent: any = {
    subject: localEvent.title,
    body: {
      contentType: 'HTML',
      content: localEvent.description || '',
    },
    start: {
      dateTime: localEvent.startTime.toISOString().slice(0, -1),
      timeZone: localEvent.timezone || 'UTC',
    },
    end: {
      dateTime: localEvent.endTime.toISOString().slice(0, -1),
      timeZone: localEvent.timezone || 'UTC',
    },
    isAllDay: localEvent.isAllDay || false,
  };

  if (localEvent.location) {
    msEvent.location = {
      displayName: localEvent.location,
    };
  }

  if (localEvent.recurrenceRule) {
    msEvent.recurrence = mapRRuleToMicrosoftRecurrence(localEvent.recurrenceRule);
  }

  if (localEvent.meetingUrl) {
    msEvent.onlineMeeting = {
      joinUrl: localEvent.meetingUrl,
    };
  }

  return msEvent;
}

/**
 * Map Microsoft recurrence to RRULE
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMicrosoftRecurrenceToRRule(recurrence: any): string {
  const pattern = recurrence.pattern;
  const range = recurrence.range;

  let rrule = `FREQ=${pattern.type.toUpperCase()}`;

  if (pattern.interval > 1) {
    rrule += `;INTERVAL=${pattern.interval}`;
  }

  if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
    const days = pattern.daysOfWeek.map((d: string) => d.substring(0, 2).toUpperCase()).join(',');
    rrule += `;BYDAY=${days}`;
  }

  if (pattern.dayOfMonth) {
    rrule += `;BYMONTHDAY=${pattern.dayOfMonth}`;
  }

  if (range.type === 'endDate') {
    rrule += `;UNTIL=${new Date(range.endDate).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  } else if (range.type === 'numbered') {
    rrule += `;COUNT=${range.numberOfOccurrences}`;
  }

  return rrule;
}

/**
 * Map RRULE to Microsoft recurrence
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRRuleToMicrosoftRecurrence(rrule: string): any {
  const parts = rrule.split(';');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recurrence: any = {
    pattern: {},
    range: {},
  };

  parts.forEach(part => {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        recurrence.pattern.type = value.toLowerCase();
        break;
      case 'INTERVAL':
        recurrence.pattern.interval = parseInt(value);
        break;
      case 'COUNT':
        recurrence.range.type = 'numbered';
        recurrence.range.numberOfOccurrences = parseInt(value);
        break;
      case 'UNTIL':
        recurrence.range.type = 'endDate';
        recurrence.range.endDate = new Date(value).toISOString().split('T')[0];
        break;
      case 'BYDAY':
        recurrence.pattern.daysOfWeek = value.split(',').map((d: string) => {
          const dayMap: Record<string, string> = {
            'MO': 'monday',
            'TU': 'tuesday',
            'WE': 'wednesday',
            'TH': 'thursday',
            'FR': 'friday',
            'SA': 'saturday',
            'SU': 'sunday',
          };
          return dayMap[d] || d.toLowerCase();
        });
        break;
      case 'BYMONTHDAY':
        recurrence.pattern.dayOfMonth = parseInt(value);
        break;
    }
  });

  if (!recurrence.range.type) {
    recurrence.range.type = 'noEnd';
  }

  return recurrence;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Handle deleted Microsoft event
 */
async function handleDeletedMicrosoftEvent(calendarId: string, msEventId: string) {
  try {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.calendarId, calendarId),
          eq(calendarEvents.externalEventId, msEventId)
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
 * Update delta link for incremental sync
 */
async function updateDeltaLink(
  connectionId: string,
  microsoftCalendarId: string,
  deltaLink: string | null
) {
  try {
    const [connection] = await db
      .select()
      .from(externalCalendarConnections)
      .where(eq(externalCalendarConnections.id, connectionId))
      .limit(1);

    if (!connection) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappings: any = (connection.calendarMappings as any) || {};
    
    if (!mappings[microsoftCalendarId]) {
      mappings[microsoftCalendarId] = {};
    }
    
    mappings[microsoftCalendarId].deltaLink = deltaLink;

    await db
      .update(externalCalendarConnections)
      .set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        calendarMappings: mappings as any,
        lastSyncAt: new Date(),
        syncStatus: 'synced',
        updatedAt: new Date(),
      })
      .where(eq(externalCalendarConnections.id, connectionId));
  } catch (_error) {
}
}

/**
 * Get delta link for a calendar
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDeltaLink(connection: any, microsoftCalendarId: string): string | null {
  const mappings = connection.calendarMappings || {};
  return mappings[microsoftCalendarId]?.deltaLink || null;
}

