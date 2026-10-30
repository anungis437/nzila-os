import { describe, expect, it } from 'vitest';
import { evaluateBooking, type RoomRules } from '../room-booking-rules';

// Gate 0 DEF-0B9-MOB-MEETING-ROOM-BOOKING-RULES-ARE-STORED-BUT-NO-ROUTE-OR-SERVICE-ENFORCES-A-BOOKING
const NOW = new Date('2026-11-02T12:00:00Z'); // a Monday
const room = (over: Partial<RoomRules> = {}): RoomRules => ({
  isActive: true,
  status: 'available',
  capacity: 10,
  requiresApproval: false,
  minBookingDuration: 30,
  maxBookingDuration: 240,
  advanceBookingDays: 30,
  operatingHours: { monday: { start: '08:00', end: '18:00' }, tuesday: { start: '08:00', end: '18:00' }, sunday: { start: '00:00', end: '00:00', closed: true } },
  allowedUserRoles: null,
  blockedDates: null,
  ...over,
});
const at = (day: string, from: string, to: string, attendeeCount?: number) => ({ startTime: new Date(`${day}T${from}:00Z`), endTime: new Date(`${day}T${to}:00Z`), attendeeCount });
const refusal = (decision: ReturnType<typeof evaluateBooking>) => (decision.ok ? null : decision.code);

describe('meeting room booking rules', () => {
  it('accepts a booking that satisfies every rule', () => {
    expect(evaluateBooking(room(), at('2026-11-03', '09:00', '10:00'), 'member', NOW)).toEqual({ ok: true, requiresApproval: false });
  });

  it('carries the approval requirement instead of confirming', () => {
    expect(evaluateBooking(room({ requiresApproval: true }), at('2026-11-03', '09:00', '10:00'), 'member', NOW)).toEqual({ ok: true, requiresApproval: true });
  });

  it.each([
    ['an inactive room', room({ isActive: false }), at('2026-11-03', '09:00', '10:00'), 'ROOM_UNAVAILABLE'],
    ['a room in maintenance', room({ status: 'maintenance' }), at('2026-11-03', '09:00', '10:00'), 'ROOM_UNAVAILABLE'],
    ['an end before the start', room(), at('2026-11-03', '10:00', '09:00'), 'INVALID_TIME_RANGE'],
    ['a start in the past', room(), at('2026-11-02', '09:00', '10:00'), 'IN_THE_PAST'],
    ['a booking under the minimum', room(), at('2026-11-03', '09:00', '09:15'), 'TOO_SHORT'],
    ['a booking over the maximum', room(), at('2026-11-03', '09:00', '14:00'), 'TOO_LONG'],
    ['a booking beyond the advance window', room({ advanceBookingDays: 3 }), at('2026-11-10', '09:00', '10:00'), 'TOO_FAR_AHEAD'],
    ['a blocked date', room({ blockedDates: ['2026-11-03'] }), at('2026-11-03', '09:00', '10:00'), 'BLOCKED_DATE'],
    ['a time before opening', room(), at('2026-11-03', '07:00', '08:30'), 'OUTSIDE_OPERATING_HOURS'],
    ['a time after closing', room(), at('2026-11-03', '17:30', '18:30'), 'OUTSIDE_OPERATING_HOURS'],
    ['a closed day', room(), at('2026-11-08', '09:00', '10:00'), 'OUTSIDE_OPERATING_HOURS'],
    ['a day the room does not list', room(), at('2026-11-04', '09:00', '10:00'), 'OUTSIDE_OPERATING_HOURS'],
    ['more people than the capacity', room({ capacity: 4 }), at('2026-11-03', '09:00', '10:00', 5), 'OVER_CAPACITY'],
  ])('refuses %s', (_name, rules, request, code) => {
    expect(refusal(evaluateBooking(rules, request, 'member', NOW))).toBe(code);
  });

  it('refuses a booking that crosses midnight when the room declares hours', () => {
    const request = { startTime: new Date('2026-11-03T17:00:00Z'), endTime: new Date('2026-11-04T09:00:00Z') };
    expect(refusal(evaluateBooking(room({ maxBookingDuration: 1440 }), request, 'member', NOW))).toBe('OUTSIDE_OPERATING_HOURS');
  });

  it('enforces the allowed roles, case-insensitively, and refuses a caller with no role', () => {
    const rules = room({ allowedUserRoles: ['Steward', 'officer'] });
    const request = at('2026-11-03', '09:00', '10:00');
    expect(evaluateBooking(rules, request, 'STEWARD', NOW).ok).toBe(true);
    expect(refusal(evaluateBooking(rules, request, 'member', NOW))).toBe('ROLE_NOT_ALLOWED');
    expect(refusal(evaluateBooking(rules, request, null, NOW))).toBe('ROLE_NOT_ALLOWED');
  });

  it('treats a room with no hours, roles or blocked dates as open, but still applies durations', () => {
    const open = room({ operatingHours: null, allowedUserRoles: [], blockedDates: [] });
    expect(evaluateBooking(open, at('2026-11-03', '03:00', '04:00'), 'member', NOW).ok).toBe(true);
    expect(refusal(evaluateBooking(open, at('2026-11-03', '03:00', '03:10'), 'member', NOW))).toBe('TOO_SHORT');
  });

  it('lets a booking end exactly at closing time and exactly at midnight when the room is open until then', () => {
    expect(evaluateBooking(room(), at('2026-11-03', '17:00', '18:00'), 'member', NOW).ok).toBe(true);
    const late = room({ operatingHours: { tuesday: { start: '08:00', end: '24:00' } } });
    expect(evaluateBooking(late, { startTime: new Date('2026-11-03T22:00:00Z'), endTime: new Date('2026-11-04T00:00:00Z') }, 'member', NOW)).toEqual({ ok: true, requiresApproval: false });
  });
});
