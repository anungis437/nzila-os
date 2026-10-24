/**
 * Authority store — database access port and the transaction boundary.
 *
 * `SqlExecutor` is satisfied by a node-postgres client, a PGlite instance and a
 * Drizzle transaction adapter. The kernel's authority tables are written ONLY
 * through an executor that is inside `runAuthorityTransaction`, which pins the
 * tenant and actor GUCs the RLS policies and the recording triggers read.
 *
 * Atomicity contract: an authority mutation and its durable record
 * (ue_authority_events, written by a database trigger) are one statement's
 * consequence, so they commit or roll back together. Callers that also append
 * to the canonical audit chain MUST do so through the same executor, inside the
 * same `runAuthorityTransaction`, so the chain row shares that fate too.
 */

export interface SqlExecutor {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

export interface AuthorityContext {
  organizationId: string
  userId: string
}

export class AuthorityStoreError extends Error {
  constructor(
    public readonly code: 'INVALID_CONTEXT' | 'NOT_FOUND' | 'ALREADY_TERMINAL' | 'DENIED',
    message: string,
  ) {
    super(message)
    this.name = 'AuthorityStoreError'
  }
}

/**
 * Runs `fn` in one transaction on a DEDICATED connection (never a pool handle
 * shared across requests). Any thrown error rolls everything back.
 */
export async function runAuthorityTransaction<T>(
  connection: SqlExecutor,
  ctx: AuthorityContext,
  fn: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  if (!isUuid(ctx.organizationId) || !isUuid(ctx.userId)) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'organizationId and userId must be uuids')
  }
  await connection.query('BEGIN')
  try {
    await connection.query(
      `SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`,
      [ctx.organizationId, ctx.userId],
    )
    const result = await fn(connection)
    await connection.query('COMMIT')
    return result
  } catch (error) {
    try {
      await connection.query('ROLLBACK')
    } catch {
      // The original failure is the one that matters; a failed rollback leaves the transaction aborted.
    }
    throw error
  }
}
