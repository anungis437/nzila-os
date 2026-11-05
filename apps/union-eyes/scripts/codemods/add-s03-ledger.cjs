const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S03-ROOM-BOOKING-MIGRATIONS-0041-AND-0035'
const known = (start) => {
  for (const b of ledger.batches) for (const i of b.items) if (i.prefix.startsWith(start)) return i.prefix
  throw new Error('no earlier item ' + start)
}
if (!ledger.batches.some((x) => x.id === id)) {
  const common = [
    A + 'db/migrations-platform/0041_room_bookings_shape.sql', A + 'db/migrations-platform/0041_room_bookings_shape.rollback.sql',
    A + 'db/migrations-cache/0035_room_bookings_rls_closure.sql', A + 'db/migrations-cache/0035_room_bookings_rls_closure.rollback.sql',
    A + 'db/rls-storage-authority/reference-latent.ts',
    A + 'lib/services/room-booking-service.ts', A + 'lib/services/room-booking-rules.ts',
    A + 'app/api/meeting-rooms/[id]/bookings/route.ts', A + 'app/api/meeting-rooms/[id]/bookings/[bookingId]/route.ts',
    A + 'lib/services/__tests__/room-booking-service.pglite.test.ts', A + 'lib/services/__tests__/s3-room-booking.test.ts',
  ]
  const item = (start, explanation) => ({ prefix: known(start), status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: common, explanation })
  ledger.batches.push({
    id,
    family: 'Room booking: the booking store, its tenant isolation and the route that enforces the room\'s own rules',
    evidenceCommit: null,
    items: [
      item('DEF-0B9-MOB-MEETING-ROOM-BOOKING-RULES-ARE-STORED-BUT-NO-ROUTE',
        'Platform 0041 evolves the room_bookings stub to its 26 missing declared columns, cache 0035 forces row-level security by organization, and the manifest reclassifies the table from LATENT_UNREACHABLE to TENANT_RLS_REQUIRED with SELECT, INSERT and UPDATE only. POST /api/meeting-rooms/[id]/bookings now accepts a booking only when evaluateBooking allows it (hours, blocked dates, duration, how far ahead, who may book, capacity, approval); a room needing approval holds the slot as scheduled until staff other than the booker confirm it. Proved against real SQL on PGlite, including the room-locking trigger. Not applied to a native database. The unused calendar-service placeholders (listMeetingRooms returned an empty list, checkRoomAvailability always answered available, bookMeetingRoom returned a generated id without storing anything, cancelRoomBooking reported success) were removed together with their four stub tests (disclosed); overlap is refused by a trigger that locks the room row (SQLSTATE 23P01, answered as 409).'),
      item('DEF-0B8-JUR-MEETING-ROOM-BOOKINGS-PATH-IS-THE-ROOM-ITEM',
        'The bookings path serves bookings (GET slots with details only for the caller\'s own bookings unless staff; POST; PATCH approve or decline; DELETE cancels and keeps the row), each scoped to the caller\'s organization, audited in the same transaction; a booking id of another organization or room is not found. The f12-b53 contract pin that listed this route as 501 was removed (disclosed).'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S03 added')
