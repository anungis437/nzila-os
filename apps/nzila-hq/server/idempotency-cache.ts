/**
 * Nzila HQ idempotency cache selection (server-only).
 */
import 'server-only'
import {
  InMemoryIdempotencyCache,
  PostgresIdempotencyCache,
  isStrictEnvironment,
  type AtomicIdempotencyCache,
} from '@nzila/os-core/idempotency'

let cache: AtomicIdempotencyCache | null = null

export function getHqIdempotencyCache(): AtomicIdempotencyCache {
  if (cache) return cache
  if (process.env.DATABASE_URL) {
    cache = new PostgresIdempotencyCache()
    return cache
  }
  if (isStrictEnvironment()) {
    throw new Error(
      'Nzila HQ idempotency requires DATABASE_URL in production (pilot/prod); refusing in-memory fallback.',
    )
  }
  cache = new InMemoryIdempotencyCache()
  return cache
}
