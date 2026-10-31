import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('S3 room booking (platform 0041, cache 0035)', () => {
  it('serves bookings from the booking service instead of answering 501', () => {
    const route = read('app/api/meeting-rooms/[id]/bookings/route.ts')
    expect(route).not.toContain('notImplemented')
    expect(route).toContain('createRoomBooking')
    expect(route).toContain('listRoomBookings')
    expect(route).toContain('isOverlapViolation(error)')
    expect(route).toContain("auth: { required: true, minRole: 'member' }")
  })

  it('cancels (never deletes) and lets only staff other than the booker decide', () => {
    const item = read('app/api/meeting-rooms/[id]/bookings/[bookingId]/route.ts')
    expect(item).toContain("auth: { required: true, minRole: 'steward' }")
    expect(item).toContain('cancelRoomBooking')
    expect(item).toContain('decideRoomBooking')
    const service = read('lib/services/room-booking-service.ts')
    expect(service).toContain("A booking is approved by someone other than the person who made it")
    expect(service).not.toContain('.delete(roomBookings)')
  })

  it('scopes every booking read and write to the caller organization', () => {
    const service = read('lib/services/room-booking-service.ts')
    expect(service.match(/eq\(roomBookings\.organizationId, (caller\.)?organizationId\)/g)?.length).toBeGreaterThanOrEqual(4)
    expect(service).toContain('eq(meetingRooms.organizationId, organizationId)')
  })

  it('classifies room_bookings as a tenant table with SELECT, INSERT and UPDATE for the runtime role only', () => {
    const manifest = read('db/rls-storage-authority/reference-latent.ts')
    const start = manifest.indexOf('table: "room_bookings"')
    const block = manifest.slice(start, manifest.indexOf('reviewPriority', start))
    expect(block).toContain('classification: "TENANT_RLS_REQUIRED"')
    expect(block).toContain('requiredRuntimePrivileges: ["SELECT","INSERT","UPDATE"]')
    expect(block).toContain('invocationAuthority: "TENANT_USER"')
    expect(read('db/migrations-cache/0035_room_bookings_rls_closure.sql')).toContain("ue_create_direct_org_rls_policy('room_bookings')")
  })

  it('no longer carries calendar-service placeholders that reported a booking or a cancellation without storing one', () => {
    const calendar = read('lib/services/calendar-service.ts')
    expect(calendar).not.toContain('booking-${Date.now()}')
    expect(calendar).not.toContain('export async function checkRoomAvailability')
    expect(calendar).not.toContain('export async function bookMeetingRoom')
    expect(calendar).not.toContain('export async function cancelRoomBooking')
  })
})
