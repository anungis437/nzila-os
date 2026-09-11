/**
 * System-context database override storage.
 *
 * Backs the guarantee that withSystemContext()/withPlatformAdminRLSContext()
 * are "mechanically unavoidable": every one of the ~90 existing callers uses
 * the no-argument callback form and queries through the module-level `db`
 * import directly (e.g. `withSystemContext(() => db.execute(...))`).
 * TypeScript's structural typing lets a zero-parameter callback satisfy a
 * `(tx) => Promise<T>` slot, so a signature change alone cannot force callers
 * to use the supplied transaction — the callback body can silently keep
 * using the tenant `db` instead, and the operation would run as
 * `union_eyes_runtime`, not `union_eyes_system`, despite appearing to be
 * "system-authorized".
 *
 * AsyncLocalStorage closes that gap without touching any of the ~90 call
 * sites' business logic: for the duration of a withSystemContext /
 * withPlatformAdminRLSContext callback, db/db.ts's exported `db` proxy
 * transparently resolves to the active system transaction instead of the
 * tenant connection, regardless of whether the callback destructures/uses
 * its `tx` parameter.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema'

export const systemContextStorage = new AsyncLocalStorage<PostgresJsDatabase<typeof schema>>()

export function getActiveSystemDb(): PostgresJsDatabase<typeof schema> | undefined {
  return systemContextStorage.getStore()
}
