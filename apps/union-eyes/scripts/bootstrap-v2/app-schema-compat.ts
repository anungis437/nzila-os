import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import { folder, root, type V2Plan } from './source'

/**
 * Static compatibility between the Drizzle declarations the Next application actually queries
 * and the Canonical V2 tables. A mismatch means a current caller can select/insert a column or
 * relation that a fresh V2 database does not contain.
 */
export function compareApplicationSchema(plan: V2Plan) {
  const load = createRequire(import.meta.url)
  const declarations: Record<string, unknown> = load(
    path.join(root, 'apps', 'union-eyes', 'db', 'schema', 'index.ts'),
  )
  const canonical = new Map(
    plan.tables.map((table) => [table.name, new Set(table.columns.map((column) => column.name))]),
  )
  const excluded = new Set(plan.exclusions.map((entry) => entry.table))
  const seen = new Set<string>()
  const entries: {
    table: string
    status: 'OK' | 'ABSENT_IN_V2' | 'EXCLUDED_IN_V2' | 'COLUMNS_MISSING_IN_V2'
    missingColumns: string[]
  }[] = []
  for (const value of Object.values(declarations)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    const qualified =
      config.schema && config.schema !== 'public' ? `${config.schema}.${config.name}` : config.name
    if (seen.has(qualified)) continue
    seen.add(qualified)
    const columns = canonical.get(qualified)
    if (!columns) {
      entries.push({
        table: qualified,
        status: excluded.has(qualified) ? 'EXCLUDED_IN_V2' : 'ABSENT_IN_V2',
        missingColumns: [],
      })
      continue
    }
    const missing = config.columns.map((column) => column.name).filter((name) => !columns.has(name))
    entries.push({
      table: qualified,
      status: missing.length ? 'COLUMNS_MISSING_IN_V2' : 'OK',
      missingColumns: missing,
    })
  }
  return entries.sort((left, right) => left.table.localeCompare(right.table))
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]).replaceAll('\\', '/'))
) {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  const entries = compareApplicationSchema(plan)
  const summary = Object.fromEntries(
    ['OK', 'ABSENT_IN_V2', 'EXCLUDED_IN_V2', 'COLUMNS_MISSING_IN_V2'].map((status) => [
      status,
      entries.filter((entry) => entry.status === status).length,
    ]),
  )
  const output = {
    generatedFromSourcePlanDigest: plan.sourceCommitments ? 'see plan' : '',
    summary,
    entries,
  }
  const target = process.argv[2]
  if (target) {
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`)
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`)
}
