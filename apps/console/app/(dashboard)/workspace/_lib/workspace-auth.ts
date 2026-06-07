import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { resolveUserIdWithDevPreview } from '@/lib/dev-preview-auth'

/**
 * Auth gate for the Console workspace surface.
 *
 * Production behaviour is unchanged: unauthenticated requests are redirected to
 * `/sign-in`. In development ONLY — when no auth session and no local DB are
 * configured — the read-only workspace pages (catalog + deal-engine seed, no DB
 * writes, no sensitive data) are allowed to render so the operator can validate
 * the UI locally without standing up Postgres + auth.
 */
export async function requireWorkspaceUser(): Promise<string> {
  const userId = await resolveUserIdWithDevPreview()
  if (userId) return userId
  redirect('/sign-in')
}

/**
 * Resolve the org used for workspace-level integration connections.
 * Prefers the signed-in user's first membership, then falls back to the
 * executive org to preserve local/dev behaviour.
 */
export async function resolveWorkspaceOrgIdForUser(userId: string): Promise<string | null> {
  try {
    const membership = await platformDb.query.orgMembers.findFirst({
      where: eq(orgMembers.userId, userId),
    })
    if (membership?.orgId) return membership.orgId
  } catch {
    // Ignore membership lookup errors and use fallback.
  }

  return getExecutiveOrgId()
}
