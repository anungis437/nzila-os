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
 * Use `platformDb` ONLY for tables that genuinely lack entity_id:
 *   - `entities`       — root Org table (id IS the Org)
 *   - `people`         — global person registry
 *   - `partners`       — partner portal, scoped by clerk_org_id
 *   - `aiPrompts`      — global prompt library
 *   - etc.             — see NON_ORG_SCOPED_TABLES in org-registry.ts
 *
 * This module is intentionally NOT exported from the barrel `@nzila/db`
 * to prevent accidental use. Import explicitly:
 *
 *   import { platformDb } from '@nzila/db/platform'
 *
 * @module @nzila/db/platform
 */
import { db, type Database } from './client'

/**
 * Platform-level Drizzle client for non-Org-scoped tables.
 *
 * @see NON_ORG_SCOPED_TABLES in @nzila/db/org-registry
 */
export const platformDb: Database = db

export type { Database }
