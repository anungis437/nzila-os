/**
 * CRUD collection route for pushDevices
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ApiError } from '@/lib/api/errors';
import { pushDevices, profiles } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * SECURITY FIX (round 46): the crud-factory only auto-enforces
 * organizationId/createdBy on create, not arbitrary `ownerColumn` values —
 * without this, a request body could register a device under any other
 * member's profileId within the same org.
 */
export function buildPushDeviceCreateValues(
  values: Record<string, unknown>,
  userId: string | null | undefined,
): Record<string, unknown> {
  // A registration names a token and a known platform; anything else would reach the database enum or column as a 500.
  if (!userId) throw ApiError.forbidden('Authenticated profile required');
  if (typeof values.deviceToken !== 'string' || values.deviceToken.trim().length < 1 || values.deviceToken.length > 4096) {
    throw ApiError.badRequest('deviceToken is required');
  }
  if (!PUSH_PLATFORMS.includes(values.platform as (typeof PUSH_PLATFORMS)[number])) {
    throw ApiError.badRequest(`platform must be one of ${PUSH_PLATFORMS.join(', ')}`);
  }
  // PostgreSQL TIME and the platform enum must never receive unvalidated client strings.
  // Otherwise an ordinary malformed device preference produces a database 500.
  for (const key of ['quietHoursStart', 'quietHoursEnd'] as const) {
    const value = values[key];
    if (value !== undefined && value !== null &&
      (typeof value !== 'string' || !/^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(value))) {
      throw ApiError.badRequest(`${key} must be HH:mm in 24-hour time`);
    }
  }
  if (values.enabled !== undefined && typeof values.enabled !== 'boolean') {
    throw ApiError.badRequest('enabled must be a boolean');
  }
  for (const key of ['deviceName', 'deviceModel', 'osVersion', 'appVersion'] as const) {
    const value = values[key];
    if (value !== undefined && value !== null &&
      (typeof value !== 'string' || value.length > 255)) {
      throw ApiError.badRequest(`${key} must be a string of at most 255 characters`);
    }
  }
  if (values.timezone !== undefined && values.timezone !== null) {
    if (typeof values.timezone !== 'string' || values.timezone.length > 64) {
      throw ApiError.badRequest('timezone must be a valid IANA time zone');
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: values.timezone });
    } catch {
      throw ApiError.badRequest('timezone must be a valid IANA time zone');
    }
  }
  return { ...values, profileId: userId };
}

/**
 * push_devices.profile_id has a real FK to profiles.user_id. An authenticated
 * organization member is not guaranteed to have completed profile provisioning.
 * Reject that state explicitly before attempting the insert; do not report a
 * database constraint error as a server failure or silently create a profile.
 * RLS limits the lookup to the authenticated subject.
 */
export function assertPushDeviceProfilePresent(rows: readonly unknown[]): void {
  if (rows.length === 0) {
    throw ApiError.conflict('Complete member profile setup before registering a push device');
  }
}

export async function requirePushDeviceProfile(
  organizationId: string | null | undefined,
  userId: string | null | undefined,
): Promise<void> {
  if (!organizationId || !userId) throw ApiError.forbidden();
  const rows = await withRLSContext({ organizationId, userId }, async (tx) =>
    await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).limit(1),
  );
  assertPushDeviceProfilePresent(rows);
}

const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;

const { GET, POST } = crudRoutes({
  table: pushDevices,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  // Restricts GET to the caller's own devices, not every device in the org.
  ownerColumn: 'profileId',
  readRole: 'member',
  // The person who holds the phone registers it: a member, not only a steward. Every row is still the caller's own.
  writeRole: 'member',
  // A registration names a token and a platform and may set preferences; id, timestamps and ownership are never client-written.
  writableFields: ['deviceToken', 'platform', 'deviceName', 'deviceModel', 'osVersion', 'appVersion', 'enabled', 'quietHoursStart', 'quietHoursEnd', 'timezone'],
  // The push token is a delivery credential for that device and is never returned to a browser or script.
  omitFromResponse: ['deviceToken'],
  beforeCreate: async (values, { organizationId, userId }) => {
    const normalized = buildPushDeviceCreateValues(values, userId);
    await requirePushDeviceProfile(organizationId, userId);
    return normalized;
  },
});
export { GET, POST };
