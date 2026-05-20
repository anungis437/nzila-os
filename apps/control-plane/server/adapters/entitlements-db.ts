/**
 * Control Plane — org_entitlements DB adapter (Watch 3).
 *
 * Thin read layer over the `org_entitlements` table. Kept dependency-free
 * (no platformDb singleton import) so the unit tests can pass a mock
 * builder and verify the query shape without booting Drizzle.
 *
 * Returns `null` when no live entitlement row exists for the (org, feature)
 * pair — the resolver decides what that means (deny vs. fall back to the
 * conservative stub allow-list).
 */
import 'server-only'

import { and, eq, gt, isNull, or } from 'drizzle-orm'

import { orgEntitlements } from '@nzila/db/schema'

export interface EntitlementRow {
  tier: string
  limit: number | null
  expiresAt: string | null
  source: string
}

/**
 * Narrow Drizzle surface the adapter uses. Production passes
 * `platformDb`; tests pass a chainable mock.
 */
export interface EntitlementsDb {
  select: (...args: unknown[]) => {
    from: (...args: unknown[]) => {
      where: (...args: unknown[]) => {
        limit: (n: number) => Promise<readonly unknown[]>
      }
    }
  }
}

/**
 * Resolve a single (orgId, feature) entitlement from the durable
 * `org_entitlements` table. A row is considered live when:
 *   - it matches the requested orgId + feature, AND
 *   - `expires_at` is NULL, OR `expires_at` is strictly in the future.
 *
 * Returns `null` if no live row exists. Errors are propagated to the
 * caller; the resolver wraps the adapter in a try/catch and converts
 * unexpected failures into a denied result.
 */
export async function resolveEntitlementFromDb(
  db: EntitlementsDb,
  orgId: string,
  feature: string,
  now: Date = new Date(),
): Promise<EntitlementRow | null> {
  const rows = (await db
    .select({
      tier: orgEntitlements.tier,
      limit: orgEntitlements.limit,
      expiresAt: orgEntitlements.expiresAt,
      source: orgEntitlements.source,
    })
    .from(orgEntitlements)
    .where(
      and(
        eq(orgEntitlements.orgId, orgId),
        eq(orgEntitlements.feature, feature),
        or(isNull(orgEntitlements.expiresAt), gt(orgEntitlements.expiresAt, now)),
      ),
    )
    .limit(1)) as ReadonlyArray<{
    tier: string
    limit: number | null
    expiresAt: Date | string | null
    source: string
  }>

  const row = rows[0]
  if (!row) return null

  const expiresAtIso =
    row.expiresAt instanceof Date
      ? row.expiresAt.toISOString()
      : typeof row.expiresAt === 'string'
        ? row.expiresAt
        : null

  return {
    tier: row.tier,
    limit: row.limit ?? null,
    expiresAt: expiresAtIso,
    source: row.source,
  }
}
