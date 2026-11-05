/**
 * Calendar days. A due date, an effective date, an expiry, a pay period: a day somebody recorded, not a moment. It reaches the screen as "2026-03-04" (a `date` column), as the
 * UTC-midnight instant a day was stored as ("2026-03-04T00:00:00.000Z", a timestamp written from a date input), or as the end-of-day marker of a period ("2026-03-04T23:59:59.999Z").
 * `new Date(value)` reads the first two as midnight UTC, and a reader west of Greenwich (every Canadian time zone) then sees the day before: a contract that takes effect on 1 April
 * reads "March 2026", a deadline reads one day early and is called overdue the evening before it is due.
 *
 * `recordedDay` reads those shapes as the day they name, at noon in the reader's own zone, so every local formatter and getter (`toLocaleDateString`, date-fns `format`,
 * `getDate`) answers with that day and no daylight-saving gap can move it. Any other value is a real instant (a time of day was recorded) and is read as the instant it is.
 */
const RECORDED_DAY = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](?:00:00:00(?:\.0+)?|23:59:59(?:\.\d+)?)(?:Z|[+-]00(?::?00)?)?)?$/;

export type DayValue = string | Date;

export type DayStyle = 'numeric' | 'short' | 'medium' | 'long';

const STYLE_OPTIONS: Record<Exclude<DayStyle, 'numeric'>, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: 'short' },
  medium: { dateStyle: 'medium' },
  long: { dateStyle: 'long' },
};

function isoOf(value: DayValue): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  return '';
}

function dayParts(value: DayValue): [number, number, number] | null {
  const match = RECORDED_DAY.exec(isoOf(value));
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/**
 * The Date to format, compare or take fields from: the recorded day at noon in the reader's zone, or the instant itself when a time of day was recorded. A day that does not exist
 * (30 February) is no date, and neither is a value that is not a day at all: a nullable column a screen typed as present arrives as null, and `new Date(null)` is 1 January 1970.
 */
export function recordedDay(value: DayValue): Date {
  if (typeof value !== 'string' && !(value instanceof Date)) return new Date(Number.NaN);
  const parts = dayParts(value);
  if (!parts) return new Date(value);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12);
  return date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : new Date(Number.NaN);
}

/** The day as text in the reader's locale (the browser's when none is given). A value that is no date is shown as it was received; nothing received shows as nothing. */
export function formatDay(value: DayValue, locale?: string, style: DayStyle = 'medium'): string {
  const date = recordedDay(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  return new Intl.DateTimeFormat(locale, style === 'numeric' ? undefined : STYLE_OPTIONS[style]).format(date);
}

function localDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

/** Whole calendar days from the reader's today to the recorded day: 0 on the day itself, negative after it. Instants count by the day they fall on for the reader. */
export function daysUntilDay(value: DayValue, now: Date = new Date()): number {
  return Math.round(localDayNumber(recordedDay(value)) - localDayNumber(now));
}

/** True once the recorded day is over: a deadline on 4 March is not overdue until 5 March, whatever the hour or the time zone. An instant is past when it has been reached. A value that is no date is not past. */
export function isDayPast(value: DayValue, now: Date = new Date()): boolean {
  const date = recordedDay(value);
  if (Number.isNaN(date.getTime())) return false;
  return dayParts(value) ? daysUntilDay(value, now) < 0 : date.getTime() < now.getTime();
}

/**
 * The reader's calendar day for an instant, as "YYYY-MM-DD": today by default. `toISOString().slice(0, 10)` is the UTC day, which is already tomorrow from 7 PM in Toronto (8 PM in
 * daylight time): a session that ends today would read as over, and a date input limited to today would accept tomorrow.
 */
export function dayOf(instant: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}
