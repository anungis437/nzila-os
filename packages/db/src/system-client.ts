/**
 * Nzila OS — system-privileged Postgres client for cross-user/cross-org
 * platform-auth operations (user_management schema).
 *
 * PR #752 round 13: `./client`'s `db` connects via DATABASE_URL — the
 * ordinary per-request/tenant-scoped credential. Platform-admin operations
 * that must mutate or revoke ANOTHER user's durable auth membership or
 * session (e.g. offboarding a member from a different organization) must
 * not execute as that same ordinary credential: after an RLS/role
 * separation cutover, DATABASE_URL may be scoped to a role with no
 * legitimate reason to touch another user's row. SYSTEM_DATABASE_URL is
 * the same dedicated system-role connection string already established
 * for apps/union-eyes/db/system-db.ts's union_eyes_system role (0108's
 * migration) — reused here for the shared user_management schema rather
 * than introducing a second env var, since the underlying database is one
 * physical instance per environment.
 *
 * Callers: pass this client explicitly into platform-auth functions that
 * accept an optional db override (e.g.
 * @nzila/platform-auth/password's revokeAllUserSessions). Do not use this
 * client for a user's own self-service operations — only for
 * platform/system-authorized cross-user actions.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type SystemDbType = ReturnType<typeof drizzle<typeof schema>>

let _systemDb: SystemDbType | undefined

function getSystemDb(): SystemDbType {
  if (!_systemDb) {
    const connectionString = process.env.SYSTEM_DATABASE_URL
    if (!connectionString) {
      throw new Error(
        'SYSTEM_DATABASE_URL environment variable is required for system-privileged auth operations',
      )
    }
    const poolSize = Number(process.env.SYSTEM_DB_POOL_MAX ?? '5')
    const sql = postgres(connectionString, { max: poolSize, idle_timeout: 30, prepare: false })
    _systemDb = drizzle(sql, { schema })
  }
  return _systemDb
}

export const systemDb = new Proxy({} as SystemDbType, {
  get(_target, prop) {
    const resolvedDb = getSystemDb() as unknown as Record<PropertyKey, unknown>
    return resolvedDb[prop]
  },
  has(_target, prop) {
    return prop in getSystemDb()
  },
}) as SystemDbType

export type SystemDatabase = SystemDbType
