/**
 * Organization Utilities — TrustCore TrustOps
 *
 * Resolves the **app-level** organization UUID for an authenticated user.
 * Mirrors apps/zonga/lib/organization-utils.ts.
 *
 * Why: `auth().orgId` from `@nzila/platform-auth/entra/server` returns
 * the user's first Entra security-group GUID — NOT the `orgs.id` UUID
 * stored in `org_members`. Callers needing a real org scope MUST use
 * `getOrganizationIdForUser(userId)`.
 */

import { cookies } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { orgMembers, orgs } from '@nzila/db/schema'

export async function getOrganizationIdForUser(
  userId: string,
): Promise<string | null> {
  if (!userId) return null

  const platformAdminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isPlatformAdmin = platformAdminIds.includes(userId)

  let selectedOrgId: string | undefined
  try {
    const cookieStore = await cookies()
    selectedOrgId =
      cookieStore.get('selected_org_id')?.value ||
      cookieStore.get('selected_organization_id')?.value
  } catch {
    selectedOrgId = undefined
  }

  if (selectedOrgId) {
    const [org] = await platformDb
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.id, selectedOrgId))
      .limit(1)

    if (org) {
      if (isPlatformAdmin) return org.id

      const [membership] = await platformDb
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, org.id),
            eq(orgMembers.userId, userId),
            eq(orgMembers.status, 'active'),
          ),
        )
        .limit(1)

      if (membership) return membership.orgId
    }
  }

  const [membership] = await platformDb
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(
      and(eq(orgMembers.userId, userId), eq(orgMembers.status, 'active')),
    )
    .orderBy(desc(orgMembers.updatedAt))
    .limit(1)

  return membership?.orgId ?? null
}
