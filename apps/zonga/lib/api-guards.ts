/**
 * Shared API route guards — authentication + org-scoped database access.
 *
 * Centralises the auth boilerplate for all Zonga API routes, combining
 * authentication, org membership verification, and audited
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
import {
  createRequestContext,
  runWithContext,
} from '@nzila/os-core/telemetry'
import { getOrganizationIdForUser } from './organization-utils'

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
 * Combines auth with createAuditedScopedDb so routes get a
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
        eq(orgMembers.userId, authResult.userId),
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

// ── Role-based access control ────────────────────────────────────────────────

/**
 * Zonga role hierarchy for fine-grained access control.
 * Roles are stored in the `role` column of `org_members`.
 * Deny-by-default: if the role column is null/missing, the user is treated as 'listener'.
 */
export type ZongaRole =
  | 'super_admin'
  | 'platform_operator'
  | 'client_admin'
  | 'artist_manager'
  | 'creator'
  | 'finance_admin'
  | 'support_agent'
  | 'listener'

/** Roles that imply elevated platform access */
const ELEVATED_ROLES: readonly ZongaRole[] = ['super_admin', 'platform_operator']

/**
 * Require the authenticated user to hold one of the allowed roles within
 * their active org. Returns the userId and resolved role on success.
 *
 * Usage:
 *   const guard = await requireRole(orgId, ['finance_admin', 'platform_operator'])
 *   if (!guard.ok) return guard.response
 */
export async function requireRole(
  orgId: string,
  allowedRoles: ZongaRole[],
): Promise<
  | { ok: true; userId: string; role: ZongaRole }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const rows = await platformDb
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, authResult.userId),
      ),
    )
    .limit(1)

  const membership = rows[0]
  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  // Fall back to 'listener' when role column is null (e.g. older rows)
  const memberRole = ((membership as Record<string, unknown>).role as ZongaRole | undefined) ?? 'listener'

  // super_admin and platform_operator always pass role checks
  const effectiveAllowed = [...allowedRoles, ...ELEVATED_ROLES]

  if (!effectiveAllowed.includes(memberRole)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Insufficient privileges', required: allowedRoles },
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: authResult.userId, role: memberRole }
}

// ── Org-scoped API route wrapper ────────────────────────────────────────────

/**
 * High-level wrapper for org-scoped API handlers.
 *
 * 1. Establishes request context (tracing)
 * 2. Authenticates user via auth session
 * 3. Resolves orgId from auth session
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

    // IMPORTANT: do NOT use `auth().orgId` — it returns the user's first
    // Entra (Azure AD) security-group GUID, not the app-level `orgs.id`.
    // Resolve the real organization UUID from `org_members`.
    const orgId = await getOrganizationIdForUser(authResult.userId)
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
