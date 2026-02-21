// cspell:words nzila
/**
 * Partners app API guards — authentication + audited database access.
 *
 * Provides the standard withAudit / createAuditedScopedDb wrappers
 * so partner-facing API routes use audited, Org-isolated writes.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  withAudit,
  createAuditedScopedDb,
  createScopedDb,
  type AuditedScopedDb,
} from '@nzila/db'
import { platformDb } from '@nzila/db/platform'
import { entityMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'

// ── Re-exports for route convenience ────────────────────────────────────────
export { withAudit, createAuditedScopedDb }
export type { AuditedScopedDb }

/**
 * Authenticate the current request via Clerk.
 *
 * @returns userId or a 401 NextResponse error.
 */
export async function authenticateUser(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, userId }
}

/**
 * Create an audited, Org-scoped database for the given entity.
 *
 * Combines Clerk auth with createAuditedScopedDb so routes get a
 * write-enabled, auto-auditing DB in one call.
 */
export async function getAuditedDb(entityId: string): Promise<
  | { ok: true; db: AuditedScopedDb; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const db = createAuditedScopedDb({
    orgId: entityId,
    actorId: authResult.userId,
  })

  return { ok: true, db, userId: authResult.userId }
}

/**
 * Create a read-only, Org-scoped database for the given entity.
 */
export function getReadOnlyDb(entityId: string) {
  return createScopedDb({ orgId: entityId })
}

/**
 * Require entity access — ensures the authenticated user is a member
 * of the entity (via entity_members table lookup).
 */
export async function requireEntityAccess(
  entityId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const [membership] = await platformDb
    .select()
    .from(entityMembers)
    .where(
      and(
        eq(entityMembers.entityId, entityId),
        eq(entityMembers.clerkUserId, authResult.userId),
      ),
    )
    .limit(1)

  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, userId: authResult.userId }
}
