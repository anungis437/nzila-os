// cspell:words nzila
/**
 * Partners app API guards — authentication + audited database access.
 *
 * Provides the standard withAudit / createAuditedScopedDb wrappers
 * so partner-facing API routes use audited, Org-isolated writes.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import {
  withAudit,
  createAuditedScopedDb,
  createScopedDb,
  type AuditedScopedDb,
} from '@nzila/db'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { createRequestContext, runWithContext } from '@nzila/os-core'

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
export async function getAuditedDb(orgId: string): Promise<
  | { ok: true; db: AuditedScopedDb; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const db = createAuditedScopedDb({
    orgId: orgId,
    actorId: authResult.userId,
  })

  return { ok: true, db, userId: authResult.userId }
}

/**
 * Create a read-only, Org-scoped database for the given entity.
 */
export function getReadOnlyDb(orgId: string) {
  return createScopedDb({ orgId: orgId })
}

/**
 * Require entity access — ensures the authenticated user is a member
 * of the entity (via org_members table lookup).
 */
export async function requireOrgAccess(
  orgId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const [membership] = await platformDb
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.clerkUserId, authResult.userId),
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

// ── Request Context wrapper ─────────────────────────────────────────────────

/**
 * Wraps a route handler with os-core request context.
 * Extracts x-request-id and W3C traceparent from headers,
 * then runs the handler inside AsyncLocalStorage so the
 * os-core logger auto-attaches requestId/traceId to every log.
 */
export async function withRequestContext<T>(
  req: NextRequest | Request,
  handler: () => Promise<T>,
): Promise<T> {
  const ctx = createRequestContext(req, { appName: 'partners' })
  return runWithContext(ctx, handler)
}
