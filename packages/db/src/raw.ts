/**
 * Nzila OS — Raw Drizzle Client
 *
 * ⚠️  INTERNAL ONLY. Do not import outside the OS layer (@nzila/os-core, @nzila/db).
 *
 * Application code MUST use `createScopedDb(entityId)` from `@nzila/db/scoped`.
 * Raw database access bypasses Org isolation and audit guarantees.
 *
 * Enforcement:
 *   - ESLint rule `no-shadow-db` blocks imports of this module in apps/*
 *   - Contract test `db-boundary.test.ts` fails on raw imports in app code
 *   - CI pre-build step validates no violations
 *
 * @module @nzila/db/raw
 * @internal
 */
import { db, type Database } from './client'

/**
 * The raw, unscoped Drizzle client.
 *
 * **Do not use in application code.**
 * This export exists solely for use within the OS platform layer
 * (migrations, admin tooling, system-level operations).
 */
export const rawDb: Database = db

export type { Database }
