/**
 * Org context resolution — Zonga.
 *
 * Resolves a fully typed `ZongaOrgContext` from Clerk auth state.
 * Every `'use server'` action MUST call `resolveOrgContext()` at the top
 * and use the returned context for:
 *   - org-scoped DB queries (WHERE org_id = ctx.entityId)
 *   - org-scoped DB inserts (org_id = ctx.entityId)
 *   - audit trail attribution
 *   - evidence generation
 *
 * This enforces the ORG_REQUIRED invariant at the server action boundary —
 * no query can accidentally omit the org filter.
 *
 * @module resolve-org
 */
import { auth } from '@clerk/nextjs/server'
import type { ZongaOrgContext } from '@nzila/zonga-core/types'

/** Zonga roles mirror the core ZongaRole enum. */
type ZongaRole = 'admin' | 'creator' | 'manager' | 'viewer'

/**
 * Resolve org context from Clerk auth.
 *
 * Clerk's `auth()` returns `orgId` when the user has an active
 * organization selected. We map this to the NzilaOS `entityId`.
 *
 * @throws Error('Unauthorized') if unauthenticated
 * @throws Error('No active organization') if no org selected
 */
export async function resolveOrgContext(): Promise<ZongaOrgContext> {
  const { userId, orgId, orgRole, sessionClaims } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  if (!orgId) {
    throw new Error('No active organization — select an org before accessing Zonga.')
  }

  const role = mapClerkRoleToZongaRole(orgRole, sessionClaims)

  return {
    entityId: orgId,
    actorId: userId,
    role: role as ZongaOrgContext['role'],
    permissions: derivePermissions(role),
    requestId: crypto.randomUUID(),
  }
}

/**
 * Map Clerk organization role to ZongaRole.
 */
function mapClerkRoleToZongaRole(
  orgRole: string | undefined | null,
  sessionClaims: Record<string, unknown> | undefined | null,
): ZongaRole {
  const metaRole = (
    sessionClaims as { publicMetadata?: { zongaRole?: string } } | undefined
  )?.publicMetadata?.zongaRole

  if (metaRole && ['admin', 'creator', 'manager', 'viewer'].includes(metaRole)) {
    return metaRole as ZongaRole
  }

  switch (orgRole) {
    case 'org:admin':
      return 'admin'
    case 'org:member':
      return 'creator'
    default:
      return 'viewer'
  }
}

/**
 * Derive permission keys from ZongaRole.
 */
function derivePermissions(role: ZongaRole): readonly string[] {
  const base = ['zonga:read', 'zonga:catalog:list']

  switch (role) {
    case 'admin':
      return [
        ...base,
        'zonga:catalog:create',
        'zonga:catalog:publish',
        'zonga:creator:manage',
        'zonga:release:create',
        'zonga:release:publish',
        'zonga:revenue:record',
        'zonga:payout:execute',
        'zonga:payout:preview',
        'zonga:settings:manage',
      ]
    case 'manager':
      return [
        ...base,
        'zonga:catalog:create',
        'zonga:catalog:publish',
        'zonga:creator:manage',
        'zonga:release:create',
        'zonga:release:publish',
        'zonga:revenue:record',
        'zonga:payout:preview',
      ]
    case 'creator':
      return [
        ...base,
        'zonga:catalog:create',
        'zonga:release:create',
        'zonga:payout:preview',
      ]
    case 'viewer':
    default:
      return base
  }
}
