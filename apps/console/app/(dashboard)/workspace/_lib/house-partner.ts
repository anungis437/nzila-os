/**
 * Console workspace — internal "house" partner resolver.
 *
 * Executive-created and HubSpot-imported deals are attached to a single internal
 * partner so the `deals.partner_id` FK is always satisfied without forcing the
 * operator to pick a partner. Shared by the sales mutations and the HubSpot sync.
 */
import { eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { partners } from '@nzila/db/schema'

/** Stable identifier for the internal partner that owns executive-created deals. */
export const HOUSE_PARTNER_CLERK_ORG = 'nzila-house'

/** Get-or-create the internal house partner; returns its id. */
export async function getHousePartnerId(): Promise<string> {
  const existing = await platformDb
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.clerkOrgId, HOUSE_PARTNER_CLERK_ORG))
    .limit(1)
  if (existing[0]) return existing[0].id

  const [inserted] = await platformDb
    .insert(partners)
    .values({
      clerkOrgId: HOUSE_PARTNER_CLERK_ORG,
      companyName: 'Nzila (House)',
      type: 'channel',
      status: 'active',
    })
    .onConflictDoNothing()
    .returning({ id: partners.id })
  if (inserted) return inserted.id

  // Lost a race — read the row the other writer created.
  const again = await platformDb
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.clerkOrgId, HOUSE_PARTNER_CLERK_ORG))
    .limit(1)
  return again[0]!.id
}
