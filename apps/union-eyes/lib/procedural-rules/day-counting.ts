/**
 * Deterministic day counting under an explicit calendar policy. Pure: no clock, no database, no zone (days only).
 *
 * Convention: the trigger day is day 0; counting starts on the following day. A paused day is never counted and is never a
 * due day. In `business_days` mode only working days are counted. In `calendar_days` mode every unpaused day is counted and
 * non-working days only matter for roll-forward.
 */
import { addCalendarDays, isCalendarDay } from '@/lib/deadline-engine/deadline-day';
import type { CalendarDay, CalendarPolicy, HolidayCalendarVersion, PauseRecord } from './types';

/** Upper bound on days walked, so a malformed policy (e.g. every weekday a weekend) cannot loop. */
export const MAX_DAYS_WALKED = 3660;

export function weekdayOf(day: CalendarDay): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface CountingContext {
  policy: CalendarPolicy;
  holidays: HolidayCalendarVersion | null;
  pauses: PauseRecord[];
}

export type CountTraceEntry =
  | { day: CalendarDay; action: 'counted'; count: number }
  | { day: CalendarDay; action: 'skipped'; why: 'weekend' | 'holiday' | 'paused' }
  | { day: CalendarDay; action: 'rolled_forward'; why: 'weekend' | 'holiday' | 'paused' };

export type CountResult =
  | { ok: true; dueDay: CalendarDay; trace: CountTraceEntry[]; walkedFrom: CalendarDay; walkedTo: CalendarDay }
  | { ok: false; reason: 'walk_limit' | 'coverage_gap' | 'open_pause'; day: CalendarDay; trace: CountTraceEntry[] };

function holidaySet(version: HolidayCalendarVersion | null): Set<string> {
  return new Set(version?.days ?? []);
}

function pausedOn(day: CalendarDay, pauses: PauseRecord[]): PauseRecord | undefined {
  return pauses.find((p) => p.startDay <= day && (p.endDay === null || day <= p.endDay));
}

/** Why a day is not a working day under the policy, or null when it is one. */
export function nonWorkingReason(day: CalendarDay, policy: CalendarPolicy, holidays: Set<string>): 'weekend' | 'holiday' | null {
  if (policy.weekendDays.includes(weekdayOf(day))) return 'weekend';
  if (policy.holidays === 'excluded' && holidays.has(day)) return 'holiday';
  return null;
}

function outsideCoverage(day: CalendarDay, ctx: CountingContext): boolean {
  if (ctx.policy.holidays !== 'excluded' || !ctx.holidays) return false;
  return day < ctx.holidays.coverageFrom || day > ctx.holidays.coverageTo;
}

/**
 * The day `days` counted days after `startDay`, then rolled forward if the policy says so. Fails closed when the walk
 * reaches a day the holiday calendar does not cover, or an open pause.
 */
export function countDays(startDay: CalendarDay, days: number, ctx: CountingContext): CountResult {
  if (!isCalendarDay(startDay)) throw new RangeError(`countDays: "${startDay}" is not a calendar day`);
  if (!Number.isInteger(days) || days < 0) throw new RangeError('countDays: days must be a non-negative whole number');
  const holidays = holidaySet(ctx.holidays);
  const trace: CountTraceEntry[] = [];
  let day = startDay;
  let counted = 0;
  let walked = 0;
  const step = (): CountResult | null => {
    day = addCalendarDays(day, 1);
    walked += 1;
    if (walked > MAX_DAYS_WALKED) return { ok: false, reason: 'walk_limit', day, trace };
    if (outsideCoverage(day, ctx)) return { ok: false, reason: 'coverage_gap', day, trace };
    return null;
  };

  while (counted < days) {
    const failed = step();
    if (failed) return failed;
    const pause = pausedOn(day, ctx.pauses);
    if (pause) {
      if (pause.endDay === null) return { ok: false, reason: 'open_pause', day, trace };
      trace.push({ day, action: 'skipped', why: 'paused' });
      continue;
    }
    if (ctx.policy.mode === 'business_days') {
      const why = nonWorkingReason(day, ctx.policy, holidays);
      if (why) {
        trace.push({ day, action: 'skipped', why });
        continue;
      }
    }
    counted += 1;
    trace.push({ day, action: 'counted', count: counted });
  }

  // The due day itself must be outside any pause; and, when the policy rolls forward, a working day.
  for (;;) {
    if (outsideCoverage(day, ctx) && day !== startDay) return { ok: false, reason: 'coverage_gap', day, trace };
    const pause = pausedOn(day, ctx.pauses);
    if (pause && pause.endDay === null) return { ok: false, reason: 'open_pause', day, trace };
    const why = pause ? 'paused' : ctx.policy.rollForward === 'next_working_day' ? nonWorkingReason(day, ctx.policy, holidays) : null;
    if (!why) break;
    trace.push({ day, action: 'rolled_forward', why });
    const failed = step();
    if (failed) return failed;
  }
  return { ok: true, dueDay: day, trace, walkedFrom: startDay, walkedTo: day };
}

/** Whole calendar days from `a` to `b` (b − a). */
export function calendarDaysBetween(a: CalendarDay, b: CalendarDay): number {
  const toUtc = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}
