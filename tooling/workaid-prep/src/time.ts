/**
 * Zone-aware calendar helpers. All date logic works on local calendar dates in
 * an explicitly supplied IANA zone; none of it adds fixed 24-hour spans to an
 * instant, which is wrong across daylight-saving transitions.
 */

export interface LocalDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
}

export function toIsoDate(d: LocalDate): string {
  return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

export function parseIsoDate(s: string): LocalDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`invalid ISO date: ${s}`);
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  const check = new Date(Date.UTC(d.year, d.month - 1, d.day));
  if (check.getUTCFullYear() !== d.year || check.getUTCMonth() !== d.month - 1 || check.getUTCDate() !== d.day) {
    throw new Error(`invalid calendar date: ${s}`);
  }
  return d;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(instant: Date, timeZone: string): WallParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as unknown as WallParts;
}

export function localDateInZone(instant: Date, timeZone: string): LocalDate {
  const p = partsInZone(instant, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

export function addCalendarDays(d: LocalDate, days: number): LocalDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(d: LocalDate): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

/**
 * Convert a wall-clock time in a zone to an instant. An ambiguous time
 * (fall-back) resolves to the earlier instant; a nonexistent time
 * (spring-forward gap) resolves to the first representable instant after it.
 */
export function zonedWallTimeToInstant(d: LocalDate, hour: number, minute: number, timeZone: string): Date {
  const wallAsUtc = Date.UTC(d.year, d.month - 1, d.day, hour, minute, 0);
  const offsetAt = (ms: number) => {
    const p = partsInZone(new Date(ms), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
  };
  const first = wallAsUtc - offsetAt(wallAsUtc);
  const second = wallAsUtc - offsetAt(first);
  const matches = (ms: number) => {
    const p = partsInZone(new Date(ms), timeZone);
    return p.year === d.year && p.month === d.month && p.day === d.day && p.hour === hour && p.minute === minute;
  };
  const candidates = [first, second].sort((a, b) => a - b);
  for (const c of candidates) if (matches(c)) return new Date(c);
  return new Date(candidates[1]!);
}

export interface BusinessCalendar {
  readonly timeZone: string;
  /** ISO dates (YYYY-MM-DD) that are non-working days in addition to weekends. */
  readonly holidays: readonly string[];
}

export function isBusinessDay(d: LocalDate, cal: BusinessCalendar): boolean {
  const dow = dayOfWeek(d);
  if (dow === 0 || dow === 6) return false;
  return !cal.holidays.includes(toIsoDate(d));
}
