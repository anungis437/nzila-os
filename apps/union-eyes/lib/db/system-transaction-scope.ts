import { systemDb } from '@/db/system-db'
import { systemContextStorage, getActiveSystemDb } from '@/db/system-context-storage'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { sql } from 'drizzle-orm'
import type { RLSTx } from './with-rls-context'

/** Dedicated system authority with nested savepoints and parent-context restoration. */
export async function withSystemContext<T>(operation: (tx: RLSTx) => Promise<T>): Promise<T>
export async function withSystemContext<T>(operation: () => Promise<T>): Promise<T>
export async function withSystemContext<T>(
  operation: (() => Promise<T>) | ((tx: RLSTx) => Promise<T>),
): Promise<T> {
  const active = getActiveSystemDb()
  if (active) {
    // A worker's suppression check is a nested system operation. Borrowing
    // another connection here deadlocks a one-connection pool. A savepoint
    // also lets a refused inner query roll back before the caller records
    // a retry, without aborting the outer worker transaction.
    return active.transaction(async (tx) => {
      const [previous] = await tx.execute<{
        database_role: string; user_id: string | null; org_id: string | null
      }>(sql`SELECT current_setting('role') AS database_role,
        current_setting('app.current_user_id', true) AS user_id,
        current_setting('app.current_org_id', true) AS org_id`)
      if (!previous?.database_role) throw new Error('System transaction context could not be read')
      if (currentStateContextEnabled()) await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
      await tx.execute(sql`SELECT set_config('app.current_user_id', '', true)`)
      await tx.execute(sql`SELECT set_config('app.current_org_id', '', true)`)
      const result = await systemContextStorage.run(tx, () => operation(tx))
      // Successful savepoints retain SET LOCAL changes, so restore the
      // parent role and audit context explicitly. On failure PostgreSQL's
      // savepoint rollback restores them along with the failed statement.
      await tx.execute(sql`SELECT
        set_config('app.current_user_id', ${previous.user_id ?? ''}, true),
        set_config('app.current_org_id', ${previous.org_id ?? ''}, true),
        set_config('role', ${previous.database_role}, true)`)
      return result
    })
  }
  // System operations run on a SEPARATE connection, authenticated as the
  // union_eyes_system role. Authority comes from that role's explicit,
  // named RLS policies (`TO union_eyes_system`) — not from clearing context
  // variables on the tenant runtime connection. See
  // db/migrations/0108_rls_tenant_isolation_foundation.sql.
  return await systemDb.transaction(async (tx) => {
    if (currentStateContextEnabled()) await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
    // Context vars are still cleared for audit/logging consistency, but no
    // policy on this connection depends on them being empty.
    await tx.execute(sql`SELECT set_config('app.current_user_id', '', true)`)
    await tx.execute(sql`SELECT set_config('app.current_org_id', '', true)`)
    // Scope the module-level `db` import (from @/db/db) to this transaction
    // for the duration of the callback. Dozens of existing callers use the
    // no-argument form and query through `db` directly rather than the
    // supplied `tx` — without this, those queries would silently run on the
    // tenant connection (union_eyes_runtime) despite appearing
    // system-authorized. See db/system-context-storage.ts.
    const result = await systemContextStorage.run(tx, () => operation(tx))
    return result
  })
}

