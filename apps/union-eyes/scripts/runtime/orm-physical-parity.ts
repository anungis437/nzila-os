/**
 * ORM <-> physical schema parity sweep (dev tooling).
 *
 * Compares every Drizzle table the application declares with the physical database built by Django migrate plus the approved
 * bootstrap, and reports two defect classes the runtime acceptance suite found by accident:
 *
 *   NO_DB_DEFAULT  a NOT NULL column with no database default, whose ORM declaration has a `default` (so the ORM emits the SQL
 *                  keyword DEFAULT) but no client-side `$defaultFn`: an insert that omits the column fails (R-16).
 *   TYPE_MISMATCH  the ORM and the physical column disagree on type family, e.g. uuid vs text (R-17).
 *
 * Read-only. Usage: DATABASE_URL=... tsx scripts/runtime/orm-physical-parity.ts [--json]
 */
import pg from 'pg'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { is, Table } from 'drizzle-orm'
import * as schema from '@/db/schema'

interface Finding {
  kind: 'NO_DB_DEFAULT' | 'TYPE_MISMATCH' | 'MISSING_COLUMN'
  table: string
  column: string
  detail: string
}

const family = (sqlType: string): string => {
  const t = sqlType.toLowerCase()
  if (t.startsWith('uuid')) return 'uuid'
  if (/^(timestamp|date|time)/.test(t)) return 'time'
  if (/^(varchar|character varying|text|char|citext)/.test(t)) return 'text'
  if (/^(int|smallint|bigint|serial|bigserial|numeric|decimal|real|double)/.test(t)) return 'number'
  if (t.startsWith('bool')) return 'bool'
  if (/^(json)/.test(t)) return 'json'
  // Anything else is an ORM enum name: a pgEnum is stored as varchar or text by the Django lineage, or as a native enum.
  return 'enum'
}
const physicalFamily = (dataType: string, udt: string): string => {
  if (dataType === 'USER-DEFINED') return 'enum'
  if (dataType === 'ARRAY') return 'array'
  return family(dataType === 'character varying' ? 'varchar' : dataType)
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  const findings: Finding[] = []
  let tables = 0
  try {
    const physical = new Map<string, Map<string, { nullable: boolean; hasDefault: boolean; dataType: string; udt: string }>>()
    const rows = (
      await client.query(
        `SELECT table_schema, table_name, column_name, is_nullable, column_default, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public'`,
      )
    ).rows
    for (const r of rows) {
      const key = String(r.table_name)
      if (!physical.has(key)) physical.set(key, new Map())
      physical.get(key)!.set(String(r.column_name), { nullable: r.is_nullable === 'YES', hasDefault: r.column_default !== null, dataType: String(r.data_type), udt: String(r.udt_name) })
    }
    for (const value of Object.values(schema as Record<string, unknown>)) {
      if (!value || typeof value !== 'object' || !is(value, Table)) continue
      const config = getTableConfig(value as PgTable)
      if (config.schema && config.schema !== 'public') continue
      const phys = physical.get(config.name)
      if (!phys) continue
      tables += 1
      for (const column of config.columns) {
        const p = phys.get(column.name)
        if (!p) {
          findings.push({ kind: 'MISSING_COLUMN', table: config.name, column: column.name, detail: 'declared by the ORM, absent from the database' })
          continue
        }
        const ormFamily = family(column.getSQLType())
        const dbFamily = physicalFamily(p.dataType, p.udt)
        const enumLike = ormFamily === 'enum' && (dbFamily === 'text' || dbFamily === 'enum')
        const comparable = ormFamily !== 'enum' && dbFamily !== 'enum' && dbFamily !== 'array' && !enumLike
        // numeric amounts stored as varchar and text-vs-varchar are representation choices, not insert or key failures.
        const tolerated = (ormFamily === 'number' && dbFamily === 'text') || (ormFamily === 'time' && dbFamily === 'time')
        if (comparable && !tolerated && ormFamily !== dbFamily) {
          findings.push({ kind: 'TYPE_MISMATCH', table: config.name, column: column.name, detail: `ORM ${column.getSQLType()} vs database ${p.dataType}` })
        }
        const clientDefault = (column as unknown as { defaultFn?: unknown }).defaultFn !== undefined
        if (!p.nullable && !p.hasDefault && column.hasDefault && !clientDefault) {
          findings.push({ kind: 'NO_DB_DEFAULT', table: config.name, column: column.name, detail: 'NOT NULL, no database default, ORM relies on the DEFAULT keyword' })
        }
      }
    }
  } finally {
    await client.end()
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify({ tables, findings }, null, 2))
  else {
    console.log(`parity sweep: ${tables} tables compared, ${findings.length} finding(s)`)
    for (const f of findings) console.log(`${f.kind}\t${f.table}.${f.column}\t${f.detail}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
