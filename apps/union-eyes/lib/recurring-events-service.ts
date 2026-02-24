/**
 * Recurring Events Service
 * 
 * Handles RFC 5545 RRULE parsing and recurring event generation.
 * Supports:
 * - Daily, Weekly, Monthly, Yearly recurrence
 * - UNTIL, COUNT limits
 * - INTERVAL, BYDAY, BYMONTHDAY
 * - Exception dates (EXDATE)
 * 
 * @module recurring-events-service
 */

import { db } from '@/db/db';
import { calendarEvents, eventAttendees } from '@/db/schema/calendar-schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { rrulestr } from 'rrule';

// ============================================================================
// TYPES
// ============================================================================

export interface RecurrenceOptions {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: Date;
  byDay?: string[]; // ['MO', 'WE', 'FR']
  byMonthDay?: number[];
  byMonth?: number[];
}

export interface RecurringEventInstance {
  id?: string;
  parentEventId: string;
  startTime: Date;
  endTime: Date;
  originalEventData: unknown;
}

// ============================================================================
// RRULE GENERATION
// ============================================================================

/**
 * Convert RecurrenceOptions to RRULE string
 */
export function generateRRule(options: RecurrenceOptions): string {
  const {
    frequency,
    interval = 1,
    count,
    until,
    byDay,
    byMonthDay,
    byMonth,
  } = options;

  let rrule = `FREQ=${frequency}`;

  if (interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }

  if (count) {
    rrule += `;COUNT=${count}`;
  }

  if (until) {
    rrule += `;UNTIL=${until.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  }

  if (byDay && byDay.length > 0) {
    rrule += `;BYDAY=${byDay.join(',')}`;
  }

  if (byMonthDay && byMonthDay.length > 0) {
    rrule += `;BYMONTHDAY=${byMonthDay.join(',')}`;
  }

  if (byMonth && byMonth.length > 0) {
    rrule += `;BYMONTH=${byMonth.join(',')}`;
  }

  return rrule;
}

/**
 * Parse RRULE string to RecurrenceOptions
 */
export function parseRRule(rruleString: string): RecurrenceOptions {
  const parts = rruleString.split(';');
  const options: RecurrenceOptions = {
    frequency: 'WEEKLY',
  };

  parts.forEach(part => {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        options.frequency = value as RecurrenceOptions['frequency'];
        break;
      case 'INTERVAL':
        options.interval = parseInt(value);
        break;
      case 'COUNT':
        options.count = parseInt(value);
        break;
      case 'UNTIL':
        options.until = new Date(value);
        break;
      case 'BYDAY':
        options.byDay = value.split(',');
        break;
      case 'BYMONTHDAY':
        options.byMonthDay = value.split(',').map(Number);
        break;
      case 'BYMONTH':
        options.byMonth = value.split(',').map(Number);
        break;
    }
  });

  return options;
}

/**
 * Get user-friendly recurrence description
 */
export function getRecurrenceDescription(rruleString: string): string {
  try {
    const rule = rrulestr(rruleString);
    return rule.toText();
  } catch (_error) {
    return 'Custom recurrence';
  }
}

// ============================================================================
// EVENT INSTANCE GENERATION
// ============================================================================

/**
 * Generate recurring event instances for a date range
 */
export function generateRecurringInstances(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseEvent: Record<string, any>,
  rruleString: string,
  startDate: Date,
  endDate: Date,
  exceptions: string[] = []
): RecurringEventInstance[] {
  try {
    const rule = rrulestr(rruleString, {
      dtstart: new Date(baseEvent.startTime),
      tzid: baseEvent.timezone || 'America/New_York',
    });

    // Get all occurrences in date range
    const occurrences = rule.between(startDate, endDate, true);

    // Calculate event duration
    const duration = new Date(baseEvent.endTime).getTime() - new Date(baseEvent.startTime).getTime();

    // Filter out exceptions
    const exceptionSet = new Set(exceptions.map(d => new Date(d).toISOString().split('T')[0]));

    const instances: RecurringEventInstance[] = occurrences
      .filter(occurrence => {
        const dateKey = occurrence.toISOString().split('T')[0];
        return !exceptionSet.has(dateKey);
      })
      .map(occurrence => ({
        parentEventId: baseEvent.id,
        startTime: occurrence,
        endTime: new Date(occurrence.getTime() + duration),
        originalEventData: baseEvent,
      }));

    return instances;
  } catch (_error) {
return [];
  }
}

/**
 * Create instances in database for a recurring event
 */
export async function createRecurringInstances(
  parentEventId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    // Get parent event
    const [parentEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, parentEventId))
      .limit(1);

    if (!parentEvent || !parentEvent.isRecurring || !parentEvent.recurrenceRule) {
      throw new Error('Event is not a recurring event');
    }

    // Generate instances
    const instances = generateRecurringInstances(
      parentEvent,
      parentEvent.recurrenceRule,
      startDate,
      endDate,
      parentEvent.recurrenceExceptions || []
    );

    if (instances.length === 0) {
      return 0;
    }

    // Get attendees from parent event
    const parentAttendees = await db
      .select()
      .from(eventAttendees)
      .where(eq(eventAttendees.eventId, parentEventId));

    let createdCount = 0;

    // Create each instance
    for (const instance of instances) {
      try {
        const [newEvent] = await db
          .insert(calendarEvents)
          .values({
            ...parentEvent,
            id: undefined, // Let DB generate new ID
            parentEventId,
            startTime: instance.startTime,
            endTime: instance.endTime,
            isRecurring: false, // Instances are not recurring themselves
            recurrenceRule: null,
            recurrenceExceptions: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Copy attendees
        if (parentAttendees.length > 0) {
          const attendeeValues = parentAttendees.map(attendee => ({
            ...attendee,
            id: undefined, // Let DB generate new ID
            eventId: newEvent.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await db.insert(eventAttendees).values(attendeeValues);
        }

        createdCount++;
      } catch (_error) {
}
    }

    return createdCount;
  } catch (error) {
throw error;
  }
}

/**
 * Delete future instances of a recurring event
 */
export async function deleteFutureInstances(
  parentEventId: string,
  fromDate: Date
): Promise<number> {
  try {
    const instances = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.parentEventId, parentEventId),
          gte(calendarEvents.startTime, fromDate)
        )
      );

    // Soft delete by marking as cancelled
    for (const instance of instances) {
      await db
        .update(calendarEvents)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(calendarEvents.id, instance.id));
    }

    return instances.length;
  } catch (error) {
throw error;
  }
}

/**
 * Add exception date to recurring event
 */
export async function addRecurrenceException(
  parentEventId: string,
  exceptionDate: Date
): Promise<void> {
  try {
    const [parentEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, parentEventId))
      .limit(1);

    if (!parentEvent) {
      throw new Error('Event not found');
    }

    const exceptions = parentEvent.recurrenceExceptions || [];
    const dateString = exceptionDate.toISOString().split('T')[0];

    if (!exceptions.includes(dateString)) {
      exceptions.push(dateString);

      await db
        .update(calendarEvents)
        .set({
          recurrenceExceptions: exceptions,
          updatedAt: new Date(),
        })
        .where(eq(calendarEvents.id, parentEventId));
    }

    // Cancel instance on exception date
    const instanceOnDate = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.parentEventId, parentEventId),
          gte(calendarEvents.startTime, new Date(dateString)),
          lte(calendarEvents.startTime, new Date(dateString + 'T23:59:59'))
        )
      )
      .limit(1);

    if (instanceOnDate.length > 0) {
      await db
        .update(calendarEvents)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(calendarEvents.id, instanceOnDate[0].id));
    }
  } catch (error) {
throw error;
  }
}

// ============================================================================
// RRULE PRESETS
// ============================================================================

export const RECURRENCE_PRESETS = {
  DAILY: 'FREQ=DAILY',
  WEEKDAYS: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  WEEKLY: 'FREQ=WEEKLY',
  BIWEEKLY: 'FREQ=WEEKLY;INTERVAL=2',
  MONTHLY: 'FREQ=MONTHLY',
  YEARLY: 'FREQ=YEARLY',
};

/**
 * Create preset recurrence rule
 */
export function createPresetRRule(
  preset: keyof typeof RECURRENCE_PRESETS,
  options?: {
    count?: number;
    until?: Date;
  }
): string {
  let rrule = RECURRENCE_PRESETS[preset];

  if (options?.count) {
    rrule += `;COUNT=${options.count}`;
  }

  if (options?.until) {
    rrule += `;UNTIL=${options.until.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  }

  return rrule;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate RRULE string
 */
export function validateRRule(rruleString: string): { valid: boolean; error?: string } {
  try {
    rrulestr(rruleString);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid RRULE',
    };
  }
}

/**
 * Check if recurring event needs new instances generated
 */
export async function needsInstanceGeneration(
  parentEventId: string,
  futureWindow: number = 90 // days
): Promise<boolean> {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + futureWindow);

    // Check if there are instances within the future window
    const instances = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.parentEventId, parentEventId),
          gte(calendarEvents.startTime, new Date()),
          lte(calendarEvents.startTime, endDate)
        )
      )
      .limit(1);

    return instances.length === 0;
  } catch (_error) {
return false;
  }
}

