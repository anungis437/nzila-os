/**
 * Organization Utilities — Zonga
 *
 * Resolves the **app-level** organization UUID for an authenticated user.
 *
 * Why this exists: `auth().orgId` from `@nzila/platform-auth/entra/server`
 * returns the user's first Entra (Azure AD) security-group GUID, NOT the
 * app's `orgs.id` UUID stored in `org_members`. Looking up roles or
 * memberships by that GUID will never match.
 *
 * Use `getOrganizationIdForUser(userId)` everywhere we need to scope
 * Drizzle queries against `org_members` / `orgs`.
 */

import { cookies } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { orgMembers, orgs } from '@nzila/db/schema'

/**
 * Resolve the active organization UUID for a Zonga user.
 *
 * Priority order:
 *   1. `selected_org_id` cookie — only honoured if the user is an active
 *      member of that org (or is listed in `PLATFORM_ADMIN_USER_IDS`).
 *   2. The user's most-recently-updated **active** `org_members` row.
 *
 * Returns `null` when the user has no active org membership and no
 * platform-admin override. Callers MUST treat null as a 403 (no org scope).
 */
export async function getOrganizationIdForUser(
  userId: string,
): Promise<string | null> {
  if (!userId) return null

  const platformAdminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isPlatformAdmin = platformAdminIds.includes(userId)

  // 1) Cookie-selected org (org switcher).
  let selectedOrgId: string | undefined
  try {
    const cookieStore = await cookies()
    selectedOrgId =
      cookieStore.get('selected_org_id')?.value ||
      cookieStore.get('selected_organization_id')?.value
  } catch {
    // `cookies()` throws outside a request scope — safe to ignore.
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
      // Cookie pointed at an org the user isn't a member of — fall through.
    }
  }

  // 2) Most-recently-updated active membership.
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
