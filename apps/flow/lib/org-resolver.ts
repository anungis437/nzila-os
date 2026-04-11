/**
 * Auth org ID → internal UUID resolver.
 *
 * Auth organizations use string IDs (e.g. `org_3B5A…`),
 * while the Nzila schema uses UUID `org_id` columns.
 * This module bridges the two via the `orgs.clerk_org_id` column.
 *
 * @module org-resolver
 */
import { auth } from '@nzila/platform-auth/entra/server'
import type { CommerceDbContext, CommerceReadContext } from '@nzila/commerce-db'

/** In-process cache (per-instance, cleared on deploy). */
// ga-check:exempt — TTL cache, not primary persistence
const cache = new Map<string, { uuid: string; ts: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

/**
 * Resolve an auth organization ID to the internal UUID stored in `orgs.id`.
 * Reads from `orgs WHERE clerk_org_id = $1`.
 */
export async function resolveInternalOrgId(authOrgId: string): Promise<string> {
  const hit = cache.get(authOrgId)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.uuid

  const { db, orgs } = await import('@nzila/db')
  const { eq } = await import('drizzle-orm')

  const [row] = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.clerkOrgId, authOrgId))
    .limit(1)

  if (!row) {
    throw new Error(
      `No internal org found for auth org "${authOrgId}". ` +
      `Ensure the org is registered in the orgs table with a matching clerk_org_id.`,
    )
  }

  cache.set(authOrgId, { uuid: row.id, ts: Date.now() })
  return row.id
}

/**
 * Build a `CommerceReadContext` from the current auth session.
 * Resolves auth org ID → internal UUID automatically.
 */
export async function getReadContext(): Promise<CommerceReadContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error('Unauthorized')
  const internalOrgId = await resolveInternalOrgId(orgId)
  return { orgId: internalOrgId }
}

/**
 * Build a `CommerceDbContext` from the current auth session.
 * Resolves auth org ID → internal UUID automatically.
 */
export async function getDbContext(): Promise<CommerceDbContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error('Unauthorized')
  const internalOrgId = await resolveInternalOrgId(orgId)
  return { orgId: internalOrgId, actorId: userId, actorRole: 'user' }
}
