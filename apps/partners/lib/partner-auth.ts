/**
 * Partner auth helpers — role & org utilities on top of platform auth.
 *
 * Platform Owner (Admin) Roles:
 *   - platform:admin    — Full platform access
 *   - platform:ops      — Operations access
 *   - platform:finance  — Finance access
 *
 * Partner roles follow the pattern: `{partnerType}:{role}`
 *   - channel:admin, channel:sales, channel:executive
 *   - isv:admin, isv:technical, isv:business
 *   - enterprise:admin, enterprise:user
 */
import { auth, currentUser as _currentUser } from '@nzila/platform-auth/entra/server'
import { isSuperAdmin } from '@nzila/os-core/config/super-admins'
// Partner tables are non-Org-scoped (see NON_ORG_SCOPED_TABLES) — use platformDb
import { platformDb } from '@nzila/db/platform'
import { partners, partnerEntities, partnerUsers } from '@nzila/db/schema'
import { eq, and, sql, desc } from 'drizzle-orm'

export type PlatformRole = 'platform:admin' | 'platform:ops' | 'platform:finance'
export type PartnerType = 'channel' | 'isv' | 'enterprise'

export type PartnerRole =
  | 'channel:admin' | 'channel:sales' | 'channel:executive'
  | 'isv:admin' | 'isv:technical' | 'isv:business'
  | 'enterprise:admin' | 'enterprise:user'

/**
 * Extract the partner type and sub-role from a custom role string.
 */
export function parsePartnerRole(role: string): { type: PartnerType; sub: string } | null {
  const parts = role.split(':')
  if (parts.length !== 2) return null
  const [type, sub] = parts
  if (!['channel', 'isv', 'enterprise'].includes(type!)) return null
  return { type: type as PartnerType, sub: sub! }
}

/**
 * Returns the current user's auth session claims.
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
 * Look up the partner record for the current auth org, then verify the
 * partner has an entitlement row granting access to `orgId + view`.
 *
 * Returns the partner row + orgId on success.
 * Returns `{ ok: false, error }` when the check fails.
 */
export async function requirePartnerEntityAccess(
  orgId: string,
  requiredView: string,
): Promise<
  | { ok: true; partner: { id: string; tier: string }; orgId: string }
  | { ok: false; error: string; status: number }
> {
  const session = await auth()
  if (!session.userId || !session.orgId) {
    return { ok: false, error: 'Unauthenticated', status: 401 }
  }

  // Resolve partner from auth org
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
        eq(partnerEntities.orgId, orgId),
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

  return { ok: true, partner, orgId }
}

/**
 * Resolve the first orgId the current auth org is entitled to access
 * for the given view permission. Returns null if not entitled.
 *
 * Used by API routes that self-resolve orgId so that pages do not need
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
    .select({ orgId: partnerEntities.orgId, allowedViews: partnerEntities.allowedViews })
    .from(partnerEntities)
    .where(eq(partnerEntities.partnerId, partner.id))
    .limit(1)

  if (!entitlement) return null

  const views = entitlement.allowedViews ?? []
  if (!views.includes(requiredView)) return null

  return entitlement.orgId
}

// ──────────────────────────────────────────────────────────────────────────────
// Platform Admin Functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if the current user has a platform admin role.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const session = await auth()
  if (!session.userId) return false

  // Super-admin email override
  const user = await _currentUser()
  const email = user?.primaryEmailAddress?.emailAddress
              ?? user?.emailAddresses?.[0]?.emailAddress
  if (isSuperAdmin(email)) return true
  
  // Check for platform roles
  const platformRoles: PlatformRole[] = ['platform:admin', 'platform:ops', 'platform:finance']
  for (const role of platformRoles) {
    const result = await session.has({ role })
    if (result) return true
  }
  
  return false
}

/**
 * Require platform admin access. Throws if not authorized.
 */
export async function requirePlatformAdmin(): Promise<{ userId: string; role: PlatformRole }> {
  const session = await auth()
  if (!session.userId) {
    throw new Error('Unauthenticated')
  }

  // Super-admin email override
  const user = await _currentUser()
  const email = user?.primaryEmailAddress?.emailAddress
              ?? user?.emailAddresses?.[0]?.emailAddress
  if (isSuperAdmin(email)) {
    return { userId: session.userId, role: 'platform:admin' }
  }

  const platformRoles: PlatformRole[] = ['platform:admin', 'platform:ops', 'platform:finance']
  for (const role of platformRoles) {
    const hasRole = await session.has({ role })
    if (hasRole) {
      return { userId: session.userId, role }
    }
  }

  throw new Error('Insufficient permissions - platform admin access required')
}

/**
 * Get all partners (for admin view).
 */
export async function getAllPartners() {
  await requirePlatformAdmin()
  
  return platformDb
    .select({
      id: partners.id,
      companyName: partners.companyName,
      type: partners.type,
      tier: partners.tier,
      status: partners.status,
      clerkOrgId: partners.clerkOrgId,
      nzilaOwnerId: partners.nzilaOwnerId,
      createdAt: partners.createdAt,
      updatedAt: partners.updatedAt,
    })
    .from(partners)
    .orderBy(desc(partners.createdAt))
}

/**
 * Get partner by ID (for admin view).
 */
export async function getPartnerById(partnerId: string) {
  await requirePlatformAdmin()
  
  const [partner] = await platformDb
    .select()
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1)

  return partner
}

/**
 * Update partner status (activate, suspend, deactivate).
 */
export async function updatePartnerStatus(
  partnerId: string,
  status: 'pending' | 'active' | 'suspended' | 'churned',
) {
  await requirePlatformAdmin()
  
  await platformDb
    .update(partners)
    .set({ status, updatedAt: new Date() })
    .where(eq(partners.id, partnerId))
}

/**
 * Update partner tier.
 */
export async function updatePartnerTier(
  partnerId: string,
  tier: 'registered' | 'select' | 'elite',
) {
  await requirePlatformAdmin()
  
  await platformDb
    .update(partners)
    .set({ tier, updatedAt: new Date() })
    .where(eq(partners.id, partnerId))
}

/**
 * Get platform-wide partner statistics.
 */
export async function getPartnerStats() {
  await requirePlatformAdmin()
  
  const [stats] = await platformDb.execute(sql`
    SELECT 
      COUNT(*) as total_partners,
      COUNT(*) FILTER (WHERE status = 'active') as active_partners,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_partners,
      COUNT(*) FILTER (WHERE status = 'suspended') as suspended_partners,
      COUNT(*) FILTER (WHERE tier = 'elite') as elite_partners,
      COUNT(*) FILTER (WHERE tier = 'select') as select_partners,
      COUNT(*) FILTER (WHERE tier = 'registered') as registered_partners,
      COUNT(*) FILTER (WHERE type = 'channel') as channel_partners,
      COUNT(*) FILTER (WHERE type = 'isv') as isv_partners,
      COUNT(*) FILTER (WHERE type = 'enterprise') as enterprise_partners
    FROM partners
  `)
  
  return stats
}

/**
 * Get all users for a specific partner (admin view).
 */
export async function getPartnerUsers(partnerId: string) {
  await requirePlatformAdmin()
  
  return platformDb
    .select()
    .from(partnerUsers)
    .where(eq(partnerUsers.partnerId, partnerId))
}
