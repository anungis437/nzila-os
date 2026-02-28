/**
 * Org context resolution — Trade.
 *
 * Resolves a fully typed `TradeOrgContext` from Clerk auth state.
 * Every `'use server'` action MUST call `resolveOrgContext()` at the top
 * and use the returned context for:
 *   - org-scoped DB queries (WHERE entity_id = ctx.entityId)
 *   - org-scoped DB inserts (entity_id = ctx.entityId)
 *   - audit trail attribution
 *   - evidence generation
 *
 * This enforces the ORG_REQUIRED invariant at the server action boundary —
 * no query can accidentally omit the org filter.
 *
 * @module resolve-org
 */
import { auth } from '@clerk/nextjs/server'
import type { TradeOrgContext } from '@nzila/trade-core/types'
import type { TradeOrgRole } from '@nzila/trade-core/enums'

/**
 * Resolve org context from Clerk auth.
 *
 * Clerk's `auth()` returns `orgId` when the user has an active
 * organization selected. We map this to the NzilaOS `entityId`.
 *
 * @throws Error('Unauthorized') if unauthenticated
 * @throws Error('No active organization') if no org selected
 */
export async function resolveOrgContext(): Promise<TradeOrgContext> {
  const { userId, orgId, orgRole, sessionClaims } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  if (!orgId) {
    throw new Error('No active organization — select an org before accessing Trade.')
  }

  const role = mapClerkRoleToTradeRole(orgRole, sessionClaims)

  return {
    entityId: orgId,
    actorId: userId,
    role,
    permissions: derivePermissions(role),
    requestId: crypto.randomUUID(),
  }
}

/**
 * Map Clerk organization role to TradeOrgRole.
 */
function mapClerkRoleToTradeRole(
  orgRole: string | undefined | null,
  sessionClaims: Record<string, unknown> | undefined | null,
): TradeOrgRole {
  const metaRole = (
    sessionClaims as { publicMetadata?: { tradeRole?: string } } | undefined
  )?.publicMetadata?.tradeRole

  if (metaRole && ['admin', 'seller', 'buyer', 'broker', 'viewer'].includes(metaRole)) {
    return metaRole as TradeOrgRole
  }

  switch (orgRole) {
    case 'org:admin':
      return 'admin'
    case 'org:member':
      return 'viewer'
    default:
      return 'viewer'
  }
}

/**
 * Derive permission keys from TradeOrgRole.
 */
function derivePermissions(role: TradeOrgRole): readonly string[] {
  const base = ['trade:read', 'trade:dashboard:view']

  switch (role) {
    case 'admin':
      return [
        ...base,
        'trade:party:create',
        'trade:party:manage',
        'trade:listing:create',
        'trade:listing:publish',
        'trade:deal:create',
        'trade:deal:transition',
        'trade:quote:create',
        'trade:quote:send',
        'trade:financing:attach',
        'trade:shipment:create',
        'trade:shipment:milestone',
        'trade:document:upload',
        'trade:commission:create',
        'trade:commission:finalize',
        'trade:evidence:view',
        'trade:settings:manage',
      ]
    case 'seller':
      return [
        ...base,
        'trade:listing:create',
        'trade:listing:publish',
        'trade:deal:create',
        'trade:quote:create',
        'trade:quote:send',
        'trade:shipment:create',
        'trade:shipment:milestone',
        'trade:document:upload',
        'trade:commission:create',
      ]
    case 'buyer':
      return [
        ...base,
        'trade:deal:create',
        'trade:quote:create',
        'trade:document:upload',
      ]
    case 'broker':
      return [
        ...base,
        'trade:party:create',
        'trade:listing:create',
        'trade:listing:publish',
        'trade:deal:create',
        'trade:deal:transition',
        'trade:quote:create',
        'trade:quote:send',
        'trade:financing:attach',
        'trade:shipment:create',
        'trade:document:upload',
        'trade:commission:create',
        'trade:commission:finalize',
      ]
    case 'viewer':
    default:
      return base
  }
}
