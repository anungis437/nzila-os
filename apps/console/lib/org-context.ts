/**
 * Org context resolution for the console app.
 *
 * Why this exists: `auth().orgId` from `@nzila/platform-auth/entra/server`
 * returns the user's first Entra (Azure AD) security-group GUID, NOT the
 * app's `orgs.id` UUID stored in `org_members`. Resolving roles, scoping
 * Drizzle queries, or attributing audit/proof packs by that GUID will
 * never match. Always resolve the app-level org UUID from `org_members`.
 */
import { eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'

/**
 * Resolve the active app-level organization UUID for a console user.
 * Returns the orgId from the user's first active `org_members` row,
 * or `null` if the user has no active membership.
 */
export async function resolveActiveOrgId(userId: string): Promise<string | null> {
  if (!userId) return null
  const [membership] = await platformDb
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1)
  return membership?.orgId ?? null
}
