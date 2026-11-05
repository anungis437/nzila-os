/**
 * GET POST /api/meeting-rooms/[id]/bookings
 *
 * Books a meeting room under the room's own rules (hours, blocked dates, duration, how far ahead, who may book, capacity,
 * approval): lib/services/room-booking-rules.ts decides, and the database refuses a second booking of the same slot.
 * The path used to be the room CRUD and then answered 501 because the booking store did not exist; it exists once platform
 * migration 0041 and cache migration 0035 are applied, and until then every call fails closed on the missing columns.
 *
 * GET lists a room's slots for a window. A member sees the slots and the details of their own bookings; staff see all.
 */
import { withApi, z, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getRoleLevel, UserRole } from '@/lib/auth/roles';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { createRoomBooking, isOverlapViolation, listRoomBookings, overlapConflict } from '@/lib/services/room-booking-service';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  purpose: z.string().trim().min(1).max(500),
  attendeeCount: z.number().int().min(1).max(10000).optional(),
  specialRequests: z.string().max(2000).optional(),
  cateringRequired: z.boolean().optional(),
  cateringNotes: z.string().max(1000).optional(),
});

const listSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const callerRole = (userId: string, organizationId: string) => getUserRoleInOrganization(userId, organizationId).catch(() => null);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    query: listSchema,
    openapi: { tags: ['Scheduling'], summary: 'List a room\'s bookings', description: 'Slots in a window; details only of the caller\'s own bookings unless staff.' },
  },
  async ({ params, query, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    const role = await callerRole(userId, organizationId);
    const isStaff = role != null && getRoleLevel(role as UserRole) >= getRoleLevel(UserRole.STEWARD);
    const bookings = await withRLSContext({ organizationId }, (tx) =>
      listRoomBookings(tx, { organizationId, userId, role, isStaff }, params.id, { from: query.from, to: query.to, limit: query.limit }),
    );
    return { data: bookings };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: createSchema,
    openapi: { tags: ['Scheduling'], summary: 'Book a room', description: 'Accepted only when the room\'s own rules allow it; answers 409 when the slot is taken.' },
  },
  async ({ params, body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    const role = await callerRole(userId, organizationId);
    try {
      const booking = await withRLSContext({ organizationId }, (tx) =>
        createRoomBooking(tx, { organizationId, userId, role }, params.id, body),
      );
      return { data: booking };
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapConflict();
      throw error;
    }
  },
);
