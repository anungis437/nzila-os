/**
 * Shared API route guards — entity membership + platform RBAC
 *
 * Centralises the auth boilerplate for all entity-scoped API routes,
 * combining Clerk authentication, entity membership verification,
 * and platform-level role checks from lib/rbac.
 */
import { NextResponse } from 'next/server'
import {
  createScopedDb,
  createAuditedScopedDb,
  withAudit,
  type AuditedScopedDb,
} from '@nzila/db'
import { platformDb } from '@nzila/db/platform'
import { entityMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { getUserRole, type NzilaRole } from '@/lib/rbac'

// ── Re-exports for route convenience ────────────────────────────────────────
export { withAudit, createAuditedScopedDb, createScopedDb }
export type { AuditedScopedDb }

export interface AuthContext {
  userId: string
  platformRole: NzilaRole
  membership: {
    id: string
    entityId: string
    clerkUserId: string
    role: 'entity_admin' | 'entity_secretary' | 'entity_viewer'
    status: 'active' | 'suspended' | 'removed'
  } | null
}

/**
 * Authenticate the user and optionally verify entity membership.
 *
 * @returns AuthContext or a NextResponse error (401/403)
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
 *
 * @param entityId  The entity UUID
 * @param userId    The Clerk user ID
 * @returns membership row or null
 */
export async function getEntityMembership(entityId: string, userId: string) {
  const [m] = await platformDb
    .select()
    .from(entityMembers)
    .where(
      and(
        eq(entityMembers.entityId, entityId),
        eq(entityMembers.clerkUserId, userId),
        eq(entityMembers.status, 'active'),
      ),
    )
    .limit(1)
  return m ?? null
}

/**
 * Full entity-scoped guard: authenticates user, checks membership,
 * optionally requires a minimum entity role (admin > secretary > viewer).
 *
 * Returns either the context (userId, platformRole, membership) or a
 * NextResponse error that should be returned immediately.
 */
export async function requireEntityAccess(
  entityId: string,
  options?: {
    /** Minimum entity role required. Default: any active member. */
    minRole?: 'entity_admin' | 'entity_secretary'
    /** Platform roles that bypass entity membership checks. */
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

  const membership = await getEntityMembership(entityId, userId)
  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  // Check minimum role
  if (options?.minRole) {
    const roleHierarchy: Record<string, number> = {
      entity_admin: 3,
      entity_secretary: 2,
      entity_viewer: 1,
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
