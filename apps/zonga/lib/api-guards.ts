/**
 * Shared API route guards — authentication + org-scoped database access.
 *
 * Centralises the auth boilerplate for all Zonga API routes, combining
 * Clerk authentication, org membership verification, and audited
 * org-scoped database access via @nzila/db.
 *
 * Usage in API routes:
 *   const access = await requireOrgAccess(orgId)
 *   if (!access.ok) return access.response
 *   const { db, userId } = await getAuditedDb(orgId)
 *
 * Usage with request context (enables auto-attached requestId in logs):
 *   return withRequestContext(request, async () => {
 *     const access = await requireOrgAccess(orgId)
 *     if (!access.ok) return access.response
 *     // ... handler logic
 *   })
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  withAudit,
  createAuditedScopedDb,
  createScopedDb,
  type AuditedScopedDb,
} from '@nzila/db'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  createRequestContext,
  runWithContext,
} from '@nzila/os-core/telemetry'

// ── Re-exports for route convenience ────────────────────────────────────────
export { withAudit, createAuditedScopedDb }
export type { AuditedScopedDb }

// ── Authentication ──────────────────────────────────────────────────────────

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

// ── Org-scoped database access ──────────────────────────────────────────────

/**
 * Create an audited, org-scoped database for the given org.
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
 * Create a read-only, org-scoped database for the given org.
 */
export function getReadOnlyDb(orgId: string) {
  return createScopedDb({ orgId: orgId })
}

// ── Org membership verification ─────────────────────────────────────────────

/**
 * Require org access — ensures the authenticated user is a member
 * of the org (via org_members table lookup).
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
  const ctx = createRequestContext(req, { appName: 'zonga' })
  return runWithContext(ctx, handler)
}

// ── Org-scoped API route wrapper ────────────────────────────────────────────

/**
 * High-level wrapper for org-scoped API handlers.
 *
 * 1. Establishes request context (tracing)
 * 2. Authenticates user via Clerk
 * 3. Resolves orgId from Clerk auth
 * 4. Returns 403 if no active org is selected
 *
 * This is the API boundary enforcement. The action layer already
 * calls `resolveOrgContext()` internally (defense in depth).
 */
export async function withOrgScope(
  req: NextRequest | Request,
  handler: (ctx: { userId: string; orgId: string }) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withRequestContext(req, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response

    const { orgId } = await auth()
    if (!orgId) {
      return NextResponse.json(
        {
          error: 'Org scope required',
          message: 'Select an active organization before accessing this resource.',
          code: 'ORG_SCOPE_REQUIRED',
        },
        { status: 403 },
      )
    }

    return handler({ userId: authResult.userId, orgId })
  })
}
