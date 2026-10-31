/**
 * Room booking: the one place a booking is accepted, listed, approved, declined or cancelled. Every rule of the room itself
 * (hours, blocked dates, duration, how far ahead, who may book, capacity, approval) is applied by evaluateBooking; the
 * database settles two requests for the same slot (a trigger that locks the room row, platform migration 0041).
 */
import { and, asc, eq, gt, lt, ne } from 'drizzle-orm'
import { ApiError } from '@/lib/api/errors'
import { meetingRooms, roomBookings } from '@/db/schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { evaluateBooking, type BookingRefusal, type RoomRules } from '@/lib/services/room-booking-rules'

export interface BookingInput {
  startTime: Date
  endTime: Date
  purpose: string
  attendeeCount?: number | null
  specialRequests?: string | null
  cateringRequired?: boolean
  cateringNotes?: string | null
}

export interface BookingCaller {
  organizationId: string
  userId: string
  role: string | null | undefined
}

const REFUSAL_STATUS: Record<BookingRefusal, 'forbidden' | 'conflict' | 'badRequest'> = {
  ROOM_UNAVAILABLE: 'conflict',
  ROLE_NOT_ALLOWED: 'forbidden',
  INVALID_TIME_RANGE: 'badRequest',
  IN_THE_PAST: 'badRequest',
  TOO_SHORT: 'badRequest',
  TOO_LONG: 'badRequest',
  TOO_FAR_AHEAD: 'badRequest',
  BLOCKED_DATE: 'badRequest',
  OUTSIDE_OPERATING_HOURS: 'badRequest',
  OVER_CAPACITY: 'badRequest',
}

/** The database refused the booking as overlapping (SQLSTATE 23P01, raised by the room trigger). */
export function isOverlapViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string }; message?: string } | null | undefined
  return candidate?.code === '23P01' || candidate?.cause?.code === '23P01' || /room is already booked/i.test(String(candidate?.message ?? ''))
}

export const overlapConflict = () => ApiError.conflict('The room is already booked for that time')

async function loadRoom(tx: RLSTx, organizationId: string, roomId: string) {
  const [room] = await tx.select().from(meetingRooms).where(and(eq(meetingRooms.id, roomId), eq(meetingRooms.organizationId, organizationId))).limit(1)
  if (!room) throw ApiError.notFound('Room')
  return room
}

const rulesOf = (room: typeof meetingRooms.$inferSelect): RoomRules => ({
  isActive: room.isActive,
  status: room.status,
  capacity: room.capacity,
  requiresApproval: room.requiresApproval,
  minBookingDuration: room.minBookingDuration,
  maxBookingDuration: room.maxBookingDuration,
  advanceBookingDays: room.advanceBookingDays,
  operatingHours: room.operatingHours,
  allowedUserRoles: room.allowedUserRoles,
  blockedDates: room.blockedDates,
})

export async function createRoomBooking(tx: RLSTx, caller: BookingCaller, roomId: string, input: BookingInput, now = new Date()) {
  const room = await loadRoom(tx, caller.organizationId, roomId)
  const decision = evaluateBooking(rulesOf(room), input, caller.role, now)
  if (!decision.ok) throw ApiError[REFUSAL_STATUS[decision.code]](decision.message)

  const [booking] = await tx
    .insert(roomBookings)
    .values({
      roomId: room.id,
      organizationId: caller.organizationId,
      bookedBy: caller.userId,
      purpose: input.purpose,
      startTime: input.startTime,
      endTime: input.endTime,
      attendeeCount: input.attendeeCount ?? null,
      specialRequests: input.specialRequests ?? null,
      cateringRequired: input.cateringRequired === true,
      cateringNotes: input.cateringNotes ?? null,
      requiresApproval: decision.requiresApproval,
      // A room that needs approval holds the slot as scheduled until a second person confirms it.
      status: decision.requiresApproval ? 'scheduled' : 'confirmed',
    })
    .returning()

  await persistAtomicAudit(tx, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    action: 'room.booking.create',
    resourceType: 'room_bookings',
    resourceId: booking.id,
    details: { roomId: room.id, startTime: input.startTime.toISOString(), endTime: input.endTime.toISOString(), requiresApproval: decision.requiresApproval },
  })
  return booking
}

export interface ListWindow {
  from?: Date
  to?: Date
  limit: number
}

/** Staff see every booking of the room; anyone else sees the slots, and the details only of their own bookings. */
export async function listRoomBookings(tx: RLSTx, caller: BookingCaller & { isStaff: boolean }, roomId: string, window: ListWindow) {
  await loadRoom(tx, caller.organizationId, roomId)
  const conditions = [eq(roomBookings.roomId, roomId), eq(roomBookings.organizationId, caller.organizationId), ne(roomBookings.status, 'cancelled')]
  if (window.from) conditions.push(gt(roomBookings.endTime, window.from))
  if (window.to) conditions.push(lt(roomBookings.startTime, window.to))
  const rows = await tx.select().from(roomBookings).where(and(...conditions)).orderBy(asc(roomBookings.startTime)).limit(window.limit)
  return rows.map((row) => {
    const visible = caller.isStaff || row.bookedBy === caller.userId
    return {
      id: row.id,
      roomId: row.roomId,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      mine: row.bookedBy === caller.userId,
      ...(visible ? { bookedBy: row.bookedBy, purpose: row.purpose, attendeeCount: row.attendeeCount, requiresApproval: row.requiresApproval } : {}),
    }
  })
}

async function loadBooking(tx: RLSTx, organizationId: string, roomId: string, bookingId: string) {
  const [booking] = await tx
    .select()
    .from(roomBookings)
    .where(and(eq(roomBookings.id, bookingId), eq(roomBookings.roomId, roomId), eq(roomBookings.organizationId, organizationId)))
    .limit(1)
    .for('update')
  if (!booking) throw ApiError.notFound('Booking')
  return booking
}

export async function cancelRoomBooking(tx: RLSTx, caller: BookingCaller & { isStaff: boolean }, roomId: string, bookingId: string, reason: string | null) {
  const booking = await loadBooking(tx, caller.organizationId, roomId, bookingId)
  if (booking.bookedBy !== caller.userId && !caller.isStaff) throw ApiError.notFound('Booking')
  if (booking.status === 'cancelled' || booking.status === 'completed') throw ApiError.conflict('This booking can no longer be cancelled')
  const [updated] = await tx
    .update(roomBookings)
    .set({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: caller.userId, cancellationReason: reason, updatedAt: new Date() })
    .where(and(eq(roomBookings.id, bookingId), eq(roomBookings.organizationId, caller.organizationId)))
    .returning()
  await persistAtomicAudit(tx, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    action: 'room.booking.cancel',
    resourceType: 'room_bookings',
    resourceId: bookingId,
    details: { roomId },
  })
  return updated
}

export async function decideRoomBooking(
  tx: RLSTx,
  caller: BookingCaller,
  roomId: string,
  bookingId: string,
  decision: 'approve' | 'decline',
  notes: string | null,
) {
  const booking = await loadBooking(tx, caller.organizationId, roomId, bookingId)
  if (!booking.requiresApproval || booking.status !== 'scheduled') throw ApiError.conflict('This booking is not waiting for approval')
  // Nobody approves their own booking.
  if (booking.bookedBy === caller.userId) throw ApiError.forbidden('A booking is approved by someone other than the person who made it')
  const now = new Date()
  const [updated] = await tx
    .update(roomBookings)
    .set(
      decision === 'approve'
        ? { status: 'confirmed', approvedBy: caller.userId, approvedAt: now, approvalNotes: notes, updatedAt: now }
        : { status: 'cancelled', cancelledAt: now, cancelledBy: caller.userId, cancellationReason: notes ?? 'Declined', approvalNotes: notes, updatedAt: now },
    )
    .where(and(eq(roomBookings.id, bookingId), eq(roomBookings.organizationId, caller.organizationId)))
    .returning()
  await persistAtomicAudit(tx, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    action: decision === 'approve' ? 'room.booking.approve' : 'room.booking.decline',
    resourceType: 'room_bookings',
    resourceId: bookingId,
    details: { roomId },
  })
  return updated
}
