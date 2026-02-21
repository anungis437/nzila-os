/**
 * Partner auth helpers — role & org utilities on top of Clerk.
 *
 * Partner roles follow the pattern: `{partnerType}:{role}`
 *   - channel:admin, channel:sales, channel:executive
 *   - isv:admin, isv:technical, isv:business
 *   - enterprise:admin, enterprise:user
 */
import { auth } from '@clerk/nextjs/server'
// Partner tables are non-Org-scoped (see NON_ORG_SCOPED_TABLES) — use platformDb
import { platformDb } from '@nzila/db/platform'
import { partners, partnerEntities } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'

export type PartnerType = 'channel' | 'isv' | 'enterprise'

export type PartnerRole =
  | 'channel:admin' | 'channel:sales' | 'channel:executive'
  | 'isv:admin' | 'isv:technical' | 'isv:business'
  | 'enterprise:admin' | 'enterprise:user'

/**
 * Extract the partner type and sub-role from a Clerk custom role string.
 */
export function parsePartnerRole(role: string): { type: PartnerType; sub: string } | null {
  const parts = role.split(':')
  if (parts.length !== 2) return null
  const [type, sub] = parts
  if (!['channel', 'isv', 'enterprise'].includes(type!)) return null
  return { type: type as PartnerType, sub: sub! }
}

/**
 * Returns the current user's Clerk session claims.
 * Throws redirect to /sign-in if unauthenticated.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session.userId) {
    throw new Error('Unauthenticated')
  }
  return session
}

/**
 * Check whether the current user has a specific role.
 */
export async function hasRole(role: PartnerRole): Promise<boolean> {
  const session = await auth()
  if (!session.userId) return false
  const result = await session.has({ role })
  return result
}

/**
 * Check whether the current user has ANY of the given roles.
 */
export async function hasAnyRole(roles: PartnerRole[]): Promise<boolean> {
  for (const role of roles) {
    if (await hasRole(role)) return true
  }
  return false
}

/**
 * Look up the partner record for the current Clerk org, then verify the
 * partner has an entitlement row granting access to `entityId + view`.
 *
 * Returns the partner row + entityId on success.
 * Returns `{ ok: false, error }` when the check fails.
 */
export async function requirePartnerEntityAccess(
  entityId: string,
  requiredView: string,
): Promise<
  | { ok: true; partner: { id: string; tier: string }; entityId: string }
  | { ok: false; error: string; status: number }
> {
  const session = await auth()
  if (!session.userId || !session.orgId) {
    return { ok: false, error: 'Unauthenticated', status: 401 }
  }

  // Resolve partner from Clerk org
  const [partner] = await platformDb
    .select({ id: partners.id, tier: partners.tier })
    .from(partners)
    .where(eq(partners.clerkOrgId, session.orgId))
    .limit(1)

  if (!partner) {
    return { ok: false, error: 'No partner record for this org', status: 403 }
  }

  // Check entity entitlement
  const [entitlement] = await platformDb
    .select({ id: partnerEntities.id, allowedViews: partnerEntities.allowedViews })
    .from(partnerEntities)
    .where(
      and(
        eq(partnerEntities.partnerId, partner.id),
        eq(partnerEntities.entityId, entityId),
      ),
    )
    .limit(1)

  if (!entitlement) {
    return { ok: false, error: 'No access to this entity', status: 403 }
  }

  // Check that the required view is in allowedViews
  const views = entitlement.allowedViews ?? []
  if (!views.includes(requiredView)) {
    return { ok: false, error: `View "${requiredView}" not entitled`, status: 403 }
  }

  return { ok: true, partner, entityId }
}

/**
 * Resolve the first entityId the current Clerk org is entitled to access
 * for the given view permission. Returns null if not entitled.
 *
 * Used by API routes that self-resolve entityId so that pages do not need
 * direct DB access just to discover which entity to fetch.
 */
export async function resolvePartnerEntityIdForView(
  requiredView: string,
): Promise<string | null> {
  const session = await auth()
  if (!session.userId || !session.orgId) return null

  const [partner] = await platformDb
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.clerkOrgId, session.orgId))
    .limit(1)

  if (!partner) return null

  const [entitlement] = await platformDb
    .select({ entityId: partnerEntities.entityId, allowedViews: partnerEntities.allowedViews })
    .from(partnerEntities)
    .where(eq(partnerEntities.partnerId, partner.id))
    .limit(1)

  if (!entitlement) return null

  const views = entitlement.allowedViews ?? []
  if (!views.includes(requiredView)) return null

  return entitlement.entityId
}
