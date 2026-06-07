/**
 * Shared API route guards — org membership + platform RBAC
 *
 * Centralises the auth boilerplate for all org-scoped API routes,
 * combining platform authentication, org membership verification,
 * and platform-level role checks from lib/rbac.
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
import { headers } from 'next/headers'
import { getUserRole, isOperatorRole, type NzilaRole } from '@/lib/rbac'
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
    userId: string
    role: 'org_admin' | 'org_secretary' | 'org_viewer'
    status: 'active' | 'suspended' | 'removed'
  } | null
}

/**
 * Authenticate the user via platform session or service-to-service key.
 *
 * Service auth: if AI_SERVICE_KEY is set and the request sends
 * `Authorization: Bearer <key>` with a matching value, the caller
 * is treated as an internal service with app_owner privileges.
 *
 * @returns AuthContext or a NextResponse error (401/403)
 */
export async function authenticateUser(): Promise<
  | { ok: true; userId: string; platformRole: NzilaRole; isService?: boolean }
  | { ok: false; response: NextResponse }
> {
  // ── Service-to-service auth (cross-app AI gateway calls) ────────────
  const serviceKey = process.env.AI_SERVICE_KEY
  if (serviceKey) {
    const hdrs = await headers()
    const authHeader = hdrs.get('authorization')
    if (authHeader === `Bearer ${serviceKey}`) {
      return { ok: true, userId: 'svc:ai-gateway', platformRole: 'app_owner' as NzilaRole, isService: true }
    }
  }

  // ── Normal user session auth ───────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const platformRole = await getUserRole()
  if (!isOperatorRole(platformRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden: operator role required' }, { status: 403 }),
    }
  }
  return { ok: true, userId, platformRole }
}

/**
 * Verify that the user is an active member of the entity.
 *
 * @param orgId  The entity UUID
 * @param userId    The authenticated user ID
 * @returns membership row or null
 */
export async function getOrgMembership(orgId: string, userId: string) {
  const [m] = await platformDb
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1)
  return m ?? null
}

/**
 * Full org-scoped guard: authenticates user, checks membership,
 * optionally requires a minimum org role (admin > secretary > viewer).
 *
 * Returns either the context (userId, platformRole, membership) or a
 * NextResponse error that should be returned immediately.
 */
export async function requireOrgAccess(
  orgId: string,
  options?: {
    /** Minimum org role required. Default: unknown active member. */
    minRole?: 'org_admin' | 'org_secretary'
    /** Platform roles that bypass org membership checks. */
    platformBypass?: NzilaRole[]
  },
): Promise<
  | { ok: true; context: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const { userId, platformRole } = authResult

  // Platform admins can bypass org membership
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
 * Guard for platform-level routes (not org-scoped).
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

// ── Observability Helpers ────────────────────────────────────────────────────

/**
 * Wrap an API route handler with request context propagation.
 * Ensures OTel traces, structured logs, and audit trails share a
 * consistent request-scoped context (request-id, user, timing).
 */
export async function withRequestContext<T>(
  request: Request | NextRequest,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = createRequestContext(request)
  return runWithContext(ctx, fn)
}
