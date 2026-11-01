/**
 * Meeting room booking rules.
 *
 * A room stores its rules (active state, hours, blocked dates, minimum and maximum duration, how far ahead a booking may be
 * made, who may book, capacity and whether approval is needed). Nothing enforced them: the route that claimed to take bookings
 * edited the room row, and the only booking code answered "available" for every request. This is the single place the rules
 * are applied, so a booking is accepted only when the room's own configuration allows it.
 *
 * Times are evaluated in UTC: the room has no time zone column, so operating hours and blocked dates are read as UTC.
 */
export interface RoomRules {
  isActive: boolean | null
  status: string | null
  capacity: number | null
  requiresApproval: boolean | null
  minBookingDuration: number | null
  maxBookingDuration: number | null
  advanceBookingDays: number | null
  operatingHours: Record<string, { start: string; end: string; closed?: boolean }> | null
  allowedUserRoles: string[] | null
  blockedDates: string[] | null
}

export interface BookingRequest {
  startTime: Date
  endTime: Date
  attendeeCount?: number | null
}

export type BookingDecision =
  | { ok: true; requiresApproval: boolean }
  | { ok: false; code: BookingRefusal; message: string }

export type BookingRefusal =
  | 'ROOM_UNAVAILABLE'
  | 'INVALID_TIME_RANGE'
  | 'IN_THE_PAST'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'TOO_FAR_AHEAD'
  | 'BLOCKED_DATE'
  | 'OUTSIDE_OPERATING_HOURS'
  | 'ROLE_NOT_ALLOWED'
  | 'OVER_CAPACITY'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MS_MINUTE = 60_000
const MS_DAY = 86_400_000

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const minutesOfDay = (date: Date) => date.getUTCHours() * 60 + date.getUTCMinutes()

function parseClock(value: string): number | null {
  // "24:00" is accepted as the end of the day.
  if (value === '24:00') return 24 * 60
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const refuse = (code: BookingRefusal, message: string): BookingDecision => ({ ok: false, code, message })

export function evaluateBooking(room: RoomRules, request: BookingRequest, callerRole: string | null | undefined, now: Date): BookingDecision {
  const { startTime, endTime } = request
  if (room.isActive === false || room.status === 'maintenance') return refuse('ROOM_UNAVAILABLE', 'This room is not available for booking')
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
    return refuse('INVALID_TIME_RANGE', 'The booking must end after it starts')
  }
  if (startTime < now) return refuse('IN_THE_PAST', 'A booking cannot start in the past')

  const minutes = (endTime.getTime() - startTime.getTime()) / MS_MINUTE
  if (room.minBookingDuration != null && minutes < room.minBookingDuration) {
    return refuse('TOO_SHORT', `The shortest booking is ${room.minBookingDuration} minutes`)
  }
  if (room.maxBookingDuration != null && minutes > room.maxBookingDuration) {
    return refuse('TOO_LONG', `The longest booking is ${room.maxBookingDuration} minutes`)
  }
  if (room.advanceBookingDays != null && startTime.getTime() - now.getTime() > room.advanceBookingDays * MS_DAY) {
    return refuse('TOO_FAR_AHEAD', `A booking can be made at most ${room.advanceBookingDays} days ahead`)
  }

  const blocked = new Set(room.blockedDates ?? [])
  // A booking that ends exactly at midnight does not occupy the next day.
  const lastInstant = new Date(endTime.getTime() - 1)
  for (let day = isoDay(startTime); day <= isoDay(lastInstant); day = isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + MS_DAY))) {
    if (blocked.has(day)) return refuse('BLOCKED_DATE', `The room is not available on ${day}`)
  }

  const hours = room.operatingHours
  if (hours && Object.keys(hours).length > 0) {
    // A booking must sit inside one day's hours; a day the room does not list is closed.
    if (isoDay(startTime) !== isoDay(lastInstant)) return refuse('OUTSIDE_OPERATING_HOURS', 'A booking must fall within one day of operating hours')
    const entry = hours[DAYS[startTime.getUTCDay()]]
    const open = entry && !entry.closed ? parseClock(entry.start) : null
    const close = entry && !entry.closed ? parseClock(entry.end) : null
    const endMinute = minutesOfDay(endTime) === 0 ? 24 * 60 : minutesOfDay(endTime)
    if (open === null || close === null || minutesOfDay(startTime) < open || endMinute > close) {
      return refuse('OUTSIDE_OPERATING_HOURS', 'The room is closed at that time')
    }
  }

  const allowed = (room.allowedUserRoles ?? []).map((role) => role.toLowerCase())
  if (allowed.length > 0 && !allowed.includes((callerRole ?? '').toLowerCase())) {
    return refuse('ROLE_NOT_ALLOWED', 'Your role may not book this room')
  }
  if (room.capacity != null && request.attendeeCount != null && request.attendeeCount > room.capacity) {
    return refuse('OVER_CAPACITY', `The room holds at most ${room.capacity} people`)
  }
  return { ok: true, requiresApproval: room.requiresApproval === true }
}
