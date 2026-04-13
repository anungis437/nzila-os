/**
 * Org context resolution — Zonga.
 *
 * Resolves a fully typed `ZongaOrgContext` from auth session.
 * Every `'use server'` action MUST call `resolveOrgContext()` at the top
 * and use the returned context for:
 *   - org-scoped DB queries (WHERE org_id = ctx.orgId)
 *   - org-scoped DB inserts (org_id = ctx.orgId)
 *   - audit trail attribution
 *   - evidence generation
 *
 * This enforces the ORG_REQUIRED invariant at the server action boundary —
 * no query can accidentally omit the org filter.
 *
 * @module resolve-org
 */
import { auth, currentUser } from '@nzila/platform-auth/entra/server'
import type { ZongaOrgContext } from '@nzila/zonga-core/types'

/** Zonga roles mirror the core ZongaRole enum. */
type ZongaRole = 'admin' | 'creator' | 'manager' | 'viewer'

import { isSuperAdmin } from '@nzila/os-core/config/super-admins'

/**
 * Resolve org context from auth session.
 *
 * `auth()` returns `orgId` when the user has an active
 * organization selected. We map this to the NzilaOS `orgId`.
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

  let role = mapAuthRoleToZongaRole(orgRole, sessionClaims)

  // Super-admin email override
  if (role !== 'admin') {
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress
                ?? user?.emailAddresses?.[0]?.emailAddress
    if (isSuperAdmin(email)) {
      role = 'admin'
    }
  }

  return {
    orgId: orgId,
    actorId: userId,
    role: role as ZongaOrgContext['role'],
    permissions: derivePermissions(role),
    requestId: crypto.randomUUID(),
  }
}

/**
 * Lightweight context for listener-facing reads.
 *
 * Unlike `resolveOrgContext()`, this does NOT require an active
 * organization. Listeners are individual users who browse cross-org
 * content — they should never be forced to select a label.
 *
 * Actions that only need the authenticated user ID (and optionally
 * an org hint for scoped sub-queries) should use this resolver.
 *
 * @throws Error('Unauthorized') if unauthenticated
 */
export interface ListenerContext {
  actorId: string
  /** Present only when the user has an active org selected. */
  orgId: string | null
}

export async function resolveListenerContext(): Promise<ListenerContext> {
  const { userId, orgId } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  return {
    actorId: userId,
    orgId: orgId ?? null,
  }
}

/**
 * Resolve the internal UUID for the current listener from zonga_listeners.
 *
 * Child tables (activity, follows, favorites, playlist_saves) use
 * `listener_id` (UUID) as a FK → `zonga_listeners.id`.
 * Auth user ID is stored in `zonga_listeners.user_id` (text).
 *
 * This helper returns the UUID `id`, creating the listener row on the
 * fly via ensureListenerProfile when it doesn't exist yet.
 */
export async function resolveListenerUUID(ctx: ListenerContext): Promise<string> {
  const { platformDb } = await import('@nzila/db/platform')
  const { sql } = await import('drizzle-orm')

  const [row] = (await platformDb.execute(
    sql`SELECT id FROM zonga_listeners WHERE user_id = ${ctx.actorId} LIMIT 1`,
  )) as unknown as [{ id: string } | undefined]

  if (row) return row.id

  // Auto-create a minimal listener profile (atomic upsert)
  // org_id is a UUID FK — auth orgId is NOT a UUID, so always pass null here.
  // The org_id can be linked later via org resolution if needed.
  const [created] = (await platformDb.execute(
    sql`INSERT INTO zonga_listeners (user_id, org_id, display_name)
    VALUES (${ctx.actorId}, ${null}, 'Listener')
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING id`,
  )) as unknown as [{ id: string }]

  return created.id
}

/**
 * Map auth provider organization role to ZongaRole.
 */
function mapAuthRoleToZongaRole(
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
