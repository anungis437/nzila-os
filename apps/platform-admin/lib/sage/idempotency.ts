/**
 * Platform Admin — SAGE idempotency cache selection (server-only)
 *
 * Chooses a DURABLE idempotency store whenever a database is configured, so
 * workspace-create idempotency survives multiple app instances, restarts,
 * serverless invocations, and horizontal scaling. The in-memory store is used
 * ONLY when no database is available (local dev / tests), never in production.
 *
 * This is deliberately stricter than `@nzila/os-core`'s
 * `getGlobalIdempotencyCache()` (which additionally gates on NZILA_ENV/NODE_ENV):
 * for SAGE we require durable idempotency whenever `DATABASE_URL` is present.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  InMemoryIdempotencyCache,
  PostgresIdempotencyCache,
  type IdempotencyCache,
} from '@nzila/os-core/idempotency'

let cache: IdempotencyCache | null = null

/** True when a durable (PostgreSQL-backed) idempotency store should be used. */
export function shouldUseDurableIdempotency(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/**
 * Return the process-wide SAGE idempotency cache. Durable (Postgres) whenever a
 * database is configured; in-memory only as a no-DB dev/test fallback.
 */
export function getSageIdempotencyCache(): IdempotencyCache {
  if (cache) return cache
  const created = shouldUseDurableIdempotency()
    ? new PostgresIdempotencyCache()
    : new InMemoryIdempotencyCache()
  cache = created
  return created
}
