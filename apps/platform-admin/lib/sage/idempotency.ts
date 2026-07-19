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
  isStrictEnvironment,
  type AtomicIdempotencyCache,
} from '@nzila/os-core/idempotency'

let cache: AtomicIdempotencyCache | null = null

/** True when a durable (PostgreSQL-backed) idempotency store should be used. */
export function shouldUseDurableIdempotency(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/**
 * Return the process-wide SAGE idempotency cache.
 *
 *  - DATABASE_URL present → durable PostgreSQL store.
 *  - No DATABASE_URL in a strict (pilot/prod) environment → FAIL CLOSED (throw).
 *    Production must never silently use process-local memory for idempotency.
 *  - No DATABASE_URL in dev/test → in-memory fallback (explicitly permitted).
 *
 * Both implementations satisfy `AtomicIdempotencyCache`, so callers get atomic
 * first-writer acquisition (see `runIdempotentMutation`) rather than the
 * non-atomic check→mutate→set flow.
 */
export function getSageIdempotencyCache(): AtomicIdempotencyCache {
  if (cache) return cache
  if (shouldUseDurableIdempotency()) {
    cache = new PostgresIdempotencyCache()
    return cache
  }
  if (isStrictEnvironment()) {
    throw new Error(
      'SAGE idempotency requires DATABASE_URL in production (pilot/prod): refusing to fall back to ' +
        'in-memory idempotency. Set DATABASE_URL so replay protection is durable across instances.',
    )
  }
  cache = new InMemoryIdempotencyCache()
  return cache
}
