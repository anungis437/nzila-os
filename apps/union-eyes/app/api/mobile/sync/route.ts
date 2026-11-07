/**
 * /api/mobile/sync
 *
 * Offline synchronization is not implemented: nothing reads or writes mobile_sync_queue, and no entity, conflict or retry policy for
 * offline edits has been decided. POST used to register a device into mobile_devices under this name and answer 200, so a client was told it
 * had synced and a second device table, which no sender reads, kept growing. POST now answers 501 and writes nothing.
 *
 * Push devices have one table, push_devices: register at POST /api/mobile/devices, remove at DELETE /api/mobile/devices/[id], and send a test
 * notification at POST /api/mobile/devices/[id]/test-push. GET here still lists the caller's rows left in the legacy mobile_devices table, and
 * DELETE /api/mobile/sync/[deviceId] removes one, so a token stored there before can be withdrawn by its owner; no new row is written there.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { mobileDevices } from '@/db/schema/mobile-devices-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** What a client may read about its own legacy device: never the push token (a delivery credential) or the security and compliance flags. */
const deviceProjection = {
  id: mobileDevices.id,
  deviceId: mobileDevices.deviceId,
  platform: mobileDevices.platform,
  deviceName: mobileDevices.deviceName,
  deviceModel: mobileDevices.deviceModel,
  osVersion: mobileDevices.osVersion,
  appVersion: mobileDevices.appVersion,
  pushEnabled: mobileDevices.pushEnabled,
  isActive: mobileDevices.isActive,
  registeredAt: mobileDevices.registeredAt,
  lastActiveAt: mobileDevices.lastActiveAt,
};

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['System'],
      summary: 'List legacy mobile device registrations',
      description: 'Returns the caller\'s rows in the legacy mobile_devices table so they can be removed. New devices are registered at /api/mobile/devices.',
    },
  },
  async ({ userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Auth context required');
    return db
      .select(deviceProjection)
      .from(mobileDevices)
      .where(
        and(
          eq(mobileDevices.userId, userId),
          eq(mobileDevices.organizationId, organizationId),
          eq(mobileDevices.isArchived, false),
        ),
      );
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['System'],
      summary: 'Mobile offline synchronization (not implemented)',
      description: 'Not implemented: answers 501 and writes nothing. Register a push device at POST /api/mobile/devices.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Offline synchronization is not implemented: nothing was synchronized or stored. Register a push device at POST /api/mobile/devices.');
  },
);
