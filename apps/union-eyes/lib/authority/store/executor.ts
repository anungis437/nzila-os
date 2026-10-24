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

/**
 * Internal principal id: the canonical `user_management.users.user_id`
 * (varchar(255), NOT necessarily a uuid). Mirrors the ue_authority_principal
 * domain. An external provider subject must never be passed here; resolve it
 * through `resolveInternalPrincipal` first.
 */
export const isPrincipalId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= 1 &&
  value.length <= 255 &&
  value === value.trim() &&
  !/[\u0000-\u001f\u007f]/.test(value)

export interface AuthorityContext {
  organizationId: string
  userId: string
}

/**
 * Parses a one-dimensional Postgres text-array literal. Drivers return arrays of
 * DOMAIN types (e.g. ue_authority_principal[]) as raw `{a,"b c"}` strings because
 * the element type is unknown to them, so every loader must tolerate both forms.
 * Anything it cannot parse faithfully is an error, never a silent empty list.
 */
export function parsePgTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (value === null || value === undefined) return []
  if (typeof value !== 'string' || !value.startsWith('{') || !value.endsWith('}')) {
    throw new Error(`unparseable array value: ${String(value)}`)
  }
  const body = value.slice(1, -1)
  if (body === '') return []
  const out: string[] = []
  let i = 0
  while (i <= body.length) {
    if (body[i] === '"') {
      let item = ''
      i++
      while (i < body.length && body[i] !== '"') {
        if (body[i] === '\\') i++
        item += body[i++]
      }
      if (body[i] !== '"') throw new Error('unterminated quoted array element')
      i++
      out.push(item)
    } else {
      let j = i
      while (j < body.length && body[j] !== ',') j++
      const raw = body.slice(i, j)
      if (raw === 'NULL') throw new Error('NULL array element')
      out.push(raw)
      i = j
    }
    if (i >= body.length) break
    if (body[i] !== ',') throw new Error('malformed array literal')
    i++
  }
  return out
}

export class AuthorityStoreError extends Error {
  constructor(
    public readonly code: 'INVALID_CONTEXT' | 'NOT_FOUND' | 'ALREADY_TERMINAL' | 'DENIED' | 'IDEMPOTENCY_CONFLICT' | 'PRECONDITION',
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
  if (!isUuid(ctx.organizationId) || !isPrincipalId(ctx.userId)) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'organizationId must be a uuid and userId a valid internal principal id')
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
