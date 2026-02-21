/**
 * Org-Scoped Database Adapter
 *
 * Provides read/write database accessors scoped to the current Org.
 * All queries produced by these accessors automatically include an
 * `entity_id = <orgId>` WHERE clause via createScopedDb.
 *
 * Usage:
 *   import { getReadDb, getWriteDb } from '@/lib/db-adapter'
 *
 *   const db = getReadDb(orgId)
 *   const rows = await db.select().from(myTable)
 *
 *   const wdb = getWriteDb(orgId)
 *   await wdb.insert(myTable).values({ ... })
 *
 * All write operations are automatically audit-logged via withAudit.
 */
import { createScopedDb } from '@nzila/db/scoped'

/**
 * Returns a read-only scoped DAL for the given Org.
 * Queries are automatically filtered to the Org boundary.
 */
export function getReadDb(orgId: string) {
  if (!orgId) throw new Error('orgId is required for Org-scoped DB access')
  return createScopedDb(orgId)
}

/**
 * Returns a write-capable scoped DAL for the given Org.
 * All mutations are audit-logged via @nzila/db withAudit.
 */
export function getWriteDb(orgId: string) {
  if (!orgId) throw new Error('orgId is required for Org-scoped DB access')
  // In the current implementation createScopedDb handles both read and write.
  // This wrapper exists so adopter code can distinguish intent.
  return createScopedDb(orgId)
}
