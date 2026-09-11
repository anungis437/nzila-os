/**
 * Tenant-context database override storage.
 *
 * Mirrors db/system-context-storage.ts's strategy for the tenant RLS side:
 * withRLSContext()/withExplicitUserContext() open a transaction, run
 * `set_config('app.current_org_id', ...)`/`app.current_user_id` ON THAT
 * TRANSACTION, and pass the transaction handle to the caller's callback —
 * but a large existing call surface uses the no-argument callback form and
 * queries through the module-level `db` import directly (e.g.
 * `withRLSContext(async () => db.select(...))`). Before this module
 * existed, db/db.ts's `db` proxy had NO redirection for that case (only
 * for withSystemContext()'s system transaction), so those callers silently
 * ran on the ordinary pooled connection — a DIFFERENT physical connection
 * than the one carrying `app.current_org_id` — meaning the RLS context
 * that looked "set" in source was never actually attached to the query.
 *
 * AsyncLocalStorage closes that gap the same way it does for the system
 * side: for the duration of a withRLSContext/withExplicitUserContext
 * callback, db/db.ts's exported `db` proxy transparently resolves to the
 * active tenant transaction instead of the pooled connection, regardless
 * of whether the callback destructures/uses its `tx` parameter.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema'

export const tenantContextStorage = new AsyncLocalStorage<PostgresJsDatabase<typeof schema>>()

export function getActiveTenantDb(): PostgresJsDatabase<typeof schema> | undefined {
  return tenantContextStorage.getStore()
}
