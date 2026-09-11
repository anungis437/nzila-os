/**
 * System Database Client
 *
 * Separate connection, authenticated as the `union_eyes_system` Postgres
 * role, used ONLY by withSystemContext() / withSystemRLSContext() /
 * withPlatformAdminRLSContext() in lib/db/with-rls-context.ts.
 *
 * This exists so that "system operation, no tenant context" is backed by a
 * real, separately-credentialed database role that RLS policies can grant
 * access to explicitly (`TO union_eyes_system`), rather than by clearing
 * app.current_org_id on the same connection the ordinary tenant runtime
 * uses. An ordinary request can never reach this connection — there is no
 * code path from a tenant-scoped route to this module other than through
 * the three named system-context wrappers.
 *
 * See apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql
 * for the role/policy definitions this connection relies on.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const systemDatabaseUrl = process.env.SYSTEM_DATABASE_URL

// System paths are background/admin, not per-request — a small pool is
// intentional; this must never approach the size of the tenant pool.
const connectionOptions = {
  max: parseInt(process.env.SYSTEM_DB_POOL_MAX || '5'),
  idle_timeout: parseInt(process.env.SYSTEM_DB_IDLE_TIMEOUT || '30'),
  connect_timeout: parseInt(process.env.SYSTEM_DB_CONNECTION_TIMEOUT || '10'),
  prepare: false,
  keepalive: true,
  debug: false,
  connection: {
    application_name: 'union-eyes-system',
    statement_timeout: parseInt(process.env.SYSTEM_DB_QUERY_TIMEOUT || '30000'),
  },
}

let _systemClient: ReturnType<typeof postgres> | undefined
let _systemDb: PostgresJsDatabase<typeof schema> | undefined

function getSystemClient() {
  if (!_systemClient) {
    if (!systemDatabaseUrl) {
      throw new Error(
        'Missing required environment variable: SYSTEM_DATABASE_URL. ' +
          'withSystemContext()/withSystemRLSContext()/withPlatformAdminRLSContext() ' +
          'require a dedicated union_eyes_system connection string — see ' +
          'apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql.',
      )
    }
    _systemClient = postgres(systemDatabaseUrl, connectionOptions)
  }
  return _systemClient
}

function getSystemDb() {
  if (!_systemDb) {
    _systemDb = drizzle(getSystemClient(), { schema })
  }
  return _systemDb
}

export const systemDb = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return (getSystemDb() as any as Record<string | symbol, unknown>)[prop]
  },
})
