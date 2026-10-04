/**
 * Server-side authorization for selecting an active organization.
 */
import 'server-only'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { and, eq } from 'drizzle-orm'

function platformAdminIds(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
}

export async function canSetActiveOrg(actorId: string, orgId: string): Promise<boolean> {
  if (platformAdminIds().has(actorId)) return true
  const [row] = await platformDb
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, actorId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1)
  return Boolean(row)
}
