/**
 * Lazy Drizzle client for the orchestrator.
 *
 * Only initializes when DATABASE_URL is present.
 * The orchestrator can run without a DB (in-memory fallback).
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@nzila/db/schema'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (_db) return { db: _db, schema }

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const sql = postgres(url, { max: 5 })
  _db = drizzle(sql, { schema })
  return { db: _db, schema }
}
