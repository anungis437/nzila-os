/**
 * Authority store — idempotent execution.
 *
 * A retried or duplicated request must neither repeat a mutation nor write a
 * second audit row. The idempotency record is written in the SAME transaction as
 * the operation it guards, so:
 *   - a crash or rollback removes the record with the operation, and a retry runs it;
 *   - a committed operation is replayed from its stored result;
 *   - two concurrent copies serialise on the unique key: one runs, the other
 *     waits for it to commit and then replays.
 * Reusing a key with a different payload is refused, never silently replayed.
 */
import { createHash } from 'node:crypto'
import { AuthorityStoreError, isPrincipalId, isUuid, type SqlExecutor } from './executor'

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
}

export const requestHash = (operation: string, payload: unknown): string =>
  createHash('sha256').update(stable({ operation, payload })).digest('hex')

export async function runIdempotent<T extends Record<string, unknown>>(
  exec: SqlExecutor,
  input: { organizationId: string; actorUserId: string; key: string; operation: string; payload: unknown },
  fn: () => Promise<T>,
): Promise<{ replayed: boolean; result: T }> {
  if (!isUuid(input.organizationId) || !isPrincipalId(input.actorUserId)) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'invalid organization or actor')
  }
  const hash = requestHash(input.operation, input.payload)
  const inserted = await exec.query<{ id: string }>(
    `INSERT INTO ue_authority_requests (organization_id, idempotency_key, operation, request_hash, actor)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, idempotency_key) DO NOTHING RETURNING id::text AS id`,
    [input.organizationId, input.key, input.operation, hash, input.actorUserId],
  )
  if (inserted.rows.length === 1) {
    const result = await fn()
    await exec.query(`UPDATE ue_authority_requests SET result = $2::jsonb WHERE id = $1::uuid`, [inserted.rows[0].id, JSON.stringify(result)])
    return { replayed: false, result }
  }
  const existing = (
    await exec.query<{ request_hash: string; operation: string; result: T | null }>(
      `SELECT request_hash, operation, result FROM ue_authority_requests WHERE organization_id = $1 AND idempotency_key = $2`,
      [input.organizationId, input.key],
    )
  ).rows[0]
  if (!existing) throw new AuthorityStoreError('PRECONDITION', 'idempotency record vanished; retry the request')
  if (existing.request_hash !== hash || existing.operation !== input.operation) {
    throw new AuthorityStoreError('IDEMPOTENCY_CONFLICT', 'this idempotency key was used for a different request')
  }
  if (existing.result === null) throw new AuthorityStoreError('PRECONDITION', 'the original request has not completed; retry')
  return { replayed: true, result: existing.result }
}
