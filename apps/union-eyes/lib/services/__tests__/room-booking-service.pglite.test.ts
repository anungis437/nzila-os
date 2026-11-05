import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { meetingRooms, roomBookings } from '@/db/schema/domains/scheduling/calendar'
import { createTableDatabase } from '@/app/api/__tests__/support/pglite-tables'

// DEF-0B9-MOB-MEETING-ROOM-BOOKING-RULES...: the booking rules, the double-booking trigger of platform migration 0041 and the
// approval/cancel authority, against real SQL.

const audit = vi.hoisted(() => ({ entries: [] as Array<{ action: string; resourceId?: string }> }))
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (_tx: unknown, entry: { action: string; resourceId?: string }) => {
    audit.entries.push(entry)
  },
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import {
  cancelRoomBooking,
  createRoomBooking,
  decideRoomBooking,
  isOverlapViolation,
  listRoomBookings,
} from '../room-booking-service'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = '22222222-2222-4222-8222-222222222222'
const ROOM = '33333333-3333-4333-8333-333333333333'
const APPROVAL_ROOM = '44444444-4444-4444-8444-444444444444'
const NOW = new Date('2026-11-02T12:00:00Z')
const at = (hour: number, minutes = 0, day = 3) => new Date(Date.UTC(2026, 10, day, hour, minutes))

let pg: PGlite
let db: any
const member = { organizationId: ORG, userId: 'member-1', role: 'member' }
const other = { organizationId: ORG, userId: 'member-2', role: 'member' }
const steward = { organizationId: ORG, userId: 'steward-1', role: 'steward' }
const staff = (caller: typeof steward) => ({ ...caller, isStaff: true })
const lay = (caller: typeof member) => ({ ...caller, isStaff: false })

const book = (caller: typeof member, room: string, start: Date, end: Date, extra: Record<string, unknown> = {}) =>
  createRoomBooking(db, caller, room, { startTime: start, endTime: end, purpose: 'Stewards meeting', ...extra }, NOW)

beforeAll(async () => {
  const created = await createTableDatabase([meetingRooms, roomBookings])
  pg = created.pg
  db = created.db
  const migration = readFileSync(join(process.cwd(), 'db/migrations-platform/0041_room_bookings_shape.sql'), 'utf8')
  for (const statement of migration.split('--> statement-breakpoint')) {
    if (statement.trim() && !statement.trim().split('\n').every((l) => l.startsWith('--'))) await pg.exec(statement)
  }
})
afterAll(async () => {
  await pg.close()
})
beforeEach(async () => {
  audit.entries.length = 0
  await pg.exec('TRUNCATE room_bookings, meeting_rooms')
  await pg.query(
    `INSERT INTO meeting_rooms (id, organization_id, name, capacity, status, is_active, requires_approval, min_booking_duration, max_booking_duration, advance_booking_days, allowed_user_roles)
     VALUES ($1::uuid, $2::uuid, 'Boardroom', 12, 'available', true, false, 30, 480, 90, NULL),
            ($3::uuid, $2::uuid, 'Hall', 100, 'available', true, true, 30, 480, 90, NULL),
            (gen_random_uuid(), $4::uuid, 'Other org room', 5, 'available', true, false, 30, 480, 90, NULL)`,
    [ROOM, ORG, APPROVAL_ROOM, OTHER_ORG],
  )
})

describe('room booking service', () => {
  it('stores a confirmed booking under the caller\'s organization and audits it', async () => {
    const booking = await book(member, ROOM, at(14), at(15), { attendeeCount: 6 })
    expect(booking).toMatchObject({ organizationId: ORG, bookedBy: 'member-1', status: 'confirmed', requiresApproval: false, attendeeCount: 6 })
    expect(audit.entries.map((e) => e.action)).toEqual(['room.booking.create'])
  })

  it('applies the room\'s own rules', async () => {
    await expect(book(member, ROOM, at(14), at(14, 10))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await expect(book(member, ROOM, at(14), at(15), { attendeeCount: 50 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await expect(book(member, ROOM, new Date('2026-11-01T10:00:00Z'), new Date('2026-11-01T11:00:00Z'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await pg.query(`UPDATE meeting_rooms SET allowed_user_roles = '["steward"]'::jsonb WHERE id = $1::uuid`, [ROOM])
    await expect(book(member, ROOM, at(14), at(15))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await pg.query('SELECT 1 FROM room_bookings')).rows).toHaveLength(0)
  })

  it('does not find a room of another organization', async () => {
    const [foreign] = (await pg.query<{ id: string }>(`SELECT id FROM meeting_rooms WHERE organization_id = $1::uuid`, [OTHER_ORG])).rows
    await expect(book(member, foreign.id, at(14), at(15))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('refuses an overlapping booking in the database and allows an adjacent one', async () => {
    await book(member, ROOM, at(14), at(15))
    const overlap = await book(other, ROOM, at(14, 30), at(15, 30)).then(() => null, (e) => e)
    expect(isOverlapViolation(overlap)).toBe(true)
    await book(other, ROOM, at(15), at(16))
    await book(other, ROOM, at(14), at(15), {}).then(() => { throw new Error('expected overlap') }, (e) => expect(isOverlapViolation(e)).toBe(true))
    const rows = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM room_bookings')
    expect(rows.rows[0].n).toBe(2)
  })

  it('holds the slot of a room that needs approval until a second person confirms it, and never lets the booker approve', async () => {
    const booking = await book(member, APPROVAL_ROOM, at(10), at(11))
    expect(booking).toMatchObject({ status: 'scheduled', requiresApproval: true })
    await expect(decideRoomBooking(db, { ...member }, APPROVAL_ROOM, booking.id, 'approve', null)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const approved = await decideRoomBooking(db, steward, APPROVAL_ROOM, booking.id, 'approve', 'ok')
    expect(approved).toMatchObject({ status: 'confirmed', approvedBy: 'steward-1' })
    await expect(decideRoomBooking(db, steward, APPROVAL_ROOM, booking.id, 'approve', null)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('declining frees the slot', async () => {
    const booking = await book(member, APPROVAL_ROOM, at(10), at(11))
    await decideRoomBooking(db, steward, APPROVAL_ROOM, booking.id, 'decline', 'no')
    await book(other, APPROVAL_ROOM, at(10), at(11))
  })

  it('lets the booker or staff cancel, never another member, and frees the slot', async () => {
    const booking = await book(member, ROOM, at(14), at(15))
    await expect(cancelRoomBooking(db, lay(other), ROOM, booking.id, null)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await cancelRoomBooking(db, lay(member), ROOM, booking.id, 'changed plans')).toMatchObject({ status: 'cancelled', cancelledBy: 'member-1' })
    await expect(cancelRoomBooking(db, staff(steward), ROOM, booking.id, null)).rejects.toMatchObject({ code: 'CONFLICT' })
    await book(other, ROOM, at(14), at(15))
    const rows = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM room_bookings')
    expect(rows.rows[0].n).toBe(2)
  })

  it('lists slots to everyone, with details only for the caller\'s own bookings unless staff', async () => {
    await book(member, ROOM, at(14), at(15))
    await book(other, ROOM, at(16), at(17))
    const seenByMember = await listRoomBookings(db, lay(member), ROOM, { limit: 50 })
    expect(seenByMember).toHaveLength(2)
    const mine = seenByMember.find((s) => s.mine)
    const theirs = seenByMember.find((s) => !s.mine)
    expect(mine).toHaveProperty('purpose')
    expect(theirs).not.toHaveProperty('purpose')
    expect(theirs).not.toHaveProperty('bookedBy')
    const seenByStaff = await listRoomBookings(db, staff(steward), ROOM, { limit: 50 })
    expect(seenByStaff.every((s) => 'purpose' in s)).toBe(true)
  })

  it('answers a window and leaves out cancelled bookings', async () => {
    const one = await book(member, ROOM, at(14), at(15))
    await book(member, ROOM, at(10, 0, 4), at(11, 0, 4))
    await cancelRoomBooking(db, lay(member), ROOM, one.id, null)
    const day3 = await listRoomBookings(db, lay(member), ROOM, { from: at(0), to: at(23, 59), limit: 50 })
    expect(day3).toHaveLength(0)
    const all = await listRoomBookings(db, lay(member), ROOM, { limit: 50 })
    expect(all).toHaveLength(1)
  })
})
