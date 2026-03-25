/**
 * Mobile device sync endpoint (v2)
 * GET /api/v2/mobile/sync — list registered mobile devices for the current user
 * POST /api/v2/mobile/sync — register a new mobile device
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { mobileDevices } from '@/db/schema/mobile-devices-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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
