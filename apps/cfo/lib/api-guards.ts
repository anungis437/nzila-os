/**
 * Shared API route guards — entity membership + platform RBAC
 *
 * Centralises the auth boilerplate for all entity-scoped API routes,
 * combining Clerk authentication, entity membership verification,
 * and platform-level role checks from lib/rbac.
 *
 * Aligned with console reference implementation.
 */
import { NextResponse, type NextRequest } from 'next/server'
import {
  createScopedDb,
  createAuditedScopedDb,
  withAudit,
  type AuditedScopedDb,
} from '@nzila/db'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { getUserRole, type NzilaRole } from '@/lib/rbac'
import { createRequestContext, runWithContext } from '@nzila/os-core'

// ── Re-exports for route convenience ────────────────────────────────────────
export { withAudit, createAuditedScopedDb, createScopedDb }
export type { AuditedScopedDb }

export interface AuthContext {
  userId: string
  platformRole: NzilaRole
  membership: {
    id: string
    orgId: string
    clerkUserId: string
    role: 'org_admin' | 'org_secretary' | 'org_viewer'
    status: 'active' | 'suspended' | 'removed'
  } | null
}

/**
 * Authenticate the user and resolve their platform role.
 */
export async function authenticateUser(): Promise<
  | { ok: true; userId: string; platformRole: NzilaRole }
  | { ok: false; response: NextResponse }
> {
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const platformRole = await getUserRole()
  return { ok: true, userId, platformRole }
}

/**
 * Verify that the user is an active member of the entity.
 */
export async function getOrgMembership(orgId: string, userId: string) {
  const [m] = await platformDb
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.clerkUserId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1)
  return m ?? null
}

/**
 * Full entity-scoped guard: authenticates user, checks membership,
 * optionally requires a minimum entity role (admin > secretary > viewer).
 */
export async function requireOrgAccess(
  orgId: string,
  options?: {
    minRole?: 'org_admin' | 'org_secretary'
    platformBypass?: NzilaRole[]
  },
): Promise<
  | { ok: true; context: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const { userId, platformRole } = authResult

  // Platform admins can bypass entity membership
  if (options?.platformBypass?.includes(platformRole)) {
    return {
      ok: true,
      context: { userId, platformRole, membership: null },
    }
  }

  const membership = await getOrgMembership(orgId, userId)
  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  // Check minimum role
  if (options?.minRole) {
    const roleHierarchy: Record<string, number> = {
      org_admin: 3,
      org_secretary: 2,
      org_viewer: 1,
    }
    const userLevel = roleHierarchy[membership.role] ?? 0
    const requiredLevel = roleHierarchy[options.minRole] ?? 0
    if (userLevel < requiredLevel) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 }),
      }
    }
  }

  return {
    ok: true,
    context: {
      userId,
      platformRole,
      membership: membership as AuthContext['membership'],
    },
  }
}

/**
 * Guard for platform-level routes (not entity-scoped).
 * Checks that the user has one of the allowed platform roles.
 */
export async function requirePlatformRole(
  ...allowed: NzilaRole[]
): Promise<
  | { ok: true; userId: string; platformRole: NzilaRole }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  if (!allowed.includes(authResult.platformRole)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Forbidden: requires one of [${allowed.join(', ')}]` },
        { status: 403 },
      ),
    }
  }

  return authResult
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
  const ctx = createRequestContext(req, { appName: 'cfo' })
  return runWithContext(ctx, handler)
}
