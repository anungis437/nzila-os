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
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

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

// ============================================================================
// External Calendars
// ============================================================================

export const externalCalendars = pgTable(
  'external_calendars',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: calendarProviderEnum('external_provider').notNull(),

    // Calendar data
    calendarName: varchar('calendar_name', { length: 500 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 20 }),
    timezone: varchar('timezone', { length: 100 }),
    ownerEmail: varchar('owner_email', { length: 255 }),
    isShared: boolean('is_shared').default(false),
    canEdit: boolean('can_edit').default(false),
    syncEnabled: boolean('sync_enabled').default(true),
    syncDirection: varchar('sync_direction', { length: 20 }).default('inbound'), // inbound, outbound, bidirectional

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_calendars_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    ownerIdx: index('ext_calendars_owner_idx').on(table.ownerEmail),
    uniqueExternal: unique('ext_calendars_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Calendar Events
// ============================================================================

export const externalCalendarEvents = pgTable(
  'external_calendar_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: calendarProviderEnum('external_provider').notNull(),

    // Event data
    calendarId: varchar('calendar_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    location: varchar('location', { length: 500 }),
    meetingUrl: text('meeting_url'),
    eventType: externalEventTypeEnum('event_type'),
    status: calendarEventStatusEnum('status').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').default(false),
    isRecurring: boolean('is_recurring').default(false),
    recurringEventId: varchar('recurring_event_id', { length: 255 }),
    organizerEmail: varchar('organizer_email', { length: 255 }),
    organizerName: varchar('organizer_name', { length: 255 }),
    visibility: varchar('visibility', { length: 20 }).default('default'), // default, public, private, confidential
    importance: varchar('importance', { length: 20 }).default('normal'), // low, normal, high
    attendeeCount: integer('attendee_count').default(0),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_cal_events_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    calendarIdx: index('ext_cal_events_calendar_idx').on(table.calendarId),
    timeRangeIdx: index('ext_cal_events_time_range_idx').on(table.startTime, table.endTime),
    statusIdx: index('ext_cal_events_status_idx').on(table.status),
    eventTypeIdx: index('ext_cal_events_type_idx').on(table.eventType),
    organizerIdx: index('ext_cal_events_organizer_idx').on(table.organizerEmail),
    uniqueExternal: unique('ext_cal_events_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Calendar Attendees
// ============================================================================

export const externalCalendarAttendees = pgTable(
  'external_calendar_attendees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: calendarProviderEnum('external_provider').notNull(),

    // Attendee data
    eventId: varchar('event_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    responseStatus: attendeeResponseEnum('response_status').notNull(),
    isOrganizer: boolean('is_organizer').default(false),
    isOptional: boolean('is_optional').default(false),
    comment: text('comment'),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_cal_att_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    eventIdx: index('ext_cal_att_event_idx').on(table.eventId),
    emailIdx: index('ext_cal_att_email_idx').on(table.email),
    responseIdx: index('ext_cal_att_response_idx').on(table.responseStatus),
    uniqueExternal: unique('ext_cal_att_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Calendar Recurring Patterns
// ============================================================================

export const externalCalendarRecurringPatterns = pgTable(
  'external_calendar_recurring_patterns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: calendarProviderEnum('external_provider').notNull(),

    // Recurrence data
    eventId: varchar('event_id', { length: 255 }).notNull(),
    frequency: varchar('frequency', { length: 20 }).notNull(), // daily, weekly, monthly, yearly
    intervalCount: integer('interval_count').default(1),
    daysOfWeek: varchar('days_of_week', { length: 100 }), // comma-separated: MO,TU,WE
    dayOfMonth: integer('day_of_month'),
    monthOfYear: integer('month_of_year'),
    count: integer('count'), // number of occurrences (null = infinite)
    untilDate: timestamp('until_date', { withTimezone: true }),
    exceptions: text('exceptions'), // comma-separated dates to skip

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_cal_recur_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    eventIdx: index('ext_cal_recur_event_idx').on(table.eventId),
    uniqueExternal: unique('ext_cal_recur_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// Type Exports
// ============================================================================

export type ExternalCalendar = typeof externalCalendars.$inferSelect;
export type NewExternalCalendar = typeof externalCalendars.$inferInsert;
export type ExternalCalendarEvent = typeof externalCalendarEvents.$inferSelect;
export type NewExternalCalendarEvent = typeof externalCalendarEvents.$inferInsert;
export type ExternalCalendarAttendee = typeof externalCalendarAttendees.$inferSelect;
export type NewExternalCalendarAttendee = typeof externalCalendarAttendees.$inferInsert;
export type ExternalCalendarRecurringPattern = typeof externalCalendarRecurringPatterns.$inferSelect;
export type NewExternalCalendarRecurringPattern = typeof externalCalendarRecurringPatterns.$inferInsert;
