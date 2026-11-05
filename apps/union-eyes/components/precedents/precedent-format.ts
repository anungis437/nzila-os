/**
 * How the precedents screens write a stored date: in the viewer's language, never in a fixed one.
 *
 * A decision, filing or hearing date is stored as an instant (timestamptz) of the day it names, and the list filters read days as UTC
 * (see listParams in precedent-filters.ts), so such a day is shown in UTC. Shown in the viewer's own time zone, a decision dated the 1st
 * of a month could read as the last day of the month before. A value that is not a date is shown as stored, never as "Invalid Date".
 */
import type { useFormatter } from 'next-intl';

type Formatter = ReturnType<typeof useFormatter>;

const DAY_STYLES = {
  long: { dateStyle: 'long' },
  month: { month: 'short', year: 'numeric' },
} as const;

export function formatDay(format: Formatter, value: string, style: keyof typeof DAY_STYLES = 'long'): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format.dateTime(date, { ...DAY_STYLES[style], timeZone: 'UTC' });
}

/** A moment the platform recorded (a row's creation or last change), in the time zone the application is configured with. */
export function formatMoment(format: Formatter, value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' });
}
