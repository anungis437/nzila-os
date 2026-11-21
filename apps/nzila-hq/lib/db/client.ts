import 'server-only'
import { createPostgresDatabase } from '@nzila/db/postgres-factory'
import * as schema from '../../server/db/schema'

type DbType = ReturnType<typeof createPostgresDatabase<typeof schema>>
let db: DbType | undefined

export function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/** Lazy and optional: importing HQ does not require a live connection. */
export function getHqDb(): DbType | null {
  if (db) return db
  const url = process.env.DATABASE_URL
  if (!url) return null
  db = createPostgresDatabase(url, schema, {
    max: Number(process.env.NZILA_HQ_DB_POOL_MAX ?? '5'),
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  })
  return db
}

export { schema }
