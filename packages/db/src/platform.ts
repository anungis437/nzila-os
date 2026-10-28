/**
 * Nzila OS — Platform Database Access
 *
 * Provides controlled access to the raw Drizzle database instance for
 * tables that are NOT Org-scoped (i.e., tables listed in NON_ORG_SCOPED_TABLES).
 *
 * App code MUST prefer:
 *   - createScopedDb()          for Org-scoped reads
 *   - createAuditedScopedDb()   for Org-scoped writes
 *
 * Use `platformDb` ONLY for tables that genuinely lack org_id:
 *   - `orgs`       — root Org table (id IS the Org)
 *   - `people`         — global person registry
 *   - `partners`       — partner portal, scoped by clerk_org_id
 *   - `aiPrompts`      — global prompt library
 *   - etc.             — see NON_ORG_SCOPED_TABLES in org-registry.ts
 *
 * Topology: the platform tables (NAR audit records, decision records, orchestration) are not part of an application's own
 * database. When PLATFORM_DATABASE_URL is set, `platformDb` connects there; otherwise it shares the default connection, as
 * before. An application whose database is admission-checked against a storage-authority catalog (Union Eyes) must not hold
 * the platform tables in that database, so it sets PLATFORM_DATABASE_URL.
 *
 * This module is intentionally NOT exported from the barrel `@nzila/db`
 * to prevent accidental use. Import explicitly:
 *
 *   import { platformDb } from '@nzila/db/platform'
 *
 * @module @nzila/db/platform
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { db, type Database } from './client'

let separate: Database | undefined

function resolvePlatformDb(): Database {
  const url = process.env.PLATFORM_DATABASE_URL
  if (!url) return db
  if (!separate) {
    const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? '20')
    separate = drizzle(postgres(url, { max: poolSize, idle_timeout: 30 }), { schema }) as unknown as Database
  }
  return separate
}

/**
 * Platform-level Drizzle client for non-Org-scoped tables.
 *
 * @see NON_ORG_SCOPED_TABLES in @nzila/db/org-registry
 */
export const platformDb: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = resolvePlatformDb() as unknown as Record<PropertyKey, unknown>
    const value = real[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
  },
})

export type { Database }
