/**
 * PATCH DELETE /api/meeting-rooms/[id]/bookings/[bookingId]
 *
 * DELETE cancels a booking (never removes the row): the person who made it, or staff. PATCH decides a booking that is
 * waiting for approval: staff only, and never the person who made the booking.
 */
import { withApi, z, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getRoleLevel, UserRole } from '@/lib/auth/roles';
import { getUserRoleInOrganization } from '@/lib/organization-utils';
import { cancelRoomBooking, decideRoomBooking } from '@/lib/services/room-booking-service';

export const dynamic = 'force-dynamic';

const decisionSchema = z.object({
  decision: z.enum(['approve', 'decline']),
  notes: z.string().trim().max(1000).optional(),
});

const cancelQuery = z.object({ reason: z.string().trim().max(500).optional() });

const callerRole = (userId: string, organizationId: string) => getUserRoleInOrganization(userId, organizationId).catch(() => null);
const atLeastSteward = (role: string | null) => role != null && getRoleLevel(role as UserRole) >= getRoleLevel(UserRole.STEWARD);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    query: cancelQuery,
    openapi: { tags: ['Scheduling'], summary: 'Cancel a room booking', description: 'Marks the booking cancelled; the row is kept.' },
  },
  async ({ params, query, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    const role = await callerRole(userId, organizationId);
    const booking = await withRLSContext({ organizationId }, (tx) =>
      cancelRoomBooking(tx, { organizationId, userId, role, isStaff: atLeastSteward(role) }, params.id, params.bookingId, query.reason ?? null),
    );
    return { data: booking };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: decisionSchema,
    openapi: { tags: ['Scheduling'], summary: 'Approve or decline a room booking', description: 'Staff other than the booker.' },
  },
  async ({ params, body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    const role = await callerRole(userId, organizationId);
    const booking = await withRLSContext({ organizationId }, (tx) =>
      decideRoomBooking(tx, { organizationId, userId, role }, params.id, params.bookingId, body.decision, body.notes ?? null),
    );
    return { data: booking };
  },
);
