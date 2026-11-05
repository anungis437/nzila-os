/**
 * Date Standardization Utilities
 * 
 * Provides consistent date handling across the application
 * - All dates stored in UTC ISO 8601 format
 * - Consistent parsing and formatting
 * - Timezone-aware conversions for display
 * - Validation helpers
 * 
 * Usage:
 *   import { toUTCISO, parseDate, formatForDisplay } from '@/lib/date-utils';
 * 
 *   const utcDate = toUTCISO(new Date());
 *   const parsed = parseDate('2026-02-11T10:30:00Z');
 *   const display = formatForDisplay(utcDate, 'America/Toronto');
 */

/**
 * Convert any date input to UTC ISO 8601 string
 * This is the standard format for storing dates in the database
 * 
 * @param date - Date object, string, or timestamp
 * @returns ISO 8601 string in UTC (e.g., "2026-02-11T15:30:00.000Z")
 * 
 * @example
 * toUTCISO(new Date()) // "2026-02-11T15:30:00.000Z"
 * toUTCISO("2026-02-11") // "2026-02-11T00:00:00.000Z"
 * toUTCISO(1707660600000) // "2026-02-11T15:30:00.000Z"
 */
export function toUTCISO(date: Date | string | number): string {
  if (!date) {
    throw new Error('Date is required');
  }
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    return dateObj.toISOString();
  } catch (error) {
    throw new Error(`Failed to convert to UTC ISO: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse a date string/timestamp to Date object
 * Handles various input formats consistently
 * 
 * @param date - ISO string, timestamp, or Date object
 * @returns Date object in UTC
 * 
 * @example
 * parseDate("2026-02-11T15:30:00Z") // Date object
 * parseDate(1707660600000) // Date object
 * parseDate("2026-02-11") // Date object at midnight UTC
 */
export function parseDate(date: Date | string | number): Date {
  if (!date) {
    throw new Error('Date is required');
  }
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  return dateObj;
}

/**
 * Get current UTC timestamp as ISO string
 * Convenience function for creating "now" timestamps
 * 
 * @returns Current UTC time as ISO string
 * 
 * @example
 * now() // "2026-02-11T15:30:00.000Z"
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Format date for display in user's timezone
 * 
 * @param date - Date to format (ISO string, Date object, or timestamp)
 * @param timezone - IANA timezone (e.g., "America/Toronto", "UTC")
 * @param options - Intl.DateTimeFormat options
 * @param locale - BCP-47 tag to format in (a screen passes its `useLocale()`); defaults to the US English the function has always produced
 * @returns Formatted date string
 * 
 * @example
 * formatForDisplay("2026-02-11T15:30:00Z", "America/Toronto")
 * // "Feb 11, 2026, 10:30 AM"
 * 
 * formatForDisplay("2026-02-11T15:30:00Z", "America/Toronto", {
 *   dateStyle: 'full',
 *   timeStyle: 'short'
 * })
 * // "Tuesday, February 11, 2026 at 10:30 AM"
 */
export function formatForDisplay(
  date: Date | string | number,
  timezone: string = 'UTC',
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
  locale: string = 'en-US'
): string {
  const dateObj = parseDate(date);
  
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: timezone,
  }).format(dateObj);
}

/**
 * Format date as ISO date string (YYYY-MM-DD)
 * Useful for date inputs and database queries
 * 
 * @param date - Date to format
 * @param timezone - Timezone for the date (defaults to UTC)
 * @returns Date string in YYYY-MM-DD format
 * 
 * @example
 * formatAsDate("2026-02-11T15:30:00Z") // "2026-02-11"
 * formatAsDate("2026-02-11T15:30:00Z", "America/Toronto") // "2026-02-11" (might be different day)
 */
export function formatAsDate(
  date: Date | string | number,
  timezone: string = 'UTC'
): string {
  const dateObj = parseDate(date);
  
  // A machine format, not a display: en-CA is the locale whose numeric date is YYYY-MM-DD, so it stays fixed whatever the reader's language.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(dateObj);
}

/**
 * Format date as ISO time string (HH:MM:SS)
 * 
 * @param date - Date to format
 * @param timezone - Timezone for the time (defaults to UTC)
 * @returns Time string in HH:MM:SS format
 * 
 * @example
 * formatAsTime("2026-02-11T15:30:45Z") // "15:30:45"
 * formatAsTime("2026-02-11T15:30:45Z", "America/Toronto") // "10:30:45"
 */
export function formatAsTime(
  date: Date | string | number,
  timezone: string = 'UTC'
): string {
  const dateObj = parseDate(date);
  
  // A machine format (HH:MM:SS, 24-hour), fixed whatever the reader's language: fr-CA would write "15 h 30 min 45 s".
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(dateObj);
}

/**
 * Check if a date string is valid ISO 8601 format
 * 
 * @param dateString - String to validate
 * @returns true if valid ISO 8601, false otherwise
 * 
 * @example
 * isValidISODate("2026-02-11T15:30:00Z") // true
 * isValidISODate("2026-02-11") // true
 * isValidISODate("not a date") // false
 */
export function isValidISODate(dateString: string): boolean {
  if (typeof dateString !== 'string') return false;
  
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.toISOString().startsWith(dateString.substring(0, 10));
  } catch {
    return false;
  }
}

/**
 * Calculate difference between two dates
 * 
 * @param date1 - First date
 * @param date2 - Second date (defaults to now)
 * @returns Object with difference in various units
 * 
 * @example
 * const diff = dateDifference("2026-02-10T00:00:00Z", "2026-02-11T15:30:00Z");
 * // { milliseconds: 140400000, seconds: 140400, minutes: 2340, hours: 39, days: 1.625 }
 */
export function dateDifference(
  date1: Date | string | number,
  date2: Date | string | number = new Date()
): {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
} {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  
  const milliseconds = Math.abs(d2.getTime() - d1.getTime());
  
  return {
    milliseconds,
    seconds: milliseconds / 1000,
    minutes: milliseconds / (1000 * 60),
    hours: milliseconds / (1000 * 60 * 60),
    days: milliseconds / (1000 * 60 * 60 * 24),
  };
}

/**
 * Add/subtract time from a date
 * 
 * @param date - Starting date
 * @param amount - Amount to add (negative to subtract)
 * @param unit - Unit of time
 * @returns New Date object
 * 
 * @example
 * addTime("2026-02-11T15:30:00Z", 2, 'days')
 * // Date object for "2026-02-13T15:30:00Z"
 * 
 * addTime(new Date(), -30, 'minutes')
 * // Date object for 30 minutes ago
 */
export function addTime(
  date: Date | string | number,
  amount: number,
  unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
): Date {
  const dateObj = new Date(parseDate(date));
  
  switch (unit) {
    case 'milliseconds':
      dateObj.setMilliseconds(dateObj.getMilliseconds() + amount);
      break;
    case 'seconds':
      dateObj.setSeconds(dateObj.getSeconds() + amount);
      break;
    case 'minutes':
      dateObj.setMinutes(dateObj.getMinutes() + amount);
      break;
    case 'hours':
      dateObj.setHours(dateObj.getHours() + amount);
      break;
    case 'days':
      dateObj.setDate(dateObj.getDate() + amount);
      break;
    case 'weeks':
      dateObj.setDate(dateObj.getDate() + amount * 7);
      break;
    case 'months':
      dateObj.setMonth(dateObj.getMonth() + amount);
      break;
    case 'years':
      dateObj.setFullYear(dateObj.getFullYear() + amount);
      break;
  }
  
  return dateObj;
}

/**
 * Check if date is in the past
 * 
 * @param date - Date to check
 * @returns true if date is before now
 * 
 * @example
 * isPast("2025-01-01T00:00:00Z") // true
 * isPast("2027-01-01T00:00:00Z") // false
 */
export function isPast(date: Date | string | number): boolean {
  return parseDate(date).getTime() < Date.now();
}

/**
 * Check if date is in the future
 * 
 * @param date - Date to check
 * @returns true if date is after now
 * 
 * @example
 * isFuture("2027-01-01T00:00:00Z") // true
 * isFuture("2025-01-01T00:00:00Z") // false
 */
export function isFuture(date: Date | string | number): boolean {
  return parseDate(date).getTime() > Date.now();
}

/**
 * Check if date is today (in specified timezone)
 * 
 * @param date - Date to check
 * @param timezone - Timezone for comparison (defaults to UTC)
 * @returns true if date is today in the specified timezone
 * 
 * @example
 * isToday("2026-02-11T15:30:00Z", "America/Toronto")
 */
export function isToday(
  date: Date | string | number,
  timezone: string = 'UTC'
): boolean {
  const dateStr = formatAsDate(date, timezone);
  const todayStr = formatAsDate(new Date(), timezone);
  return dateStr === todayStr;
}

/**
 * Get start of day in specified timezone
 * 
 * @param date - Date to get start of day for
 * @param timezone - Timezone (defaults to UTC)
 * @returns ISO string for start of day (00:00:00)
 * 
 * @example
 * startOfDay("2026-02-11T15:30:00Z", "America/Toronto")
 * // "2026-02-11T05:00:00.000Z" (midnight Toronto time in UTC)
 */
export function startOfDay(
  date: Date | string | number,
  timezone: string = 'UTC'
): string {
  const dateStr = formatAsDate(date, timezone);
  // Create date at midnight in the target timezone
  const dateObj = new Date(`${dateStr}T00:00:00`);
  
  // If timezone is not UTC, we need to adjust
  if (timezone !== 'UTC') {
    // Read back as numeric parts, never shown: the locale is fixed so the parts parse the same everywhere.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dateObj);
    
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    
    return new Date(`${year}-${month}-${day}T00:00:00`).toISOString();
  }
  
  return dateObj.toISOString();
}

/**
 * Get end of day in specified timezone
 * 
 * @param date - Date to get end of day for
 * @param timezone - Timezone (defaults to UTC)
 * @returns ISO string for end of day (23:59:59.999)
 * 
 * @example
 * endOfDay("2026-02-11T15:30:00Z", "America/Toronto")
 * // "2026-02-12T04:59:59.999Z" (23:59:59 Toronto time in UTC)
 */
export function endOfDay(
  date: Date | string | number,
  timezone: string = 'UTC'
): string {
  const start = new Date(startOfDay(date, timezone));
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * 
 * @param date - Date to format
 * @param baseDate - Reference date (defaults to now)
 * @returns Formatted relative time string
 * 
 * @example
 * formatRelativeTime("2026-02-11T13:30:00Z") // "2 hours ago"
 * formatRelativeTime("2026-02-13T15:30:00Z") // "in 2 days"
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date | string | number = new Date()
): string {
  const dateObj = parseDate(date);
  const baseObj = parseDate(baseDate);
  
  const diff = dateObj.getTime() - baseObj.getTime();
  const absDiff = Math.abs(diff);
  const isPastDate = diff < 0;
  
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  
  const seconds = absDiff / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const weeks = days / 7;
  const months = days / 30;
  const years = days / 365;
  
  if (years >= 1) {
    return rtf.format(isPastDate ? -Math.round(years) : Math.round(years), 'year');
  } else if (months >= 1) {
    return rtf.format(isPastDate ? -Math.round(months) : Math.round(months), 'month');
  } else if (weeks >= 1) {
    return rtf.format(isPastDate ? -Math.round(weeks) : Math.round(weeks), 'week');
  } else if (days >= 1) {
    return rtf.format(isPastDate ? -Math.round(days) : Math.round(days), 'day');
  } else if (hours >= 1) {
    return rtf.format(isPastDate ? -Math.round(hours) : Math.round(hours), 'hour');
  } else if (minutes >= 1) {
    return rtf.format(isPastDate ? -Math.round(minutes) : Math.round(minutes), 'minute');
  } else {
    return rtf.format(isPastDate ? -Math.round(seconds) : Math.round(seconds), 'second');
  }
}

/**
 * Common timezone mappings
 */
export const TIMEZONES = {
  UTC: 'UTC',
  EASTERN: 'America/Toronto',
  CENTRAL: 'America/Chicago',
  MOUNTAIN: 'America/Denver',
  PACIFIC: 'America/Los_Angeles',
  ATLANTIC: 'America/Halifax',
} as const;

/**
 * Validate date range
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @throws Error if end date is before start date
 * 
 * @example
 * validateDateRange("2026-02-11", "2026-02-13") // OK
 * validateDateRange("2026-02-13", "2026-02-11") // Throws error
 */
export function validateDateRange(
  startDate: Date | string | number,
  endDate: Date | string | number
): void {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  if (end < start) {
    throw new Error('End date must be after start date');
  }
}
