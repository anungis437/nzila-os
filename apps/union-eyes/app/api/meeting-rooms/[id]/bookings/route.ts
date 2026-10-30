/**
 * GET POST /api/meeting-rooms/[id]/bookings
 *
 * Room booking is not available. This path used to be the room CRUD, so a PATCH sent to it edited the room row and a booking id
 * addressed nothing, while the room's booking rules were stored and never enforced. Bookings cannot be stored yet: the physical
 * room_bookings table lacks 26 of the columns the application declares (organization, booker, start, end and status among
 * them) and the storage-authority manifest grants the runtime role nothing on it, so a booking route would fail on every
 * request. The booking rules themselves are implemented and tested in lib/services/room-booking-rules.ts and are wired in when
 * the table is migrated and classified. Until then every method answers 501 and no room or booking row is read or written.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const options = {
  auth: { required: true, minRole: 'member' as const },
  openapi: {
    tags: ['Scheduling'],
    summary: 'Room bookings (not implemented)',
    description: 'Not implemented: answers 501.',
  },
};
const refuse = async () => {
  throw ApiError.notImplemented('Room booking is not implemented: the booking store is not provisioned, so no booking can be recorded.');
};

export const GET = withApi(options, refuse);
export const POST = withApi(options, refuse);
