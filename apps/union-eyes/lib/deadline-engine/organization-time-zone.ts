/**
 * Reads the time zone an organization keeps its deadline days in (see deadline-day.ts for the order: the organization's own
 * `settings.timezone`, then its province or territory, then DEFAULT_ORGANIZATION_TIME_ZONE). An organization that cannot be
 * read (no row visible to the caller) is placed in the default zone, and the result says so in `source`.
 *
 * No column holds the zone: `settings.timezone` is the administrator's setting written through PUT /api/settings/organization.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations } from '@/db/schema-organizations';
import { dayFieldsAtEndOfDay, hasDayField, organizationTimeZone, type OrganizationTimeZone } from './deadline-day';

export async function loadOrganizationTimeZone(organizationId: string): Promise<OrganizationTimeZone> {
  const [row] = await db
    .select({
      settings: organizations.settings,
      provinceTerritory: organizations.provinceTerritory,
      address: organizations.address,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return organizationTimeZone(row ?? null);
}

/**
 * For a write path (a crud hook): each named field that holds a bare calendar day becomes 23:59 that day in the organization's
 * zone. The organization is read only when some field holds a day; every other value is left for the write path to validate.
 */
export async function dayDeadlineFieldsAtEndOfDay(
  values: Record<string, unknown>,
  fields: readonly string[],
  organizationId: string | null | undefined,
): Promise<Record<string, unknown>> {
  if (!organizationId || !hasDayField(values, fields)) return values;
  const { timeZone } = await loadOrganizationTimeZone(organizationId);
  return dayFieldsAtEndOfDay(values, fields, timeZone);
}
