/** Current declaration UUID defaults, checked by bound function identity.
 * No grants, default rewrites, stored-row changes or expression normalization. */
import { is, SQL } from 'drizzle-orm'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { platformIdentityBindings } from '../../../../packages/db/src/schema/platform-authorization'
import {
  externalReadConsents,
  externalReadQualifications,
} from '../../db/schema/domains/documents/external-read'
import type { V2Plan } from './source'

/** pg_catalog is deliberately implicit: PostgreSQL searches it first for
 * functions, while public remains the first explicit table creation schema. */
export const CURRENT_PUBLIC_TABLE_CREATION_SQL = 'SET LOCAL search_path = public, pg_temp'

export interface CurrentUuidDefaultRequirement {
  schema: 'public'
  table: string
  column: string
  source: string
}
export interface CurrentUuidDefaultRow {
  schema: string
  table: string
  column: string
  type: string
  default_expression: string | null
  function_oids: string[]
  builtin_oid: string | null
}
const declarations = [
  {
    source: 'packages/db/src/schema/platform-authorization.ts',
    declaration: platformIdentityBindings,
  },
  {
    source: 'apps/union-eyes/db/schema/domains/documents/external-read.ts',
    declaration: externalReadConsents,
  },
  {
    source: 'apps/union-eyes/db/schema/domains/documents/external-read.ts',
    declaration: externalReadQualifications,
  },
] as const

export function currentUuidDefaultRequirements(
  plan: Pick<V2Plan, 'tables'>,
): CurrentUuidDefaultRequirement[] {
  const requirements: CurrentUuidDefaultRequirement[] = []
  const dialect = new PgDialect()
  for (const entry of declarations) {
    const config = getTableConfig(entry.declaration)
    if (config.schema && config.schema !== 'public')
      throw new Error('UE_V2_UUID_DEFAULT_SOURCE_SCHEMA_REQUIRED')
    const planned = plan.tables.filter((table) => table.name === config.name)
    if (!planned.length) continue
    if (planned.length !== 1 || planned[0].source !== entry.source)
      throw new Error('UE_V2_UUID_DEFAULT_CURRENT_DECLARATION_REQUIRED')
    for (const column of config.columns.filter(
      (column) => column.getSQLType() === 'uuid' && column.hasDefault,
    )) {
      if (!is(column.default, SQL)) throw new Error('UE_V2_UUID_DEFAULT_SQL_SOURCE_REQUIRED')
      const expression = dialect.sqlToQuery(column.default)
      if (
        expression.params.length ||
        !/^(?:pg_catalog\.)?gen_random_uuid\(\)$/.test(expression.sql)
      )
        throw new Error('UE_V2_UUID_DEFAULT_BUILTIN_SOURCE_REQUIRED')
      const actualColumn = planned[0].columns.find((actual) => actual.name === column.name)
      if (!actualColumn || actualColumn.type !== 'uuid' || actualColumn.notNull !== column.notNull)
        throw new Error('UE_V2_UUID_DEFAULT_CURRENT_COLUMN_REQUIRED')
      requirements.push({
        schema: 'public',
        table: config.name,
        column: column.name,
        source: entry.source,
      })
    }
  }
  return requirements
}

/** Explicit pg_catalog names and resolved node OIDs avoid search_path-sensitive
 * deparsing. Pinned builtin functions need not appear in pg_depend; the stored
 * FuncExpr is still bound to their real OID. Text arrays are explicit for PG15. */
export const CURRENT_UUID_DEFAULT_BINDING_QUERY = `SELECT n.nspname::text AS schema,c.relname::text AS table,a.attname::text AS column,
  pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression,
  ARRAY(SELECT matched[1]::text FROM pg_catalog.regexp_matches(d.adbin::text,':funcid ([0-9]+)','g') AS calls(matched)) AS function_oids,
  pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()')::oid::text AS builtin_oid
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
  ORDER BY c.relname,a.attnum`

export function currentUuidDefaultBindingFailures(
  requirements: readonly CurrentUuidDefaultRequirement[],
  rows: readonly CurrentUuidDefaultRow[],
): string[] {
  const failures: string[] = []
  for (const requirement of requirements) {
    const key = `${requirement.schema}.${requirement.table}.${requirement.column}`
    const matching = rows.filter(
      (row) =>
        row.schema === requirement.schema &&
        row.table === requirement.table &&
        row.column === requirement.column,
    )
    if (matching.length !== 1) {
      failures.push(`${key}:MISSING_OR_DUPLICATE`)
      continue
    }
    const row = matching[0]
    if (row.type !== 'uuid') failures.push(`${key}:TYPE`)
    if (!row.builtin_oid || !/^[0-9]+$/.test(row.builtin_oid))
      failures.push(`${key}:BUILTIN_MISSING`)
    if (
      !row.default_expression ||
      !/^(?:pg_catalog\.)?gen_random_uuid\(\)$/.test(row.default_expression.trim())
    )
      failures.push(`${key}:EXPRESSION`)
    if (
      !Array.isArray(row.function_oids) ||
      row.function_oids.length !== 1 ||
      row.function_oids[0] !== row.builtin_oid
    )
      failures.push(`${key}:FUNCTION_BINDING`)
  }
  return failures
}

export async function verifyCurrentUuidDefaultBindings(
  plan: Pick<V2Plan, 'tables'>,
  execute: (sql: string, parameters: unknown[]) => Promise<CurrentUuidDefaultRow[]>,
) {
  const requirements = currentUuidDefaultRequirements(plan)
  if (!requirements.length) return { checkedColumns: 0 }
  const tables = [...new Set(requirements.map((requirement) => requirement.table))]
  const failures = currentUuidDefaultBindingFailures(
    requirements,
    await execute(CURRENT_UUID_DEFAULT_BINDING_QUERY, [tables]),
  )
  if (failures.length)
    throw new Error('UE_V2_UUID_DEFAULT_BINDING_DENIED:' + failures.sort().join(','))
  return { checkedColumns: requirements.length }
}
