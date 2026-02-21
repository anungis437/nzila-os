/**
 * Nzila OS — Drizzle Postgres client
 *
 * Reuse a single connection pool across the process.
 * DATABASE_URL comes from environment.
 *
 * Lazy initialization: the connection is only established on first use,
 * so importing this module at build time does not throw.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DbType = ReturnType<typeof drizzle<typeof schema>>

let _db: DbType | undefined

function getDb(): DbType {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required')
    }
    const sql = postgres(connectionString, { max: 10 })
    _db = drizzle(sql, { schema })
  }
  return _db
}

export const db = new Proxy({} as DbType, {
  get(_target, prop) {
    return (getDb() as any)[prop]
  },
  has(_target, prop) {
    return prop in getDb()
  },
}) as DbType

export type Database = DbType
