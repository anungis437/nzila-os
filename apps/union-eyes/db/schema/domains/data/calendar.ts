/**
 * Calendar Integration Schema
 *
 * Database schema for external calendar system data.
 * Supports Outlook (Microsoft Graph), Google Calendar, and custom providers.
 * Tables:
 * - external_calendars: Calendar sources from external systems
 * - external_calendar_events: Events synced from external calendars
 * - external_calendar_attendees: Event attendees
 * - external_calendar_recurring_patterns: Recurrence rules for repeating events
 */

import {
  pgEnum,
} from 'drizzle-orm/pg-core';

// ============================================================================
// Enums
// ============================================================================

export const calendarProviderEnum = pgEnum('calendar_provider', [
  'OUTLOOK',
  'GOOGLE',
  'APPLE',
  'CALDAV',
  'CUSTOM',
]);

export const calendarEventStatusEnum = pgEnum('calendar_event_status', [
  'confirmed',
  'tentative',
  'cancelled',
]);

export const attendeeResponseEnum = pgEnum('attendee_response', [
  'accepted',
  'declined',
  'tentative',
  'needs_action',
  'delegated',
]);

export const externalEventTypeEnum = pgEnum('calendar_event_type', [
  'meeting',
  'bargaining_session',
  'grievance_hearing',
  'arbitration',
  'steward_training',
  'membership_meeting',
  'strike_vote',
  'ratification_vote',
  'executive_board',
  'committee',
  'social_event',
  'deadline',
  'other',
]);

