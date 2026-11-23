/**
 * Platform Admin — SAGE SQL client adapter (server-only)
 *
 * Provides a `SageSqlClient` backed by the platform PostgreSQL connection so the
 * `PostgresSageRepository` (from `@nzila/sage-core`) can run parameterized SQL
 * against the raw `sage_*` tables (migrations 0032/0033).
 *
 * The `sage_*` tables are created by raw SQL migrations and are NOT part of the
 * Drizzle schema, so we execute parameterized statements through the underlying
 * postgres.js client (`$client.unsafe(text, params)`), which uses `$1`-style
 * placeholders — never string interpolation.
 *
 * This module is server-only: it must never be imported into a client bundle.
 */
import 'server-only'
import { platformDb } from '@nzila/db/platform'
import type { SageSqlClient } from '@nzila/sage-core'

// postgres.js exposes `unsafe(query, params)` which runs a parameterized query
// with `$1`-style placeholders and resolves to an array of row objects.
type PostgresUnsafe = {
  unsafe: (query: string, params?: readonly unknown[]) => Promise<unknown[]>
  begin?: <T>(fn: (tx: PostgresUnsafe) => Promise<T>) => Promise<T>
}

function getUnsafeClient(): PostgresUnsafe {
  const client = (platformDb as unknown as { $client?: PostgresUnsafe }).$client
  if (!client || typeof client.unsafe !== 'function') {
    throw new Error('SAGE SQL client: underlying postgres client is unavailable')
  }
  return client
}

function asSageSqlClient(client: PostgresUnsafe): SageSqlClient {
  return {
    async query<T = unknown>(
      text: string,
      params: readonly unknown[] = [],
    ): Promise<{ rows: T[] }> {
      const rows = await client.unsafe(text, params)
      return { rows: rows as T[] }
    },
  }
}

/**
 * Create a `SageSqlClient` bound to the platform database connection.
 * Parameters are always passed positionally ($1, $2, …) — no interpolation.
 */
export function createSagePlatformSqlClient(): SageSqlClient {
  return asSageSqlClient(getUnsafeClient())
}

/**
 * Run `fn` inside a single postgres.js transaction so mandate FOR UPDATE locks,
 * ledger reads and institutional action inserts share one atomic boundary.
 */
export async function withSagePlatformTransaction<T>(
  fn: (sql: SageSqlClient) => Promise<T>,
): Promise<T> {
  const client = getUnsafeClient()
  if (typeof client.begin !== 'function') {
    throw new Error('SAGE SQL client: transactional begin() is unavailable')
  }
  return client.begin(async (tx) => fn(asSageSqlClient(tx)))
}
