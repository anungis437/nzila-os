/**
 * Financial period boundaries must not be normalized by JavaScript Date parsing.
 * Accept an ISO calendar date or a complete, timezone-qualified ISO timestamp.
 * A partial pair, impossible date, reversed interval or ambiguous local timestamp
 * is invalid; never silently replace a caller-supplied boundary with a default.
 */
const ISO_BOUNDARY = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2}))?$/;

function parseBoundary(value: string): Date | null {
  const match = ISO_BOUNDARY.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  if (hourText !== undefined) {
    if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) return null;
    if (zone !== 'Z') {
      const offsetHours = Number(zone.slice(1, 3));
      const offsetMinutes = Number(zone.slice(4, 6));
      if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return null;
    }
  }
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

export function resolveBillingPeriod(
  input: { periodStart?: string; periodEnd?: string },
  calculateDefault: () => { periodStart: Date; periodEnd: Date },
): { periodStart: Date; periodEnd: Date } | null {
  const hasStart = input.periodStart !== undefined;
  const hasEnd = input.periodEnd !== undefined;
  if (hasStart !== hasEnd) return null;
  const dates = hasStart && hasEnd
    ? { periodStart: parseBoundary(input.periodStart!), periodEnd: parseBoundary(input.periodEnd!) }
    : calculateDefault();
  const { periodStart, periodEnd } = dates;
  if (!(periodStart instanceof Date) || !(periodEnd instanceof Date)) return null;
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime())) return null;
  if (periodStart.getTime() > periodEnd.getTime()) return null;
  return { periodStart, periodEnd };
}
