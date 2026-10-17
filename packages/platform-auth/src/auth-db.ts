import { AsyncLocalStorage } from 'node:async_hooks'
import type { Database } from '@nzila/db/client'
import { executeAuthContext } from '@nzila/db/auth-client'
import type { AuthExecutionContext } from '@nzila/db/auth-storage-authority'
import { getTableColumns, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

/**
 * Internal auth-bootstrap executor.
 *
 * Password login and session-cookie validation must resolve identity before
 * app.current_user_id exists, so they cannot use the ordinary tenant runtime
 * connection once auth tables are protected by self-only RLS. Production-like
 * deployments must provide AUTH_DATABASE_URL with dedicated gateway membership.
 * No ordinary or broad system credential fallback is permitted. Calling code
 * establishes an email/token lookup context, and promotes only after validation.
 * This API is server-internal: a userId in request input is never validation.
 */
const execution = new AsyncLocalStorage<{ executor: Database; context: AuthExecutionContext }>()

export function withAuthContext<T>(context: AuthExecutionContext, callback: () => Promise<T>): Promise<T> {
  if (execution.getStore())
    throw new Error('Nested auth principal scopes are forbidden; resolve credential before promotion')
  return executeAuthContext(context, executor => execution.run({ executor, context }, callback))
}

export function hasAuthContext(): boolean {
  return Boolean(execution.getStore())
}

export function getAuthContext(): AuthExecutionContext | undefined {
  return execution.getStore()?.context
}

/** Route-established contexts are checked, never replaced by request user IDs. */
export async function withAuthenticatedAuthContext<T>(userId: string, callback: () => Promise<T>): Promise<T> {
  const current = getAuthContext()
  if (current) {
    if (current.phase !== 'identity' || current.userId !== userId)
      throw new Error('Authenticated auth identity does not match requested user')
    return callback()
  }
  const { auth } = await import('./entra/server')
  const actor = await auth()
  if (!actor.userId || actor.userId !== userId) throw new Error('Authenticated auth identity required')
  return withAuthContext({ phase: 'identity', userId }, callback)
}

export async function withTenantAuthContext<T>(
  userId: string, organizationId: string, callback: () => Promise<T>,
): Promise<T> {
  const current = getAuthContext()
  if (current?.phase === 'tenant-admin' && current.userId === userId && current.organizationId === organizationId)
    return callback()
  if (current) throw new Error('Tenant auth context mismatch')
  const { auth } = await import('./entra/server')
  const actor = await auth()
  if (!actor.userId || actor.userId !== userId) throw new Error('Authenticated tenant actor required')
  return withAuthContext({ phase: 'tenant-admin', userId, organizationId }, async () => {
    const [membership] = await authDb.execute(sql`SELECT 1 FROM user_management.organization_users
      WHERE user_id=${userId} AND organization_id=${organizationId} AND is_active AND role='admin'`)
    if (!membership) throw new Error('Active organization administrator required')
    return callback()
  })
}

export async function checkAuthRequestRateLimit(maxRequests: number): Promise<boolean> {
  const context = getAuthContext()
  if (context?.phase !== 'issuance') throw new Error('Auth issuance context required')
  const scope = context.operation === 'magic-issue' ? context.email.trim().toLowerCase() : context.ipAddress
  if (!scope) return true
  await authDb.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(
    ${`auth:${context.operation}:${scope}`}, 0))`)
  const [row] = await authDb.execute(sql`SELECT user_management.auth_request_count(${context.operation},${scope}) AS count`)
  if (row?.count === null || row?.count === undefined) throw new Error('Auth request rate scope mismatch')
  return Number(row.count) < maxRequests
}

/** Preserve best-effort audit semantics without poisoning the auth transaction. */
export function withAuthSavepoint<T>(callback: () => Promise<T>): Promise<T> {
  const current = execution.getStore()
  if (!current) throw new Error('Auth execution context required')
  return current.executor.transaction(tx => execution.run({ ...current, executor: tx as unknown as Database }, callback))
}

export const authDb = new Proxy({} as Database, {
  get(_target, property) {
    const executor = execution.getStore()?.executor
    if (!executor) throw new Error('Auth execution context required; ordinary/system fallback is forbidden')
    const value = Reflect.get(executor, property)
    return typeof value === 'function' ? value.bind(executor) : value
  },
})

/**
 * Drizzle's regular INSERT includes DEFAULT for every schema column, requiring
 * INSERT authority on all of them. Keep operation-specific column grants real.
 */
export async function insertAuthRow<T extends PgTable>(
  table: T, values: Partial<T['$inferInsert']>,
): Promise<T['$inferSelect'][]> {
  const columns = getTableColumns(table)
  const entries = Object.entries(values).filter(([, value]) => value !== undefined)
  for (const [key] of entries) if (!columns[key]) throw new Error(`Unknown auth insert column ${key}`)
  const names = entries.map(([key]) => sql.identifier(columns[key]!.name))
  const parameters = entries.map(([key, value]) => sql`${value === null ? null : columns[key]!.mapToDriverValue(value)}`)
  const rows = await authDb.execute(sql`INSERT INTO ${table} (${sql.join(names, sql`,`)})
    VALUES (${sql.join(parameters, sql`,`)}) RETURNING *`)
  return rows.map(row => Object.fromEntries(Object.entries(columns).map(([key, column]) =>
    [key, row[column.name] === null ? null : column.mapFromDriverValue(row[column.name])])) as T['$inferSelect'])
}
