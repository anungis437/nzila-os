/**
 * Calendar & Scheduling Database Schema
 * 
 * Comprehensive calendar system for:
 * - Events and meetings
 * - Meeting room bookings
 * - Recurring events (RRULE support)
 * - Calendar sharing and permissions
 * - External calendar sync
 * - Attendee management
 * 
 * @module calendar-schema
 */

import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const eventTypeEnum = pgEnum('event_type', [
  'meeting',
  'appointment',
  'deadline',
  'reminder',
  'task',
  'hearing',
  'mediation',
  'negotiation',
  'training',
  'other'
]);

export const eventStatusEnum = pgEnum('event_status', [
  'scheduled',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'rescheduled'
]);

export const attendeeStatusEnum = pgEnum('attendee_status', [
  'invited',
  'accepted',
  'declined',
  'tentative',
  'no_response'
]);

export const roomStatusEnum = pgEnum('room_status', [
  'available',
  'booked',
  'maintenance',
  'unavailable'
]);

export const calendarPermissionEnum = pgEnum('calendar_permission', [
  'owner',
  'editor',
  'viewer',
  'none'
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'synced',
  'pending',
  'failed',
  'disconnected'
]);

// ============================================================================
// CALENDARS TABLE
// ============================================================================

export const calendars = pgTable('calendars', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Basic Info
  name: text('name').notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).default('#3B82F6'), // Hex color
  icon: varchar('icon', { length: 50 }),
  
  // Ownership
  ownerId: text('owner_id').notNull(), // User who created calendar
  isPersonal: boolean('is_personal').default(true),
  isShared: boolean('is_shared').default(false),
  isPublic: boolean('is_public').default(false),
  
  // External Sync
  externalProvider: varchar('external_provider', { length: 50 }), // 'google', 'outlook', 'apple'
  externalCalendarId: text('external_calendar_id'),
  syncEnabled: boolean('sync_enabled').default(false),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: syncStatusEnum('sync_status').default('disconnected'),
  syncToken: text('sync_token'), // For incremental sync
  
  // Settings
  timezone: varchar('timezone', { length: 100 }).default('America/New_York'),
  defaultEventDuration: integer('default_event_duration').default(60), // minutes
  reminderDefaultMinutes: integer('reminder_default_minutes').default(15),
  allowOverlap: boolean('allow_overlap').default(true),
  requireApproval: boolean('require_approval').default(false),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// CALENDAR EVENTS TABLE
// ============================================================================

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Basic Info
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  locationUrl: text('location_url'), // Google Meet, Zoom, Teams link
  
  // Timing
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  timezone: varchar('timezone', { length: 100 }).default('America/New_York'),
  isAllDay: boolean('is_all_day').default(false),
  
  // Recurrence (RFC 5545 RRULE format)
  isRecurring: boolean('is_recurring').default(false),
  recurrenceRule: text('recurrence_rule'), // RRULE string
  recurrenceExceptions: jsonb('recurrence_exceptions').$type<string[]>(), // Dates to exclude
  parentEventId: uuid('parent_event_id'), // For recurring event instances - self-reference
  
  // Classification
  eventType: eventTypeEnum('event_type').default('meeting'),
  status: eventStatusEnum('status').default('scheduled'),
  priority: varchar('priority', { length: 20 }).default('normal'), // low, normal, high, urgent
  
  // Links
  claimId: text('claim_id'),
  caseNumber: text('case_number'),
  memberId: text('member_id'),
  
  // Meeting Details
  meetingRoomId: uuid('meeting_room_id'),
  meetingUrl: text('meeting_url'),
  meetingPassword: text('meeting_password'),
  agenda: text('agenda'),
  
  // Organizer
  organizerId: text('organizer_id').notNull(),
  
  // Reminders (minutes before event)
  reminders: jsonb('reminders').$type<number[]>().default([15]), // [15, 60, 1440] = 15min, 1hr, 1day
  
  // External Sync
  externalEventId: text('external_event_id'),
  externalProvider: varchar('external_provider', { length: 50 }),
  externalHtmlLink: text('external_html_link'),
  lastSyncAt: timestamp('last_sync_at'),
  
  // Visibility & Privacy
  isPrivate: boolean('is_private').default(false),
  visibility: varchar('visibility', { length: 20 }).default('default'), // default, public, private, confidential
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  attachments: jsonb('attachments').$type<Array<{ name: string; url: string; type: string }>>(),
  
  // Status tracking
  createdBy: text('created_by').notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: text('cancelled_by'),
  cancellationReason: text('cancellation_reason'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// EVENT ATTENDEES TABLE
// ============================================================================

export const eventAttendees = pgTable('event_attendees', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Attendee Info
  userId: text('user_id'),
  email: text('email').notNull(),
  name: text('name'),
  
  // Status
  status: attendeeStatusEnum('status').default('invited'),
  isOptional: boolean('is_optional').default(false),
  isOrganizer: boolean('is_organizer').default(false),
  
  // Response
  respondedAt: timestamp('responded_at'),
  responseComment: text('response_comment'),
  
  // Notifications
  notificationSent: boolean('notification_sent').default(false),
  lastNotificationAt: timestamp('last_notification_at'),
  
  // External
  externalAttendeeId: text('external_attendee_id'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// MEETING ROOMS TABLE
// ============================================================================

export const meetingRooms = pgTable('meeting_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Basic Info
  name: text('name').notNull(),
  displayName: text('display_name'),
  description: text('description'),
  
  // Location
  buildingName: varchar('building_name', { length: 200 }),
  floor: varchar('floor', { length: 50 }),
  roomNumber: varchar('room_number', { length: 50 }),
  address: text('address'),
  
  // Capacity & Features
  capacity: integer('capacity').default(10),
  features: jsonb('features').$type<string[]>(), // ['projector', 'whiteboard', 'video_conference', 'catering']
  
  // Equipment
  equipment: jsonb('equipment').$type<Array<{ name: string; quantity: number }>>(),
  
  // Availability
  status: roomStatusEnum('status').default('available'),
  isActive: boolean('is_active').default(true),
  requiresApproval: boolean('requires_approval').default(false),
  
  // Booking Rules
  minBookingDuration: integer('min_booking_duration').default(30), // minutes
  maxBookingDuration: integer('max_booking_duration').default(480), // 8 hours
  advanceBookingDays: integer('advance_booking_days').default(90),
  
  // Operating Hours (JSON: { monday: { start: '08:00', end: '18:00' }, ... })
  operatingHours: jsonb('operating_hours').$type<Record<string, { start: string; end: string; closed?: boolean }>>(),
  
  // Restrictions
  allowedUserRoles: jsonb('allowed_user_roles').$type<string[]>(),
  blockedDates: jsonb('blocked_dates').$type<string[]>(), // ISO date strings
  
  // Contact
  contactPersonId: text('contact_person_id'),
  contactEmail: text('contact_email'),
  contactPhone: varchar('contact_phone', { length: 20 }),
  
  // Metadata
  imageUrl: text('image_url'),
  floorPlanUrl: text('floor_plan_url'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// ROOM BOOKINGS TABLE
// ============================================================================

export const roomBookings = pgTable('room_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => meetingRooms.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').references(() => calendarEvents.id, { onDelete: 'set null' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Booking Info
  bookedBy: text('booked_by').notNull(),
  bookedFor: text('booked_for'), // If booking for someone else
  purpose: text('purpose').notNull(),
  
  // Timing
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  
  // Setup & Services
  setupRequired: boolean('setup_required').default(false),
  setupTime: integer('setup_time').default(0), // minutes
  cateringRequired: boolean('catering_required').default(false),
  cateringNotes: text('catering_notes'),
  specialRequests: text('special_requests'),
  
  // Approval
  status: eventStatusEnum('status').default('scheduled'),
  requiresApproval: boolean('requires_approval').default(false),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  approvalNotes: text('approval_notes'),
  
  // Check-in/out
  checkedInAt: timestamp('checked_in_at'),
  checkedInBy: text('checked_in_by'),
  checkedOutAt: timestamp('checked_out_at'),
  actualEndTime: timestamp('actual_end_time'),
  
  // Cancellation
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: text('cancelled_by'),
  cancellationReason: text('cancellation_reason'),
  
  // Metadata
  attendeeCount: integer('attendee_count'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// CALENDAR SHARING TABLE
// ============================================================================

export const calendarSharing = pgTable('calendar_sharing', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Shared with
  sharedWithUserId: text('shared_with_user_id'),
  sharedWithEmail: text('shared_with_email'),
  sharedWithRole: varchar('shared_with_role', { length: 50 }), // For role-based sharing
  
  // Permissions
  permission: calendarPermissionEnum('permission').default('viewer'),
  canCreateEvents: boolean('can_create_events').default(false),
  canEditEvents: boolean('can_edit_events').default(false),
  canDeleteEvents: boolean('can_delete_events').default(false),
  canShare: boolean('can_share').default(false),
  
  // Invitation
  invitedBy: text('invited_by').notNull(),
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
  
  // Status
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// EXTERNAL CALENDAR CONNECTIONS TABLE
// ============================================================================

export const externalCalendarConnections = pgTable('external_calendar_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Provider Info
  provider: varchar('provider', { length: 50 }).notNull(), // 'google', 'microsoft', 'apple'
  providerAccountId: text('provider_account_id').notNull(),
  providerEmail: text('provider_email'),
  
  // OAuth Tokens
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  scope: text('scope'),
  
  // Sync Settings
  syncEnabled: boolean('sync_enabled').default(true),
  syncDirection: varchar('sync_direction', { length: 20 }).default('both'), // 'import', 'export', 'both'
  lastSyncAt: timestamp('last_sync_at'),
  nextSyncAt: timestamp('next_sync_at'),
  syncStatus: syncStatusEnum('sync_status').default('synced'),
  syncError: text('sync_error'),
  
  // Sync Rules
  syncPastDays: integer('sync_past_days').default(30),
  syncFutureDays: integer('sync_future_days').default(365),
  syncOnlyFreeTime: boolean('sync_only_free_time').default(false),
  
  // Mapped Calendars (array of { externalId, localCalendarId })
  calendarMappings: jsonb('calendar_mappings').$type<Array<{ externalId: string; localCalendarId: string }>>(),
  
  // Status
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// EVENT REMINDERS TABLE
// ============================================================================

export const eventReminders = pgTable('event_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Reminder Settings
  reminderMinutes: integer('reminder_minutes').notNull(), // Minutes before event
  reminderType: varchar('reminder_type', { length: 20 }).default('notification'), // 'email', 'sms', 'notification'
  
  // Status
  scheduledFor: timestamp('scheduled_for').notNull(),
  sentAt: timestamp('sent_at'),
  status: varchar('status', { length: 20 }).default('pending'), // pending, sent, failed
  error: text('error'),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const calendarsRelations = relations(calendars, ({ many }) => ({
  events: many(calendarEvents),
  sharingPermissions: many(calendarSharing),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
  calendar: one(calendars, {
    fields: [calendarEvents.calendarId],
    references: [calendars.id],
  }),
  attendees: many(eventAttendees),
  reminders: many(eventReminders),
  roomBooking: one(roomBookings, {
    fields: [calendarEvents.id],
    references: [roomBookings.eventId],
  }),
  parentEvent: one(calendarEvents, {
    fields: [calendarEvents.parentEventId],
    references: [calendarEvents.id],
  }),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [eventAttendees.eventId],
    references: [calendarEvents.id],
  }),
}));

export const meetingRoomsRelations = relations(meetingRooms, ({ many }) => ({
  bookings: many(roomBookings),
}));

export const roomBookingsRelations = relations(roomBookings, ({ one }) => ({
  room: one(meetingRooms, {
    fields: [roomBookings.roomId],
    references: [meetingRooms.id],
  }),
  event: one(calendarEvents, {
    fields: [roomBookings.eventId],
    references: [calendarEvents.id],
  }),
}));

export const calendarSharingRelations = relations(calendarSharing, ({ one }) => ({
  calendar: one(calendars, {
    fields: [calendarSharing.calendarId],
    references: [calendars.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;

export type EventAttendee = typeof eventAttendees.$inferSelect;
export type NewEventAttendee = typeof eventAttendees.$inferInsert;

export type MeetingRoom = typeof meetingRooms.$inferSelect;
export type NewMeetingRoom = typeof meetingRooms.$inferInsert;

export type RoomBooking = typeof roomBookings.$inferSelect;
export type NewRoomBooking = typeof roomBookings.$inferInsert;

export type CalendarSharing = typeof calendarSharing.$inferSelect;
export type NewCalendarSharing = typeof calendarSharing.$inferInsert;

export type ExternalCalendarConnection = typeof externalCalendarConnections.$inferSelect;
export type NewExternalCalendarConnection = typeof externalCalendarConnections.$inferInsert;

export type EventReminder = typeof eventReminders.$inferSelect;
export type NewEventReminder = typeof eventReminders.$inferInsert;

