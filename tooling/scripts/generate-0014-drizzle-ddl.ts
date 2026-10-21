/**
 * Emit forward platform SQL for the current Drizzle relations that 0014
 * requires and that the production runner does not already create.
 *
 * The statement text comes from drizzle-kit's generateMigration, the same
 * API Bootstrap V2 uses. This file does not invent a second type system.
 * An existing relation is checked and left unchanged. A missing required
 * column, type, or nullability fails the migration.
 */
import { is } from 'drizzle-orm'
import { getTableConfig, isPgEnum, PgTable, type PgEnum } from 'drizzle-orm/pg-core'
import * as schema from '../../apps/union-eyes/db/schema/index'
import * as ingestion from '../../apps/union-eyes/db/schema/ingestion-schema'
import * as deadline from '../../apps/union-eyes/db/schema/deadline-engine-schema'

const BUILTIN = new Set([
  'uuid',
  'text',
  'integer',
  'bigint',
  'smallint',
  'boolean',
  'jsonb',
  'json',
  'date',
  'bytea',
  'real',
  'numeric',
  'varchar',
  'timestamp',
  'time',
  'interval',
  'double',
])

type ColumnContract = {
  name: string
  dataType: string
  udt: string
  nullable: 'YES' | 'NO'
  charLen: number | null
  numericPrecision: number | null
  numericScale: number | null
}

function modules(): unknown[] {
  return [schema, ingestion, deadline].flatMap((mod) => Object.values(mod))
}

function tablesByName(names: Set<string>): Record<string, PgTable> {
  const selected: Record<string, PgTable> = {}
  for (const value of modules()) {
    if (!is(value, PgTable)) continue
    const name = getTableConfig(value).name
    if (names.has(name)) selected[name] = value
  }
  return selected
}

function enumsByName(): Map<string, PgEnum<readonly [string, ...string[]]>> {
  const found = new Map<string, PgEnum<readonly [string, ...string[]]>>()
  for (const value of modules()) {
    if (isPgEnum(value)) found.set(value.enumName, value)
  }
  return found
}

function referencedEnums(sql: string, available: Map<string, PgEnum<readonly [string, ...string[]]>>) {
  const used = new Map<string, PgEnum<readonly [string, ...string[]]>>()
  for (const [typeName, enumValue] of available) {
    const pattern = new RegExp(`(?:^|[^a-z0-9_])"?${typeName}"?(?![a-z0-9_])`)
    if (pattern.test(sql)) used.set(typeName, enumValue)
  }
  return used
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function columnContracts(createSql: string): ColumnContract[] {
  const body = createSql.slice(createSql.indexOf('(') + 1, createSql.lastIndexOf(')'))
  const contracts: ColumnContract[] = []
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim().replace(/,$/, '')
    const match = line.match(/^"([a-z0-9_]+)"\s+(.+)$/)
    if (!match) continue
    const name = match[1]
    const rest = match[2]
    const nullable = /\bNOT NULL\b/.test(rest) ? 'NO' : 'YES'
    let dataType = 'USER-DEFINED'
    let udt = ''
    if (rest.startsWith('uuid')) {
      dataType = 'uuid'
      udt = 'uuid'
    } else if (rest.startsWith('text')) {
      dataType = 'text'
      udt = 'text'
    } else if (rest.startsWith('integer')) {
      dataType = 'integer'
      udt = 'int4'
    } else if (rest.startsWith('bigint')) {
      dataType = 'bigint'
      udt = 'int8'
    } else if (rest.startsWith('smallint')) {
      dataType = 'smallint'
      udt = 'int2'
    } else if (rest.startsWith('boolean')) {
      dataType = 'boolean'
      udt = 'bool'
    } else if (rest.startsWith('jsonb')) {
      dataType = 'jsonb'
      udt = 'jsonb'
    } else if (rest.startsWith('json')) {
      dataType = 'json'
      udt = 'json'
    } else if (rest.startsWith('date')) {
      dataType = 'date'
      udt = 'date'
    } else if (rest.startsWith('bytea')) {
      dataType = 'bytea'
      udt = 'bytea'
    } else if (rest.startsWith('real')) {
      dataType = 'real'
      udt = 'float4'
    } else if (rest.startsWith('numeric')) {
      dataType = 'numeric'
      udt = 'numeric'
    } else if (rest.startsWith('varchar') || rest.startsWith('character varying')) {
      dataType = 'character varying'
      udt = 'varchar'
    } else if (/^timestamp(?:\s*\(\d+\))?\s+with time zone\b/.test(rest)) {
      dataType = 'timestamp with time zone'
      udt = 'timestamptz'
    } else if (/^timestamp(?:\s*\(\d+\))?(?:\s+without time zone)?\b/.test(rest)) {
      dataType = 'timestamp without time zone'
      udt = 'timestamp'
    } else if (rest.startsWith('double precision')) {
      dataType = 'double precision'
      udt = 'float8'
    } else if (/^time(?:\s*\(\d+\))?\s+with time zone\b/.test(rest)) {
      dataType = 'time with time zone'
      udt = 'timetz'
    } else if (/^time(?:\s*\(\d+\))?(?:\s+without time zone)?\b/.test(rest)) {
      dataType = 'time without time zone'
      udt = 'time'
    } else {
      const custom = rest.match(/^(?:"([a-z0-9_]+)"|([a-z0-9_]+))(?![a-z0-9_])/)
      if (!custom) throw new Error(`Unrecognized column contract: ${line}`)
      udt = custom[1] ?? custom[2]
    }
    const varcharLength = rest.match(/^varchar\((\d+)\)/)
    const numericShape = rest.match(/^numeric\((\d+)\s*,\s*(\d+)\)/)
    contracts.push({
      name,
      dataType,
      udt,
      nullable,
      charLen: varcharLength ? Number(varcharLength[1]) : null,
      numericPrecision: numericShape ? Number(numericShape[1]) : null,
      numericScale: numericShape ? Number(numericShape[2]) : null,
    })
  }
  return contracts
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function wrapCreate(statement: string): string {
  const table = statement.match(/^CREATE TABLE "([a-z0-9_]+)"/)?.[1]
  if (!table) throw new Error(`CREATE TABLE name missing: ${statement.slice(0, 80)}`)
  const columns = columnContracts(statement)
  const checks = columns
    .map((column) => {
      const parts = [
        `column_name = ${quoteLiteral(column.name)}`,
        `data_type = ${quoteLiteral(column.dataType)}`,
        `udt_name = ${quoteLiteral(column.udt)}`,
        `is_nullable = ${quoteLiteral(column.nullable)}`,
      ]
      if (column.charLen !== null) parts.push(`character_maximum_length = ${column.charLen}`)
      if (column.numericPrecision !== null) parts.push(`numeric_precision = ${column.numericPrecision}`)
      if (column.numericScale !== null) parts.push(`numeric_scale = ${column.numericScale}`)
      return `(${parts.join(' AND ')})`
    })
    .join('\n        OR ')
  return `DO $ue$\nDECLARE\n  found integer;\nBEGIN\n  IF to_regclass(${quoteLiteral(`public.${table}`)}) IS NULL THEN\n    EXECUTE $ddl$${statement};$ddl$;\n    INSERT INTO ue_bootstrap_created_relations(relname) VALUES (${quoteLiteral(table)});\n  ELSE\n    SELECT count(*) INTO found FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = ${quoteLiteral(table)}\n      AND (\n        ${checks}\n      );\n    IF found IS DISTINCT FROM ${columns.length} THEN\n      RAISE EXCEPTION 'incompatible existing relation public.${table}: expected ${columns.length} matching columns, found %', found;\n    END IF;\n  END IF;\nEND\n$ue$;`
}

function wrapType(statement: string): string {
  const name = statement.match(/CREATE TYPE "public"\."([a-z0-9_]+)"/)?.[1]
  const labels = [...statement.matchAll(/'((?:''|[^'])*)'/g)].map((match) => match[1].replace(/''/g, "'"))
  if (!name || labels.length === 0) throw new Error(`CREATE TYPE shape unrecognized: ${statement.slice(0, 120)}`)
  const expected = labels.map((label) => quoteLiteral(label)).join(', ')
  return `DO $ue$\nBEGIN\n  ${statement};\nEXCEPTION WHEN duplicate_object THEN\n  IF (\n    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])\n    FROM pg_type t\n    JOIN pg_namespace n ON n.oid = t.typnamespace\n    JOIN pg_enum e ON e.enumtypid = t.oid\n    WHERE n.nspname = 'public' AND t.typname = ${quoteLiteral(name)}\n  ) IS DISTINCT FROM ARRAY[${expected}]::text[] THEN\n    RAISE EXCEPTION 'incompatible existing type public.${name}';\n  END IF;\nEND\n$ue$;`
}

function wrapConstraint(statement: string): string {
  const name = statement.match(/ADD CONSTRAINT "([a-z0-9_]+)"/)?.[1]
  const table = statement.match(/ALTER TABLE "([a-z0-9_]+)"/)?.[1]
  const parent = statement.match(/REFERENCES "public"\."([a-z0-9_]+)"/)?.[1]
  if (!name || !table || !parent) throw new Error(`Constraint shape unrecognized: ${statement}`)
  return `DO $ue$\nBEGIN\n  IF to_regclass(${quoteLiteral(`public.${parent}`)}) IS NULL THEN\n    RAISE EXCEPTION 'missing parent public.${parent} for ${name}';\n  END IF;\n  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = ${quoteLiteral(table)}) THEN\n    EXECUTE $ddl$${statement};$ddl$;\n  ELSIF NOT EXISTS (\n    SELECT 1 FROM pg_constraint WHERE conname = left(${quoteLiteral(name)}, 63) AND conrelid = to_regclass(${quoteLiteral(`public.${table}`)})\n  ) THEN\n    RAISE EXCEPTION 'incompatible existing relation public.${table}: constraint ${name} is absent';\n  END IF;\nEND\n$ue$;`
}

function wrapIndex(statement: string): string {
  const sql = statement.startsWith('CREATE UNIQUE INDEX ')
    ? statement.replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
    : statement.replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS ')
  return sql.endsWith(';') ? sql : `${sql};`
}

async function main() {
  const names = new Set(process.argv.slice(2))
  if (names.size === 0) throw new Error('Pass relation names to generate')
  const selected = tablesByName(names)
  const missing = [...names].filter((name) => !selected[name])
  if (missing.length) throw new Error(`No current pgTable for: ${missing.join(',')}`)
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api')
  const first = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(selected))
  const firstSql = (Array.isArray(first) ? first : [first]).join('\n')
  const enums = referencedEnums(firstSql, enumsByName())
  const second = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson({ ...Object.fromEntries(enums), ...selected }),
  )
  const sql = (Array.isArray(second) ? second : [second]).join('\n')
  const created = new Set([...sql.matchAll(/CREATE TABLE "([a-z0-9_]+)"/g)].map((match) => match[1]))
  const external = [...new Set([...sql.matchAll(/REFERENCES "public"\."([a-z0-9_]+)"/g)].map((match) => match[1]))].filter(
    (name) => !created.has(name),
  )
  const wrapped = [
    `-- Forward canonical relations required before the 0014 RLS closure.
-- Generated from current Drizzle pgTable exports through drizzle-kit generateMigration.
-- Django models marked "Migrated from drizzle" are not a second DDL source.
-- Existing relations are verified. They are not altered, dropped, or rewritten.
CREATE TEMP TABLE IF NOT EXISTS ue_bootstrap_created_relations (relname text PRIMARY KEY) ON COMMIT DROP;`,
    ...splitStatements(sql).map((statement) => {
      if (statement.startsWith('CREATE TYPE')) return wrapType(statement)
      if (statement.startsWith('CREATE TABLE')) return wrapCreate(statement)
      if (statement.startsWith('ALTER TABLE')) return wrapConstraint(statement)
      if (statement.startsWith('CREATE UNIQUE INDEX') || statement.startsWith('CREATE INDEX')) return wrapIndex(statement)
      throw new Error(`Unexpected drizzle statement: ${statement.slice(0, 120)}`)
    }),
  ]
  process.stdout.write(`${wrapped.join('\n--> statement-breakpoint\n')}\n`)
  process.stderr.write(
    `relations ${Object.keys(selected).length} enums ${enums.size} external ${external.join(',')}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
