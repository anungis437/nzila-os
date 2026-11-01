/**
 * Runtime select probe: runs the SELECT that Drizzle builds for every declared table (every declared column) against a real database
 * and reports each one the database cannot serve (UE-CONV-H-007).
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/runtime/orm-select-probe.ts [outputFile.json]
 *
 * The parity sweep (orm-physical-parity.ts) compares declarations with information_schema; this asks the database itself, so it also catches
 * a column the sweep cannot see (a type the driver cannot decode, a missing relation). A failure code of 42703 is an undefined column and
 * 42P01 an undefined relation; 42501 would be a missing privilege, which this probe does not expect because it connects as the owner.
 * The database must be built as the application builds it: Django `migrate`, then tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs.
 */
import { writeFileSync } from 'node:fs'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import * as schema from '@/db/schema'

interface Outcome { ok: boolean; code?: string; message?: string }

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL must point at the database to probe')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  const db = drizzle(client)
  const outcomes: Record<string, Outcome> = {}
  const seen = new Set<string>()
  try {
    for (const value of Object.values(schema as Record<string, unknown>)) {
      if (!is(value, PgTable)) continue
      const config = getTableConfig(value)
      const key = `${config.schema ?? 'public'}.${config.name}`
      if (seen.has(key)) continue
      seen.add(key)
      try {
        await db.select().from(value).limit(0)
        outcomes[config.name] = { ok: true }
      } catch (error) {
        const e = error as { code?: string; message?: string; cause?: { code?: string; message?: string } }
        outcomes[config.name] = { ok: false, code: e.cause?.code ?? e.code, message: (e.cause?.message ?? e.message ?? '').slice(0, 160) }
      }
    }
  } finally {
    await client.end()
  }
  const failing = Object.entries(outcomes).filter(([, outcome]) => !outcome.ok)
  const byCode = failing.reduce<Record<string, number>>((counts, [, outcome]) => ({ ...counts, [outcome.code ?? 'unknown']: (counts[outcome.code ?? 'unknown'] ?? 0) + 1 }), {})
  const outputFile = process.argv[2]
  if (outputFile) writeFileSync(outputFile, JSON.stringify(outcomes))
  console.log(`probed ${Object.keys(outcomes).length} declared tables, ${failing.length} fail a plain select ${JSON.stringify(byCode)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
