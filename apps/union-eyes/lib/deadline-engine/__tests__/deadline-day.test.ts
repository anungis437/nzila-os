import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  calendarDayInZone,
  dayFieldsAtEndOfDay,
  DEFAULT_ORGANIZATION_TIME_ZONE,
  dueAtEndOfDayAfter,
  endOfDayInZone,
  hasDayField,
  isCalendarDay,
  organizationTimeZone,
  PROVINCE_TIME_ZONES,
  shiftByCalendarDaysInZone,
  zoneForProvince,
} from '../deadline-day';

const TORONTO = 'America/Toronto';
const iso = (date: Date): string => date.toISOString();

describe('endOfDayInZone', () => {
  it('is 23:59:00.000 local on the day, in UTC terms', () => {
    expect(iso(endOfDayInZone('2026-01-15', TORONTO))).toBe('2026-01-16T04:59:00.000Z'); // EST, UTC-5
    expect(iso(endOfDayInZone('2026-07-15', TORONTO))).toBe('2026-07-16T03:59:00.000Z'); // EDT, UTC-4
  });

  it('honours the spring-forward day in America/Toronto (8 March 2026)', () => {
    expect(iso(endOfDayInZone('2026-03-07', TORONTO))).toBe('2026-03-08T04:59:00.000Z');
    // The clock skipped 02:00-03:00 that morning; 23:59 that evening is already daylight time.
    expect(iso(endOfDayInZone('2026-03-08', TORONTO))).toBe('2026-03-09T03:59:00.000Z');
  });

  it('honours the fall-back day in America/Toronto (1 November 2026)', () => {
    expect(iso(endOfDayInZone('2026-10-31', TORONTO))).toBe('2026-11-01T03:59:00.000Z');
    // The clock repeated 01:00-02:00 that morning; 23:59 that evening is standard time.
    expect(iso(endOfDayInZone('2026-11-01', TORONTO))).toBe('2026-11-02T04:59:00.000Z');
  });

  it('handles the half-hour zone America/St_Johns in standard and daylight time', () => {
    expect(iso(endOfDayInZone('2026-01-15', 'America/St_Johns'))).toBe('2026-01-16T03:29:00.000Z'); // NST, UTC-3:30
    expect(iso(endOfDayInZone('2026-07-15', 'America/St_Johns'))).toBe('2026-07-16T02:29:00.000Z'); // NDT, UTC-2:30
  });

  it('keeps America/Regina at UTC-6 all year (no daylight saving)', () => {
    expect(iso(endOfDayInZone('2026-01-15', 'America/Regina'))).toBe('2026-01-16T05:59:00.000Z');
    expect(iso(endOfDayInZone('2026-07-15', 'America/Regina'))).toBe('2026-07-16T05:59:00.000Z');
    expect(iso(endOfDayInZone('2026-03-08', 'America/Regina'))).toBe('2026-03-09T05:59:00.000Z');
  });

  it('is 23:59Z in UTC', () => {
    expect(iso(endOfDayInZone('2026-03-04', 'UTC'))).toBe('2026-03-04T23:59:00.000Z');
  });

  it('accepts 29 February only in a leap year', () => {
    expect(iso(endOfDayInZone('2028-02-29', 'UTC'))).toBe('2028-02-29T23:59:00.000Z');
    expect(() => endOfDayInZone('2026-02-29', TORONTO)).toThrow(RangeError);
  });

  it('rejects a day that does not exist, text that is not a bare day, and an unknown zone', () => {
    expect(() => endOfDayInZone('2026-02-30', TORONTO)).toThrow(RangeError);
    expect(() => endOfDayInZone('2026-13-01', TORONTO)).toThrow(RangeError);
    expect(() => endOfDayInZone('2026-3-4', TORONTO)).toThrow(RangeError);
    expect(() => endOfDayInZone('2026-03-04T00:00:00.000Z', TORONTO)).toThrow(RangeError);
    expect(() => endOfDayInZone('2026-03-04', 'Mars/Olympus_Mons')).toThrow(RangeError);
    expect(() => endOfDayInZone('2026-03-04', '')).toThrow(RangeError);
  });
});

describe('isCalendarDay', () => {
  it('is true only for an existing bare day', () => {
    expect(isCalendarDay('2026-03-04')).toBe(true);
    expect(isCalendarDay('2026-02-30')).toBe(false);
    expect(isCalendarDay('2026-03-04T12:00:00Z')).toBe(false);
    expect(isCalendarDay(new Date())).toBe(false);
    expect(isCalendarDay(null)).toBe(false);
  });
});

describe('calendarDayInZone / addCalendarDays / dueAtEndOfDayAfter', () => {
  it('reads the day an instant falls on in the zone, not in UTC', () => {
    const lateEveningInToronto = new Date('2026-03-04T03:00:00.000Z'); // 22:00 EST on 3 March
    expect(calendarDayInZone(lateEveningInToronto, TORONTO)).toBe('2026-03-03');
    expect(calendarDayInZone(lateEveningInToronto, 'UTC')).toBe('2026-03-04');
  });

  it('adds calendar days across month and year ends', () => {
    expect(addCalendarDays('2026-01-25', 10)).toBe('2026-02-04');
    expect(addCalendarDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(() => addCalendarDays('2026-03-01', 1.5)).toThrow(RangeError);
  });

  it('counts "within N days" from the event day in the organization zone and falls due at 23:59 that day', () => {
    const filedLateEvening = new Date('2026-03-04T03:00:00.000Z'); // 3 March in Toronto
    // 3 March + 10 days = 13 March, after the spring-forward change: 23:59 EDT.
    expect(iso(dueAtEndOfDayAfter(filedLateEvening, 10, TORONTO))).toBe('2026-03-14T03:59:00.000Z');
    // The same moment counted in UTC lands a day later.
    expect(iso(dueAtEndOfDayAfter(filedLateEvening, 10, 'UTC'))).toBe('2026-03-14T23:59:00.000Z');
  });
});

describe('shiftByCalendarDaysInZone', () => {
  it('keeps the local time of day across a daylight-saving change', () => {
    const dueSpringForwardDay = endOfDayInZone('2026-03-08', TORONTO);
    // Three days before is 23:59 EST on 5 March, not 22:59 (which 72 hours of arithmetic would give).
    expect(iso(shiftByCalendarDaysInZone(dueSpringForwardDay, -3, TORONTO))).toBe('2026-03-06T04:59:00.000Z');
    const dueAfterFallBack = endOfDayInZone('2026-11-03', TORONTO);
    expect(iso(shiftByCalendarDaysInZone(dueAfterFallBack, -7, TORONTO))).toBe('2026-10-28T03:59:00.000Z');
  });

  it('is plain 24-hour arithmetic in UTC and the identity for zero days', () => {
    const due = new Date('2026-03-08T12:34:56.789Z');
    expect(iso(shiftByCalendarDaysInZone(due, -3, 'UTC'))).toBe('2026-03-05T12:34:56.789Z');
    expect(iso(shiftByCalendarDaysInZone(due, 0, TORONTO))).toBe(iso(due));
  });

  it('reads a skipped wall time forward and a repeated one as the earlier instant', () => {
    // 02:30 EST on 7 March + 1 day: 02:30 on 8 March does not exist in Toronto; it reads as 03:30 EDT.
    expect(iso(shiftByCalendarDaysInZone(new Date('2026-03-07T07:30:00.000Z'), 1, TORONTO))).toBe('2026-03-08T07:30:00.000Z');
    // 01:30 EDT on 31 October + 1 day: 01:30 on 1 November occurs twice; the first (EDT) is taken.
    expect(iso(shiftByCalendarDaysInZone(new Date('2026-10-31T05:30:00.000Z'), 1, TORONTO))).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('organization time zone', () => {
  it('maps every province and territory code to the zone the owner named', () => {
    expect(PROVINCE_TIME_ZONES).toEqual({
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
    });
  });

  it('reads a province by code or by English or French name, whatever the case and accents', () => {
    expect(zoneForProvince('qc')).toBe('America/Toronto');
    expect(zoneForProvince('Québec')).toBe('America/Toronto');
    expect(zoneForProvince('British Columbia')).toBe('America/Vancouver');
    expect(zoneForProvince('Terre-Neuve-et-Labrador')).toBe('America/St_Johns');
    expect(zoneForProvince(' sk ')).toBe('America/Regina');
    expect(zoneForProvince('federal')).toBeUndefined();
    expect(zoneForProvince('')).toBeUndefined();
    expect(zoneForProvince(null)).toBeUndefined();
  });

  it('prefers the explicit settings.timezone, then province_territory, then the address province, then the default', () => {
    expect(organizationTimeZone({ settings: { timezone: 'America/Winnipeg' }, provinceTerritory: 'BC' })).toEqual({ timeZone: 'America/Winnipeg', source: 'settings' });
    expect(organizationTimeZone({ settings: { timezone: 'UTC' }, provinceTerritory: 'BC' })).toEqual({ timeZone: 'UTC', source: 'settings' });
    expect(organizationTimeZone({ settings: { timezone: 'Not/AZone' }, provinceTerritory: 'BC' })).toEqual({ timeZone: 'America/Vancouver', source: 'province_territory' });
    expect(organizationTimeZone({ settings: {}, provinceTerritory: 'federal', address: { province: 'NL' } })).toEqual({ timeZone: 'America/St_Johns', source: 'address_province' });
    expect(organizationTimeZone({ settings: { timezone: 42 }, provinceTerritory: null, address: null })).toEqual({ timeZone: DEFAULT_ORGANIZATION_TIME_ZONE, source: 'default' });
    expect(organizationTimeZone(null)).toEqual({ timeZone: 'America/Toronto', source: 'default' });
  });
});

describe('dayFieldsAtEndOfDay', () => {
  it('turns only bare existing days in the named fields into 23:59 in the zone', () => {
    const instant = new Date('2026-03-04T15:00:00.000Z');
    const shaped = dayFieldsAtEndOfDay(
      { dueDate: '2026-03-04', originalDeadline: '2026-03-04T15:00:00Z', eventDate: '2026-03-01', other: instant, bad: '2026-02-30' },
      ['dueDate', 'originalDeadline', 'other', 'bad'],
      TORONTO,
    );
    expect(shaped.dueDate).toEqual(new Date('2026-03-05T04:59:00.000Z'));
    expect(shaped.originalDeadline).toBe('2026-03-04T15:00:00Z');
    expect(shaped.eventDate).toBe('2026-03-01'); // not a named field
    expect(shaped.other).toBe(instant);
    expect(shaped.bad).toBe('2026-02-30'); // left for the write path to refuse with a 400
  });

  it('reports whether any named field holds a day', () => {
    expect(hasDayField({ dueDate: '2026-03-04' }, ['dueDate'])).toBe(true);
    expect(hasDayField({ dueDate: '2026-03-04T00:00:00Z', eventDate: '2026-03-04' }, ['dueDate'])).toBe(false);
  });
});
