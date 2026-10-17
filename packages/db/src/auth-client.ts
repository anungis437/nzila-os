import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema'
import {
  AUTH_EXECUTION_ROLES,
  authContextSettings,
  authExecutionRole,
  type AuthExecutionContext,
} from './auth-storage-authority/execution-boundary'
import type { Database } from './client'

const pools = new Map<string, ReturnType<typeof drizzle<typeof schema>>>()
const connections = new Map<string, ReturnType<typeof postgres>>()

/** Graceful application/test shutdown; never terminates another process's pool. */
export async function closeAuthClients(): Promise<void> {
  await Promise.all([...connections.values()].map(connection => connection.end()))
  pools.clear()
  connections.clear()
}

/**
 * Dedicated credentials only. GUCs are authority only within the auth role;
 * runtime can set identical strings but has neither grants nor membership.
 */
export async function executeAuthContext<T>(
  context: AuthExecutionContext,
  callback: (executor: Database) => Promise<T>,
): Promise<T> {
  const settings = authContextSettings(context)
  const system = ['system', 'lifecycle', 'cleanup', 'mfa-admin'].includes(context.phase)
  const variable = system ? 'AUTH_SYSTEM_DATABASE_URL' : 'AUTH_DATABASE_URL'
  const url = process.env[variable]
  if (!url) throw new Error(`${variable} is required for scoped auth execution; ordinary/system fallback is forbidden`)
  const poolKey = `${variable}:${url}`
  let client = pools.get(poolKey)
  if (!client) {
    const connection = postgres(url, { max: 5, idle_timeout: 30, prepare: false })
    client = drizzle(connection, { schema })
    connections.set(poolKey, connection)
    pools.set(poolKey, client)
  }
  const gateway = system ? AUTH_EXECUTION_ROLES.systemGateway : AUTH_EXECUTION_ROLES.gateway
  const role = authExecutionRole(context)
  return client.transaction(async tx => {
    const [principal] = await tx.execute(sql`
      SELECT r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolinherit, r.rolcanlogin,
        pg_has_role(session_user, ${gateway}, 'MEMBER') AS gateway,
        pg_has_role(session_user, ${system ? AUTH_EXECUTION_ROLES.gateway : AUTH_EXECUTION_ROLES.systemGateway}, 'MEMBER') AS other_gateway,
        EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='user_management' AND c.relowner=r.oid) AS owns_auth
      FROM pg_roles r WHERE r.rolname=session_user`)
    if (!principal?.gateway || principal.other_gateway || principal.rolsuper ||
        principal.rolbypassrls || principal.rolcreatedb || principal.rolcreaterole || principal.rolinherit ||
        !principal.rolcanlogin || principal.owns_auth)
      throw new Error('Unsafe auth database principal: dedicated non-owner gateway membership required')
    await tx.execute(sql.raw(`SET LOCAL ROLE "${role}"`))
    for (const [key, value] of Object.entries(settings))
      await tx.execute(sql`SELECT set_config(${key}, ${value}, true)`)
    return callback(tx as unknown as Database)
  })
}
