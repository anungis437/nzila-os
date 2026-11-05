/**
 * Calendar-day deadlines (owner decision): a deadline set or calculated for a DAY — a date picker, "N days after filing", an
 * extension "to <date>", a CBA step "within 10 days" — falls due at 23:59 on that day in the union organization's own time
 * zone, not at midnight UTC and not at whatever time of day the calculation happened to run. The stored column stays a
 * `timestamp with time zone`; this module turns the day into that instant. A value that already carries a time of day (a
 * datetime somebody entered, a moment the server stamped) is an instant and is never passed through here.
 *
 * Pure: no database, no clock, no dependency beyond Intl. The organization's zone is read by organization-time-zone.ts.
 *
 * Which zone an organization keeps its days in, in order:
 *   1. `organizations.settings.timezone`, when it names an IANA zone this runtime knows (the administrator's own setting);
 *   2. the zone of `organizations.province_territory`, then of `organizations.address.province` (PROVINCE_TIME_ZONES);
 *   3. DEFAULT_ORGANIZATION_TIME_ZONE.
 * The province mapping is one zone per province or territory. Where a province spans zones (north-western Ontario, Labrador,
 * Lloydminster, eastern BC, Nunavut) the organization's explicit `settings.timezone` is the way to say otherwise.
 */

/** The zone used when an organization records neither a time zone nor a province or territory we can place. */
export const DEFAULT_ORGANIZATION_TIME_ZONE = 'America/Toronto';

/** The local time of day a calendar-day deadline falls due. */
export const END_OF_DAY = { hour: 23, minute: 59 } as const;

/** One IANA zone per Canadian province and territory code. */
export const PROVINCE_TIME_ZONES: Readonly<Record<string, string>> = {
  ON: 'America/Toronto',
  QC: 'America/Toronto',
  BC: 'America/Vancouver',
  AB: 'America/Edmonton',
  MB: 'America/Winnipeg',
  SK: 'America/Regina',
  NS: 'America/Halifax',
  NB: 'America/Halifax',
  PE: 'America/Halifax',
  NL: 'America/St_Johns',
  YT: 'America/Whitehorse',
  NT: 'America/Yellowknife',
  NU: 'America/Iqaluit',
};

/** Names (English and French, accents and punctuation ignored) a stored province may use instead of its code. */
const PROVINCE_NAMES: Readonly<Record<string, string>> = {
  ONTARIO: 'ON',
  QUEBEC: 'QC',
  'BRITISH COLUMBIA': 'BC',
  'COLOMBIE BRITANNIQUE': 'BC',
  ALBERTA: 'AB',
  MANITOBA: 'MB',
  SASKATCHEWAN: 'SK',
  'NOVA SCOTIA': 'NS',
  'NOUVELLE ECOSSE': 'NS',
  'NEW BRUNSWICK': 'NB',
  'NOUVEAU BRUNSWICK': 'NB',
  'PRINCE EDWARD ISLAND': 'PE',
  PEI: 'PE',
  'ILE DU PRINCE EDOUARD': 'PE',
  'NEWFOUNDLAND AND LABRADOR': 'NL',
  NEWFOUNDLAND: 'NL',
  'TERRE NEUVE ET LABRADOR': 'NL',
  YUKON: 'YT',
  'NORTHWEST TERRITORIES': 'NT',
  'TERRITOIRES DU NORD OUEST': 'NT',
  NUNAVUT: 'NU',
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayParts(day: string): [number, number, number] | null {
  const match = DAY.exec(day);
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, date));
  probe.setUTCFullYear(year);
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === date ? [year, month, date] : null;
}

/** True when the text is exactly a calendar day that exists ("2026-03-04"; not "2026-02-30", not a datetime). */
export function isCalendarDay(value: unknown): value is string {
  return typeof value === 'string' && dayParts(value) !== null;
}

/** True when this runtime knows the IANA zone. */
export function isKnownTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>(); // ga-check:exempt — memo of Intl.DateTimeFormat instances per time zone, not persisted state

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/** The wall clock in the zone at an instant. */
function wallClockAt(instant: Date, timeZone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const part of wallClockFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  // A proleptic year before 1 prints as its era year; deadlines never get there, so the runtime's own text is read as is.
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: ((instant.getTime() % 1000) + 1000) % 1000,
  };
}

/** The zone's offset from UTC at an instant, in milliseconds (east positive): -4 h for Toronto in summer. */
function offsetAt(instant: number, timeZone: string): number {
  const wall = wallClockAt(new Date(instant), timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond);
  return asUtc - instant;
}

/**
 * The instant a wall-clock time names in the zone. When the time occurs twice (the hour a fall-back repeats) the earlier is
 * taken; when it does not occur (the hour a spring-forward skips) the clock is read forward by the gap — the same choice as
 * Temporal's "compatible" disambiguation.
 */
function instantOfWallClock(wall: WallClock, timeZone: string): Date {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond);
  const before = offsetAt(asUtc - 86_400_000, timeZone);
  const after = offsetAt(asUtc + 86_400_000, timeZone);
  const candidates = [...new Set([before, after])]
    .map((offset) => asUtc - offset)
    .filter((instant) => offsetAt(instant, timeZone) === asUtc - instant)
    .sort((a, b) => a - b);
  if (candidates.length > 0) return new Date(candidates[0]);
  // In the gap: neither offset reads back as this wall time. Apply the offset in force before the transition.
  return new Date(asUtc - before);
}

/**
 * 23:59:00.000 on the calendar day, in the zone, as an instant. Throws a RangeError for a day that does not exist (2026-02-30),
 * for text that is not a bare day, and for a zone this runtime does not know.
 */
export function endOfDayInZone(day: string, timeZone: string): Date {
  const parts = dayParts(day);
  if (!parts) throw new RangeError(`endOfDayInZone: "${day}" is not a calendar day (YYYY-MM-DD)`);
  if (!isKnownTimeZone(timeZone)) throw new RangeError(`endOfDayInZone: "${timeZone}" is not a known IANA time zone`);
  return instantOfWallClock(
    { year: parts[0], month: parts[1], day: parts[2], hour: END_OF_DAY.hour, minute: END_OF_DAY.minute, second: 0, millisecond: 0 },
    timeZone,
  );
}

/** The calendar day ("YYYY-MM-DD") an instant falls on in the zone. */
export function calendarDayInZone(instant: Date, timeZone: string): string {
  if (Number.isNaN(instant.getTime())) throw new RangeError('calendarDayInZone: invalid instant');
  if (!isKnownTimeZone(timeZone)) throw new RangeError(`calendarDayInZone: "${timeZone}" is not a known IANA time zone`);
  const wall = wallClockAt(instant, timeZone);
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0');
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** The calendar day `days` after (negative: before) the day. Pure calendar arithmetic: no zone, no daylight saving. */
export function addCalendarDays(day: string, days: number): string {
  const parts = dayParts(day);
  if (!parts) throw new RangeError(`addCalendarDays: "${day}" is not a calendar day (YYYY-MM-DD)`);
  if (!Number.isInteger(days)) throw new RangeError('addCalendarDays: days must be a whole number');
  const shifted = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * A day-count deadline ("within N days of <event>"): the event's calendar day in the zone, N calendar days later, due at 23:59
 * that day in the zone.
 */
export function dueAtEndOfDayAfter(event: Date, days: number, timeZone: string): Date {
  return endOfDayInZone(addCalendarDays(calendarDayInZone(event, timeZone), days), timeZone);
}

/**
 * The instant `days` calendar days after (negative: before) the instant at the same wall-clock time in the zone. "Three days
 * before a deadline due at 23:59" is 23:59 three days earlier on the local clock, even when a daylight-saving change lies
 * between (plain 72-hour arithmetic would land at 22:59 or 00:59).
 */
export function shiftByCalendarDaysInZone(instant: Date, days: number, timeZone: string): Date {
  if (Number.isNaN(instant.getTime())) throw new RangeError('shiftByCalendarDaysInZone: invalid instant');
  if (!Number.isInteger(days)) throw new RangeError('shiftByCalendarDaysInZone: days must be a whole number');
  if (!isKnownTimeZone(timeZone)) throw new RangeError(`shiftByCalendarDaysInZone: "${timeZone}" is not a known IANA time zone`);
  if (days === 0) return new Date(instant.getTime());
  const wall = wallClockAt(instant, timeZone);
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return instantOfWallClock(
    { ...wall, year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() },
    timeZone,
  );
}

function provinceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim();
}

/** The zone of a Canadian province or territory, given its code ("ON") or name ("Ontario", "Québec"); undefined otherwise. */
export function zoneForProvince(province: unknown): string | undefined {
  if (typeof province !== 'string') return undefined;
  const key = provinceKey(province);
  if (key === '') return undefined;
  const code = PROVINCE_TIME_ZONES[key] ? key : PROVINCE_NAMES[key];
  return code ? PROVINCE_TIME_ZONES[code] : undefined;
}

export type OrganizationTimeZoneSource = 'settings' | 'province_territory' | 'address_province' | 'default';

export interface OrganizationTimeZone {
  timeZone: string;
  source: OrganizationTimeZoneSource;
}

/** What an organization row records that can place it in a time zone. */
export interface OrganizationZoneFacts {
  settings?: Record<string, unknown> | null;
  provinceTerritory?: string | null;
  address?: { province?: string | null } | null;
}

/** The organization's zone, by the order documented at the top of this module. */
export function organizationTimeZone(facts: OrganizationZoneFacts | null | undefined): OrganizationTimeZone {
  const configured = facts?.settings?.timezone;
  if (isKnownTimeZone(configured)) return { timeZone: configured.trim(), source: 'settings' };
  const byProvince = zoneForProvince(facts?.provinceTerritory);
  if (byProvince) return { timeZone: byProvince, source: 'province_territory' };
  const byAddress = zoneForProvince(facts?.address?.province);
  if (byAddress) return { timeZone: byAddress, source: 'address_province' };
  return { timeZone: DEFAULT_ORGANIZATION_TIME_ZONE, source: 'default' };
}

/**
 * The write values with each named field that holds a bare calendar day replaced by 23:59 that day in the zone. A field that
 * holds anything else (a datetime, a Date, null, or a day that does not exist) is left exactly as it came, for the write path's
 * own validation to judge.
 */
export function dayFieldsAtEndOfDay(values: Record<string, unknown>, fields: readonly string[], timeZone: string): Record<string, unknown> {
  const shaped = { ...values };
  for (const field of fields) {
    const value = values[field];
    if (isCalendarDay(value)) shaped[field] = endOfDayInZone(value, timeZone);
  }
  return shaped;
}

/** True when any named field holds a bare calendar day. */
export function hasDayField(values: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.some((field) => isCalendarDay(values[field]));
}

/** claim_deadlines columns that hold a due instant (POST /api/deadlines, POST /api/deadlines/compliance). */
export const CLAIM_DEADLINE_DAY_FIELDS = ['dueDate', 'originalDeadline'] as const;

/** arbitrations columns that hold a due instant (POST /api/arbitrations, PATCH /api/arbitrations/{id}). Hearing dates are appointments, not deadlines. */
export const ARBITRATION_DEADLINE_DAY_FIELDS = ['submissionDeadline', 'evidenceDeadline', 'replyDeadline', 'awardDeadline'] as const;
