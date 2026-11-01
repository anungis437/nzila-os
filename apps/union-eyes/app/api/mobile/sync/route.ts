/**
 * Mobile device sync endpoint
 * GET /api/mobile/sync — list registered mobile devices for the current user
 * POST /api/mobile/sync — register a new mobile device
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { mobileDevices } from '@/db/schema/mobile-devices-schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

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

const PLATFORMS = ['ios', 'android', 'pwa'] as const;

const registrationSchema = z.object({
  deviceId: z.string().trim().min(1).max(255),
  platform: z.enum(PLATFORMS),
  // A browser (pwa) holds no push token; native devices must supply one.
  deviceToken: z.string().trim().min(8).max(512).optional(),
  deviceName: z.string().trim().max(255).optional(),
  deviceModel: z.string().trim().max(100).optional(),
  osVersion: z.string().trim().max(50).optional(),
  appVersion: z.string().trim().max(20).optional(),
}).strict();

/** Validates a registration body against the column limits and the per-platform token rule. Exported for direct testing. */
export function parseDeviceRegistration(body: unknown):
  | { ok: true; value: Omit<z.infer<typeof registrationSchema>, 'deviceToken'> & { deviceToken: string; pushCapable: boolean } }
  | { ok: false; error: string } {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'body'} ${issue.message}`).join('; ') };
  const { deviceToken, ...rest } = parsed.data;
  if (parsed.data.platform !== 'pwa' && !deviceToken) return { ok: false, error: 'deviceToken is required for a native device' };
  // The unique token column needs a value: a browser with no push token is keyed by its device id and cannot receive push.
  return { ok: true, value: { ...rest, deviceToken: deviceToken ?? `pwa:${parsed.data.deviceId}`.slice(0, 512), pushCapable: Boolean(deviceToken) } };
}

/** What a client may read about its own device: never the push token (a delivery credential) or the security and compliance flags. */
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
      .select(deviceProjection)
      .from(mobileDevices)
      .where(
        and(
          eq(mobileDevices.userId, userId),
          eq(mobileDevices.organizationId, organizationId),
          eq(mobileDevices.isArchived, false),
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
      description: 'Registers or re-registers a mobile device. This records the device; it does not synchronize any data.',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Auth context required');
    const parsed = parseDeviceRegistration(body);
    if (!parsed.ok) throw ApiError.badRequest(parsed.error);
    const { deviceToken, deviceId, platform, deviceName, deviceModel, osVersion, appVersion, pushCapable } = parsed.value;

    return withRLSContext({ organizationId }, async (tx) => {
      const [existing] = await tx
        .select({ userId: mobileDevices.userId })
        .from(mobileDevices)
        .where(eq(mobileDevices.deviceId, deviceId))
        .limit(1);
      assertDeviceNotOwnedByAnotherUser(existing?.userId, userId);

      // A push token held by a different device is a clash to report, not a raw constraint failure.
      const [tokenHolder] = await tx
        .select({ deviceId: mobileDevices.deviceId })
        .from(mobileDevices)
        .where(eq(mobileDevices.deviceToken, deviceToken))
        .limit(1);
      if (tokenHolder && tokenHolder.deviceId !== deviceId) {
        throw ApiError.conflict('This push token is already registered to another device');
      }

      // The ownership predicate on the update closes the window between the checks above and the write.
      const [saved] = await tx
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
            // A device registered while acting in another organization moves with the caller; it is not left bound to the first.
            organizationId,
            appVersion,
            osVersion,
            isActive: true,
            lastActiveAt: new Date(),
          },
          setWhere: eq(mobileDevices.userId, userId),
        })
        .returning(deviceProjection);
      if (!saved) throw ApiError.conflict('This device is already registered to another account');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'mobile.device.register',
        resourceType: 'mobile_devices',
        resourceId: saved.id,
        details: { platform, deviceId, pushCapable },
      });
      // Registration is all this route does. It runs no synchronization, and says so.
      return { device: saved, sync: { performed: false, reason: 'registration_only' } };
    });
  },
);
