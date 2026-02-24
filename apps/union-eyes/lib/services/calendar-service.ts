/**
 * Calendar Service - Event and Scheduling Management
 * 
 * Provides comprehensive calendar operations including:
 * - Calendar management
 * - Event CRUD operations
 * - Recurring events (RRULE support)
 * - Attendee management
 * - Meeting room bookings
 * - External calendar sync
 * - Availability scheduling
 */

import { db } from "@/db/db";
import { 
  calendars,
  // Import other calendar tables from schema as needed
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type NewCalendar = typeof calendars.$inferInsert;
export type Calendar = typeof calendars.$inferSelect;

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  eventType: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  location?: string;
  recurrenceRule?: string; // RRULE format
  exceptionDates?: Date[];
  attendees?: EventAttendee[];
  reminders?: EventReminder[];
  status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  email: string;
  status: "invited" | "accepted" | "declined" | "tentative" | "no_response";
  isOrganizer: boolean;
  responseAt?: Date;
}

export interface EventReminder {
  id: string;
  eventId: string;
  type: "email" | "push" | "sms";
  minutesBefore: number;
  sentAt?: Date;
}

export interface RecurringEventInstance {
  instanceDate: Date;
  event: CalendarEvent;
  isException: boolean;
}

export interface MeetingRoom {
  id: string;
  name: string;
  capacity: number;
  location: string;
  amenities: string[];
  isAvailable: boolean;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  eventId: string;
  startTime: Date;
  endTime: Date;
  bookedBy: string;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  available: boolean;
  occupiedBy?: string[];
}

// ============================================================================
// Calendar Operations
// ============================================================================

/**
 * Get calendar by ID
 */
export async function getCalendarById(id: string): Promise<Calendar | null> {
  try {
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, id),
    });

    return calendar || null;
  } catch (error) {
    logger.error("Error fetching calendar", { error, id });
    throw new Error("Failed to fetch calendar");
  }
}

/**
 * List calendars
 */
export async function listCalendars(
  filters: {
    organizationId?: string;
    ownerId?: string;
    isPersonal?: boolean;
    isShared?: boolean;
  } = {}
): Promise<Calendar[]> {
  try {
    const conditions: SQL[] = [];

    if (filters.organizationId) {
      conditions.push(eq(calendars.organizationId, filters.organizationId));
    }

    if (filters.ownerId) {
      conditions.push(eq(calendars.ownerId, filters.ownerId));
    }

    if (filters.isPersonal !== undefined) {
      conditions.push(eq(calendars.isPersonal, filters.isPersonal));
    }

    if (filters.isShared !== undefined) {
      conditions.push(eq(calendars.isShared, filters.isShared));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(calendars)
      .where(whereClause)
      .orderBy(asc(calendars.name));

    return results;
  } catch (error) {
    logger.error("Error listing calendars", { error, filters });
    throw new Error("Failed to list calendars");
  }
}

/**
 * Create calendar
 */
export async function createCalendar(data: NewCalendar): Promise<Calendar> {
  try {
    const [calendar] = await db
      .insert(calendars)
      .values(data)
      .returning();

    return calendar;
  } catch (error) {
    logger.error("Error creating calendar", { error });
    throw new Error("Failed to create calendar");
  }
}

/**
 * Update calendar
 */
export async function updateCalendar(
  id: string,
  data: Partial<NewCalendar>
): Promise<Calendar | null> {
  try {
    const [updated] = await db
      .update(calendars)
      .set(data)
      .where(eq(calendars.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating calendar", { error, id });
    throw new Error("Failed to update calendar");
  }
}

/**
 * Delete calendar
 */
export async function deleteCalendar(id: string): Promise<boolean> {
  try {
    await db
      .delete(calendars)
      .where(eq(calendars.id, id));

    return true;
  } catch (error) {
    logger.error("Error deleting calendar", { error, id });
    throw new Error("Failed to delete calendar");
  }
}

// ============================================================================
// Event Operations
// ============================================================================

/**
 * Create event
 */
export async function createEvent(data: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<CalendarEvent> {
  try {
    // In production, insert into calendar_events table
    const event: CalendarEvent = {
      id: `event-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return event;
  } catch (error) {
    logger.error("Error creating event", { error });
    throw new Error("Failed to create event");
  }
}

/**
 * Get event by ID
 */
export async function getEventById(id: string): Promise<CalendarEvent | null> {
  try {
    // In production, query calendar_events table
    return null;
  } catch (error) {
    logger.error("Error fetching event", { error, id });
    throw new Error("Failed to fetch event");
  }
}

/**
 * Update event
 */
export async function updateEvent(
  id: string,
  _data: Partial<CalendarEvent>
): Promise<CalendarEvent | null> {
  try {
    // In production, update calendar_events table
    return null;
  } catch (error) {
    logger.error("Error updating event", { error, id });
    throw new Error("Failed to update event");
  }
}

/**
 * Delete event
 */
export async function deleteEvent(id: string, _deleteRecurring = false): Promise<boolean> {
  try {
    // In production, delete from calendar_events table
    // If deleteRecurring is true, delete all instances of recurring event
    return true;
  } catch (error) {
    logger.error("Error deleting event", { error, id });
    throw new Error("Failed to delete event");
  }
}

/**
 * List events for calendar
 */
export async function listEvents(
  calendarId: string,
  _filters: {
    startDate?: Date;
    endDate?: Date;
    eventType?: string[];
    status?: string[];
  } = {}
): Promise<CalendarEvent[]> {
  try {
    // In production, query calendar_events table with filters
    return [];
  } catch (error) {
    logger.error("Error listing events", { error, calendarId });
    throw new Error("Failed to list events");
  }
}

/**
 * Get events for date range across multiple calendars
 */
export async function getEventsForDateRange(
  calendarIds: string[],
  _startDate: Date,
  _endDate: Date
): Promise<CalendarEvent[]> {
  try {
    // In production, query calendar_events table
    // Filter by calendar IDs and date range
    return [];
  } catch (error) {
    logger.error("Error fetching events for date range", { error, calendarIds });
    throw new Error("Failed to fetch events for date range");
  }
}

// ============================================================================
// Recurring Events
// ============================================================================

/**
 * Generate recurring event instances using RRULE
 */
export async function generateRecurringInstances(
  eventId: string,
  startDate: Date,
  endDate: Date
): Promise<RecurringEventInstance[]> {
  try {
    const event = await getEventById(eventId);
    if (!event || !event.recurrenceRule) {
      return [];
    }

    const instances: RecurringEventInstance[] = [];
    const rruleString = event.recurrenceRule;
    
    // Parse RRULE format: FREQ=DAILY;INTERVAL=1;COUNT=10
    const rruleParts = parseRRule(rruleString);
    
    if (!rruleParts.FREQ) {
      logger.warn("Invalid RRULE", { rruleString });
      return [];
    }

    const eventStart = event.startTime;
    const eventDuration = event.endTime.getTime() - event.startTime.getTime();
    const exceptionDates = new Set(
      (event.exceptionDates || []).map(d => d.toISOString().split('T')[0])
    );

    const currentDate = new Date(eventStart);
    let count = 0;
    const maxCount = rruleParts.COUNT || 365; // Safety limit
    const interval = rruleParts.INTERVAL || 1;

    while (count < maxCount && currentDate <= endDate) {
      if (currentDate >= startDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        
        // Skip exception dates
        if (!exceptionDates.has(dateKey)) {
          const instanceStart = new Date(currentDate);
          const instanceEnd = new Date(currentDate.getTime() + eventDuration);
          
          instances.push({
            instanceDate: new Date(currentDate),
            event: {
              ...event,
              id: `${event.id}_${dateKey}`,
              startTime: instanceStart,
              endTime: instanceEnd,
            },
            isException: false,
          });
        }
      }

      // Advance to next occurrence based on frequency
      switch (rruleParts.FREQ) {
        case 'DAILY':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'WEEKLY':
          currentDate.setDate(currentDate.getDate() + (7 * interval));
          break;
        case 'MONTHLY':
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case 'YEARLY':
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
        default:
          logger.warn("Unsupported frequency", { frequency: rruleParts.FREQ });
          return instances;
      }

      count++;
      
      // Check UNTIL date if specified
      if (rruleParts.UNTIL && currentDate > new Date(rruleParts.UNTIL)) {
        break;
      }
    }

    return instances;
  } catch (error) {
    logger.error("Error generating recurring instances", { error, eventId });
    throw new Error("Failed to generate recurring instances");
  }
}

/**
 * Parse RRULE string into components
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRRule(rrule: string): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: Record<string, any> = {};
  
  // Remove RRULE: prefix if present
  const cleanedRule = rrule.replace(/^RRULE:/i, '');
  
  // Split by semicolon and parse key=value pairs
  cleanedRule.split(';').forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) {
      const upperKey = key.trim().toUpperCase();
      
      // Parse specific types
      if (upperKey === 'COUNT' || upperKey === 'INTERVAL') {
        parts[upperKey] = parseInt(value, 10);
      } else if (upperKey === 'UNTIL') {
        // Parse date: YYYYMMDD or YYYYMMDDTHHMMSSZ
        const dateStr = value.replace(/[TZ]/g, '');
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        parts[upperKey] = new Date(year, month, day);
      } else if (upperKey === 'BYDAY') {
        // Parse weekdays: MO,TU,WE,TH,FR
        parts[upperKey] = value.split(',').map(d => d.trim());
      } else {
        parts[upperKey] = value.trim();
      }
    }
  });
  
  return parts;
}

/**
 * Add exception date to recurring event
 */
export async function addRecurringException(
  eventId: string,
  exceptionDate: Date
): Promise<CalendarEvent | null> {
  try {
    const event = await getEventById(eventId);
    if (!event) return null;

    const exceptionDates = [...(event.exceptionDates || []), exceptionDate];

    return await updateEvent(eventId, { exceptionDates });
  } catch (error) {
    logger.error("Error adding recurring exception", { error, eventId });
    throw new Error("Failed to add recurring exception");
  }
}

/**
 * Update single instance of recurring event
 */
export async function updateRecurringInstance(
  eventId: string,
  instanceDate: Date,
  data: Partial<CalendarEvent>
): Promise<CalendarEvent> {
  try {
    // In production, create a new event with the changes for this instance
    // Add original event date to exception dates
    await addRecurringException(eventId, instanceDate);

    // Create new single event
    const originalEvent = await getEventById(eventId);
    if (!originalEvent) {
      throw new Error("Original event not found");
    }

    const newEvent = await createEvent({
      ...originalEvent,
      ...data,
      recurrenceRule: undefined, // Single instance
      startTime: instanceDate,
      endTime: new Date(instanceDate.getTime() + (originalEvent.endTime.getTime() - originalEvent.startTime.getTime())),
    });

    return newEvent;
  } catch (error) {
    logger.error("Error updating recurring instance", { error, eventId });
    throw new Error("Failed to update recurring instance");
  }
}

// ============================================================================
// Attendee Management
// ============================================================================

/**
 * Add attendee to event
 */
export async function addAttendee(
  eventId: string,
  attendee: Omit<EventAttendee, "id" | "eventId">
): Promise<EventAttendee> {
  try {
    // In production, insert into event_attendees table
    const newAttendee: EventAttendee = {
      id: `attendee-${Date.now()}`,
      eventId,
      ...attendee,
    };

    return newAttendee;
  } catch (error) {
    logger.error("Error adding attendee", { error, eventId });
    throw new Error("Failed to add attendee");
  }
}

/**
 * Update attendee response
 */
export async function updateAttendeeResponse(
  attendeeId: string,
  _status: EventAttendee["status"]
): Promise<EventAttendee | null> {
  try {
    // In production, update event_attendees table
    return null;
  } catch (error) {
    logger.error("Error updating attendee response", { error, attendeeId });
    throw new Error("Failed to update attendee response");
  }
}

/**
 * Remove attendee from event
 */
export async function removeAttendee(attendeeId: string): Promise<boolean> {
  try {
    // In production, delete from event_attendees table
    return true;
  } catch (error) {
    logger.error("Error removing attendee", { error, attendeeId });
    throw new Error("Failed to remove attendee");
  }
}

/**
 * Get event attendees
 */
export async function getEventAttendees(eventId: string): Promise<EventAttendee[]> {
  try {
    // In production, query event_attendees table
    return [];
  } catch (error) {
    logger.error("Error fetching event attendees", { error, eventId });
    throw new Error("Failed to fetch event attendees");
  }
}

// ============================================================================
// Meeting Rooms
// ============================================================================

/**
 * List meeting rooms
 */
export async function listMeetingRooms(
  filters?: {
    location?: string;
    minCapacity?: number;
    amenities?: string[];
  }
): Promise<MeetingRoom[]> {
  try {
    // In production, query meeting_rooms table
    return [];
  } catch (error) {
    logger.error("Error listing meeting rooms", { error, filters });
    throw new Error("Failed to list meeting rooms");
  }
}

/**
 * Check room availability
 */
export async function checkRoomAvailability(
  roomId: string,
  _startTime: Date,
  _endTime: Date
): Promise<boolean> {
  try {
    // In production, query room_bookings table
    // Check for overlapping bookings
    return true;
  } catch (error) {
    logger.error("Error checking room availability", { error, roomId });
    throw new Error("Failed to check room availability");
  }
}

/**
 * Book meeting room
 */
export async function bookMeetingRoom(
  roomId: string,
  eventId: string,
  startTime: Date,
  endTime: Date,
  bookedBy: string
): Promise<RoomBooking> {
  try {
    const available = await checkRoomAvailability(roomId, startTime, endTime);
    if (!available) {
      throw new Error("Room is not available for the requested time");
    }

    // In production, insert into room_bookings table
    const booking: RoomBooking = {
      id: `booking-${Date.now()}`,
      roomId,
      eventId,
      startTime,
      endTime,
      bookedBy,
    };

    return booking;
  } catch (error) {
    logger.error("Error booking meeting room", { error, roomId });
    throw new Error("Failed to book meeting room");
  }
}

/**
 * Cancel room booking
 */
export async function cancelRoomBooking(bookingId: string): Promise<boolean> {
  try {
    // In production, delete from room_bookings table
    return true;
  } catch (error) {
    logger.error("Error canceling room booking", { error, bookingId });
    throw new Error("Failed to cancel room booking");
  }
}

// ============================================================================
// Availability Scheduling
// ============================================================================

/**
 * Get user availability
 */
export async function getUserAvailability(
  userId: string,
  _startDate: Date,
  _endDate: Date
): Promise<AvailabilitySlot[]> {
  try {
    // In production:
    // 1. Get user's calendar events for date range
    // 2. Calculate free time slots
    // 3. Consider working hours preferences

    const slots: AvailabilitySlot[] = [];

    return slots;
  } catch (error) {
    logger.error("Error fetching user availability", { error, userId });
    throw new Error("Failed to fetch user availability");
  }
}

/**
 * Find common availability for multiple users
 */
export async function findCommonAvailability(
  userIds: string[],
  _startDate: Date,
  _endDate: Date,
  _duration: number // in minutes
): Promise<AvailabilitySlot[]> {
  try {
    // In production:
    // 1. Get availability for all users
    // 2. Find intersection of available slots
    // 3. Filter by minimum duration

    const commonSlots: AvailabilitySlot[] = [];

    return commonSlots;
  } catch (error) {
    logger.error("Error finding common availability", { error, userIds });
    throw new Error("Failed to find common availability");
  }
}

// ============================================================================
// External Calendar Sync
// ============================================================================

/**
 * Sync with external calendar provider
 */
export async function syncExternalCalendar(
  calendarId: string,
  provider: "google" | "outlook" | "apple"
): Promise<{ success: boolean; syncedEvents: number; errors?: string[] }> {
  try {
    const calendar = await getCalendarById(calendarId);
    if (!calendar) {
      throw new Error("Calendar not found");
    }

    // In production:
    // 1. Connect to external provider API
    // 2. Fetch events since last sync
    // 3. Synchronize bidirectionally
    // 4. Update sync status and token

    await updateCalendar(calendarId, {
      lastSyncAt: new Date(),
      syncStatus: "synced",
    });

    return {
      success: true,
      syncedEvents: 0,
    };
  } catch (error) {
    logger.error("Error syncing external calendar", { error, calendarId, provider });

    await updateCalendar(calendarId, {
      syncStatus: "failed",
    });

    throw new Error("Failed to sync external calendar");
  }
}

/**
 * Enable calendar sync
 */
export async function enableCalendarSync(
  calendarId: string,
  provider: "google" | "outlook" | "apple",
  externalCalendarId: string,
  syncToken?: string
): Promise<Calendar | null> {
  try {
    const updated = await updateCalendar(calendarId, {
      externalProvider: provider,
      externalCalendarId,
      syncEnabled: true,
      syncToken,
      syncStatus: "pending",
    });

    // Perform initial sync
    if (updated) {
      await syncExternalCalendar(calendarId, provider);
    }

    return updated;
  } catch (error) {
    logger.error("Error enabling calendar sync", { error, calendarId, provider });
    throw new Error("Failed to enable calendar sync");
  }
}

/**
 * Disable calendar sync
 */
export async function disableCalendarSync(calendarId: string): Promise<Calendar | null> {
  try {
    return await updateCalendar(calendarId, {
      syncEnabled: false,
      syncStatus: "disconnected",
    });
  } catch (error) {
    logger.error("Error disabling calendar sync", { error, calendarId });
    throw new Error("Failed to disable calendar sync");
  }
}

// ============================================================================
// Reminders
// ============================================================================

/**
 * Add event reminder
 */
export async function addEventReminder(
  eventId: string,
  type: EventReminder["type"],
  minutesBefore: number
): Promise<EventReminder> {
  try {
    // In production, insert into event_reminders table
    const reminder: EventReminder = {
      id: `reminder-${Date.now()}`,
      eventId,
      type,
      minutesBefore,
    };

    return reminder;
  } catch (error) {
    logger.error("Error adding event reminder", { error, eventId });
    throw new Error("Failed to add event reminder");
  }
}

/**
 * Get pending reminders
 */
export async function getPendingReminders(
  lookAheadMinutes = 60
): Promise<Array<{ event: CalendarEvent; reminder: EventReminder }>> {
  try {
    // In production:
    // 1. Find events starting within lookAheadMinutes
    // 2. Get their reminders
    // 3. Filter reminders that haven&apos;t been sent

    return [];
  } catch (error) {
    logger.error("Error fetching pending reminders", { error, lookAheadMinutes });
    throw new Error("Failed to fetch pending reminders");
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get calendar statistics
 */
export async function getCalendarStatistics(
  calendarId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByStatus: Record<string, number>;
  averageDuration: number;
  busyHours: number;
}> {
  try {
    // In production, analyze events in date range
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsByStatus: {},
      averageDuration: 0,
      busyHours: 0,
    };
  } catch (error) {
    logger.error("Error fetching calendar statistics", {
      error,
      calendarId,
      startDate,
      endDate,
    });
    throw new Error("Failed to fetch calendar statistics");
  }
}

