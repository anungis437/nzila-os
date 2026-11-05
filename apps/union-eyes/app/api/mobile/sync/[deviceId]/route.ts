/**
 * DELETE /api/mobile/sync/[deviceId]
 *
 * The owner removes their own registered device: its push token stops being held. Another user's device, or one registered
 * in another organization, matches nothing (404). Neither device table had any removal route, so a lost or sold phone kept
 * its token forever.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { mobileDevices } from '@/db/schema/mobile-devices-schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['System'],
      summary: 'Remove a registered mobile device',
      description: 'Removes one of the caller\'s own registered devices.',
    },
  },
  async ({ params, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Auth context required');
    const { deviceId } = await params;
    return withRLSContext({ organizationId }, async (tx) => {
      const [removed] = await tx
        .delete(mobileDevices)
        .where(and(eq(mobileDevices.deviceId, deviceId), eq(mobileDevices.userId, userId), eq(mobileDevices.organizationId, organizationId)))
        .returning({ id: mobileDevices.id });
      if (!removed) throw ApiError.notFound('Device');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'mobile.device.remove',
        resourceType: 'mobile_devices',
        resourceId: removed.id,
        details: { deviceId },
      });
      return { success: true };
    });
  },
);
