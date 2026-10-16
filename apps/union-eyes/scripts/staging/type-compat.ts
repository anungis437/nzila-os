import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import { folder, root, type V2Plan } from '../bootstrap-v2/source'

/** Staging finding aid: type-family mismatches between Drizzle declarations and Canonical V2 columns. */
const plan: V2Plan = JSON.parse(
  readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
)
const load = createRequire(import.meta.url)
const declarations: Record<string, unknown> = load(
  path.join(root, 'apps', 'union-eyes', 'db', 'schema', 'index.ts'),
)
const family = (type: string) => {
  const t = type.toLowerCase()
  if (t.startsWith('uuid')) return 'uuid'
  if (/^(text|varchar|character varying|char|character)/.test(t)) return 'text'
  if (/^(int|integer|smallint|bigint|serial)/.test(t)) return 'int'
  if (/^(numeric|decimal|real|double|float)/.test(t)) return 'num'
  if (/^timestamp|^date|^time/.test(t)) return 'time'
  if (/^bool/.test(t)) return 'bool'
  if (/^json/.test(t)) return 'json'
  return t.split(/[ (]/)[0]
}
const canonical = new Map(
  plan.tables.map((table) => [table.name, new Map(table.columns.map((c) => [c.name, c]))]),
)
const seen = new Set<string>()
const rows: { table: string; column: string; app: string; v2: string }[] = []
for (const value of Object.values(declarations)) {
  if (!is(value, PgTable)) continue
  const config = getTableConfig(value)
  const qualified =
    config.schema && config.schema !== 'public' ? `${config.schema}.${config.name}` : config.name
  if (seen.has(qualified)) continue
  seen.add(qualified)
  const columns = canonical.get(qualified)
  if (!columns) continue
  for (const column of config.columns) {
    const v2 = columns.get(column.name) as unknown as
      | { type?: string; sqlType?: string }
      | undefined
    if (!v2) continue
    const v2Type = String(v2.type ?? v2.sqlType ?? '')
    const appType = column.getSQLType()
    if (family(appType) !== family(v2Type))
      rows.push({ table: qualified, column: column.name, app: appType, v2: v2Type })
  }
}
writeFileSync(process.argv[2], JSON.stringify(rows, null, 1))
const byPair = new Map<string, number>()
for (const r of rows)
  byPair.set(
    `${family(r.app)}->${family(r.v2)}`,
    (byPair.get(`${family(r.app)}->${family(r.v2)}`) ?? 0) + 1,
  )
process.stdout.write(
  JSON.stringify({
    mismatches: rows.length,
    tables: new Set(rows.map((r) => r.table)).size,
    byPair: Object.fromEntries(byPair),
  }) + '\n',
)
