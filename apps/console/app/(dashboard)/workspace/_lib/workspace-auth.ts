import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { resolveConsoleEntityId } from '@/lib/entity-context'
import { resolveUserIdWithDevPreview } from '@/lib/dev-preview-auth'
import { requireOperatorRole } from '@/lib/rbac'

export type WorkspaceOrgResolutionSource =
  | 'executive-org'
  | 'console-entity'
  | 'membership'
  | 'none'

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
  if (userId) {
    if (userId !== 'dev-preview') {
      await requireOperatorRole()
    }
    return userId
  }
  redirect('/sign-in')
}

/**
 * Resolve the org used for workspace-level integration connections.
 * Console is executive-operated and should default to the canonical Nzila org.
 * Falls back to user/entity-derived context only when the executive org cannot
 * be resolved.
 */
export async function resolveWorkspaceOrgIdForUser(userId: string): Promise<string | null> {
  const executiveOrgId = await getExecutiveOrgId()
  if (executiveOrgId) return executiveOrgId

  // Primary path: app-level membership or configured default entity.
  try {
    const consoleEntityId = await resolveConsoleEntityId(userId)
    if (consoleEntityId) return consoleEntityId
  } catch {
    // Ignore resolver failures and continue to fallback paths.
  }

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

/**
 * Debuggable variant exposing which path provided org context.
 */
export async function resolveWorkspaceOrgContextForUser(
  userId: string,
): Promise<{ orgId: string | null; source: WorkspaceOrgResolutionSource }> {
  const executiveOrgId = await getExecutiveOrgId()
  if (executiveOrgId) return { orgId: executiveOrgId, source: 'executive-org' }

  try {
    const consoleEntityId = await resolveConsoleEntityId(userId)
    if (consoleEntityId) return { orgId: consoleEntityId, source: 'console-entity' }
  } catch {
    // Ignore resolver failures and continue to fallback paths.
  }

  try {
    const membership = await platformDb.query.orgMembers.findFirst({
      where: eq(orgMembers.userId, userId),
    })
    if (membership?.orgId) return { orgId: membership.orgId, source: 'membership' }
  } catch {
    // Ignore membership lookup errors.
  }

  return { orgId: null, source: 'none' }
}

/**
 * Resolve a mandatory org context for server-side workspace mutations.
 */
export async function requireWorkspaceOrgIdForUser(userId: string): Promise<string> {
  // Preserve the local dev preview shortcut while still enforcing operator role in real sessions.
  if (userId !== 'dev-preview') {
    await requireOperatorRole()
  }

  const orgId = await resolveWorkspaceOrgIdForUser(userId)
  if (!orgId) {
    throw new Error('Forbidden: no active workspace organization context')
  }
  return orgId
}
