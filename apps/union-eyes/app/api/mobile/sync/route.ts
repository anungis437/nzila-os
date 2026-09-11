/**
 * Mobile device sync endpoint
 * GET /api/mobile/sync — list registered mobile devices for the current user
 * POST /api/mobile/sync — register a new mobile device
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { mobileDevices } from '@/db/schema/mobile-devices-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * ROUND 50 SECURITY FIX: deviceId is globally unique, but the previous
 * onConflictDoUpdate() target only matched on deviceId, with no check
 * that any pre-existing row for that deviceId belonged to the caller.
 * Any authenticated user who knew (or guessed) another user's deviceId
 * could silently overwrite that row's deviceToken, hijacking their push
 * notification channel.
 */
export function assertDeviceNotOwnedByAnotherUser(
  existingOwnerUserId: string | undefined,
  callerUserId: string,
): void {
  if (existingOwnerUserId && existingOwnerUserId !== callerUserId) {
    throw ApiError.conflict('This device is already registered to another account');
  }
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['System'],
      summary: 'List mobile devices',
      description: 'Returns registered mobile devices for the authenticated user.',
    },
  },
  async ({ userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Auth context required');
    const devices = await db
      .select()
      .from(mobileDevices)
      .where(
        and(
          eq(mobileDevices.userId, userId),
          eq(mobileDevices.organizationId, organizationId),
        ),
      );

    return devices;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['System'],
      summary: 'Register mobile device',
      description: 'Registers a new mobile device for push notifications and sync.',
    },
  },
  async ({ request, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Auth context required');
    const body = await request.json();
    const {
      deviceToken,
      deviceId,
      platform,
      deviceName,
      deviceModel,
      osVersion,
      appVersion,
    } = body as {
      deviceToken: string;
      deviceId: string;
      platform: string;
      deviceName?: string;
      deviceModel?: string;
      osVersion?: string;
      appVersion?: string;
    };

    if (!deviceToken || !deviceId || !platform) {
      throw ApiError.badRequest('deviceToken, deviceId, and platform are required');
    }

    const [existing] = await db
      .select({ userId: mobileDevices.userId })
      .from(mobileDevices)
      .where(eq(mobileDevices.deviceId, deviceId))
      .limit(1);
    assertDeviceNotOwnedByAnotherUser(existing?.userId, userId);

    const [created] = await db
      .insert(mobileDevices)
      .values({
        deviceToken,
        deviceId,
        userId,
        organizationId,
        platform,
        deviceName,
        deviceModel,
        osVersion,
        appVersion,
      })
      .onConflictDoUpdate({
        target: mobileDevices.deviceId,
        set: {
          deviceToken,
          appVersion,
          osVersion,
          lastActiveAt: new Date(),
        },
      })
      .returning();

    return created;
  },
);
