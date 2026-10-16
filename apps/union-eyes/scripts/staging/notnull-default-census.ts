import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import pg from 'pg'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import { root } from '../bootstrap-v2/source'

/**
 * Staging finding aid: columns that are NOT NULL without a database default in the canonical schema
 * while the Drizzle declaration lets an insert omit them (Drizzle then sends DEFAULT, i.e. NULL).
 */
const load = createRequire(import.meta.url)
const declarations: Record<string, unknown> = load(
  path.join(root, 'apps', 'union-eyes', 'db', 'schema', 'index.ts'),
)
async function main() {
  const client = new pg.Client({
    host: 'nzila-ue-v2-staging-db.postgres.database.azure.com',
    user: 'uev2admin',
    password: readFileSync(
      path.join(process.env.TEMP!, 'ue-v2-staging-secrets', 'pgadmin.txt'),
      'utf8',
    ),
    database: 'ue_v2_staging',
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const catalog = await client.query(
    `SELECT table_schema, table_name, column_name FROM information_schema.columns
     WHERE table_schema IN ('public','user_management') AND is_nullable='NO' AND column_default IS NULL
       AND is_identity='NO' AND is_generated='NEVER'`,
  )
  await client.end()
  const required = new Set(
    catalog.rows.map(
      (r) =>
        `${r.table_schema === 'public' ? '' : r.table_schema + '.'}${r.table_name}.${r.column_name}`,
    ),
  )
  const seen = new Set<string>()
  const rows: { table: string; column: string; reason: string }[] = []
  for (const value of Object.values(declarations)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    const qualified =
      config.schema && config.schema !== 'public' ? `${config.schema}.${config.name}` : config.name
    if (seen.has(qualified)) continue
    seen.add(qualified)
    for (const column of config.columns) {
      if (!required.has(`${qualified}.${column.name}`)) continue
      if (!column.notNull)
        rows.push({ table: qualified, column: column.name, reason: 'ORM_OPTIONAL_DB_REQUIRED' })
      else if (column.hasDefault)
        rows.push({ table: qualified, column: column.name, reason: 'ORM_DB_DEFAULT_ABSENT' })
    }
  }
  writeFileSync(process.argv[2], JSON.stringify(rows, null, 1))
  process.stdout.write(
    JSON.stringify({
      dbRequiredNoDefault: required.size,
      ormMayOmit: rows.length,
      tables: new Set(rows.map((r) => r.table)).size,
    }) + '\n',
  )
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
