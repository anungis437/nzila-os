/**
 * CRUD collection route for pushDevices
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pushDevices } from '@/db/schema';

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
  return { ...values, profileId: userId };
}

const { GET, POST } = crudRoutes({
  table: pushDevices,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  // Restricts GET to the caller's own devices, not every device in the org.
  ownerColumn: 'profileId',
  readRole: 'member',
  writeRole: 'steward',
  beforeCreate: (values, { userId }) => buildPushDeviceCreateValues(values, userId),
});
export { GET, POST };
