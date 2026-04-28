/**
 * Drizzle DB client for Nzila HQ.
 *
 * Lazy singleton + Proxy so `next build` doesn't need a live DB connection,
 * matching the pattern used by `apps/union-eyes`. The cockpit treats the DB
 * as optional — if `DATABASE_URL` is absent, `db` is null and the persistence
 * layer falls back to in-memory derivation. This keeps dev-mode and CI green
 * even without Postgres while letting staging/prod read live tables.
 */
import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DbType = PostgresJsDatabase<typeof schema>

let _client: ReturnType<typeof postgres> | undefined
let _db: DbType | undefined

function getClient() {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  if (!_client) {
    _client = postgres(url, {
      max: Number(process.env.NZILA_HQ_DB_POOL_MAX ?? '5'),
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    })
  }
  return _client
}

function getDb(): DbType | undefined {
  if (_db) return _db
  const client = getClient()
  if (!client) return undefined
  _db = drizzle(client, { schema })
  return _db
}

export function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/**
 * Returns the Drizzle DB instance or null when DATABASE_URL is unset.
 * Callers MUST handle the null case — never assume persistence is available.
 */
export function getHqDb(): DbType | null {
  return getDb() ?? null
}

export { schema }
