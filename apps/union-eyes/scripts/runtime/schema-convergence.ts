/**
 * Declared-versus-physical convergence measurement (UE-CONV-H-007).
 *
 * Compares every Drizzle table declaration under db/schema (not only the ones the barrel exports, because application code imports
 * several declarations directly) with the physical database built by Django `migrate` plus the approved platform bootstrap, and reports
 * each difference that makes a declared statement fail or a declared guarantee false. A physical table that is declared more than once is
 * measured against the union of its declarations; declarations that disagree are reported as SHAPE_CONFLICT.
 *
 * strict (a statement fails, a declared default is silently not applied, or the declaration promises something the database cannot do):
 *   TABLE_ABSENT                      the declared relation does not exist.
 *   MISSING_COLUMN                    the declared column does not exist.
 *   TYPE_MISMATCH                     the declaration and the column disagree on type family (uuid vs text, array vs jsonb, ...).
 *   NARROWER_PHYSICAL                 the column is narrower than declared (varchar(50) for a text, numeric(10,2) for numeric(15,2), integer for bigint).
 *   NO_DB_DEFAULT                     NOT NULL, no database default, and the ORM emits the DEFAULT keyword for an omitted value (R-16).
 *   DEFAULT_ABSENT                    nullable, no database default, but the declaration has one: an omitted value is stored as NULL, not the declared default.
 *   NULLABLE_DECLARED_BUT_REQUIRED    declared nullable with no default, but the column is NOT NULL with no default: an insert that leaves it out fails.
 *   UNDECLARED_REQUIRED               NOT NULL, no default, and no declaration names the column: every insert fails.
 *   UNIQUE_ABSENT                     a declared unique key or primary key has no unique constraint or index over exactly those columns, so ON CONFLICT cannot infer it.
 *   ENUM_MEMBER_ABSENT                an enum-typed column whose database type lacks a declared member.
 *   SHAPE_CONFLICT                    two declarations of one physical table disagree on a column's type.
 * advisory (integrity or performance, reported but not a failed statement):
 *   FK_ABSENT, INDEX_ABSENT, NOT_NULL_ABSENT, CHECK_ABSENT, TZ_MISMATCH, SHAPE_DRIFT, EXTENSION_ABSENT.
 *   CONSTRAINT_NOT_VALIDATED          a declared foreign key or check exists but PostgreSQL has not validated the rows that predate it.
 *   VARIANT_REQUIRED is advisory only because it cannot be closed in the database: the relation has NOT NULL columns that some of its declarations
 *   omit, so an insert through one of them fails. Loosening a real constraint to suit a stale declaration would be the wrong repair; the declarations
 *   of that relation have to be unified.
 *
 * Read-only. The database must be built as the application builds it: Django `migrate`, then tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Client } from 'pg'
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core'
import { is, SQL } from 'drizzle-orm'

export type FindingKind =
  | 'TABLE_ABSENT'
  | 'MISSING_COLUMN'
  | 'TYPE_MISMATCH'
  | 'NARROWER_PHYSICAL'
  | 'NO_DB_DEFAULT'
  | 'DEFAULT_ABSENT'
  | 'NULLABLE_DECLARED_BUT_REQUIRED'
  | 'UNDECLARED_REQUIRED'
  | 'UNIQUE_ABSENT'
  | 'ENUM_MEMBER_ABSENT'
  | 'SHAPE_CONFLICT'
  | 'FK_ABSENT'
  | 'INDEX_ABSENT'
  | 'NOT_NULL_ABSENT'
  | 'CHECK_ABSENT'
  | 'TZ_MISMATCH'
  | 'SHAPE_DRIFT'
  | 'VARIANT_REQUIRED'
  | 'EXTENSION_ABSENT'
  | 'CONSTRAINT_NOT_VALIDATED'

export const STRICT_KINDS: readonly FindingKind[] = [
  'TABLE_ABSENT',
  'MISSING_COLUMN',
  'TYPE_MISMATCH',
  'NARROWER_PHYSICAL',
  'NO_DB_DEFAULT',
  'DEFAULT_ABSENT',
  'NULLABLE_DECLARED_BUT_REQUIRED',
  'UNDECLARED_REQUIRED',
  'UNIQUE_ABSENT',
  'ENUM_MEMBER_ABSENT',
  'SHAPE_CONFLICT',
]

export interface Finding {
  kind: FindingKind
  /** Bare name in the public schema, otherwise schema.name, matching the canonical schema census. */
  table: string
  column?: string
  detail: string
  /** Structured facts a generator needs (the physical width of a narrow column, the members an enum lacks). */
  data?: Record<string, unknown>
}

export interface DeclaredColumn {
  name: string
  sqlType: string
  notNull: boolean
  hasDefault: boolean
  /** SQL text of the declared default, or null when there is none or the ORM computes it client side. */
  defaultSql: string | null
  /** The ORM fills the value itself on insert ($defaultFn or $onUpdate), so the database default is never needed. */
  clientFilled: boolean
  generated: boolean
  /** The column is the declared primary key (or its only member). */
  primary: boolean
  length?: number
  precision?: number
  scale?: number
  isArray: boolean
  enumName?: string
  enumSchema?: string
  enumValues?: readonly string[]
  /** The extension the type needs, when the type is not built in. */
  extension?: string
  /** How many declarations of the table name this column, and how many of those declare it NOT NULL or fill it client side. */
  declaredIn: number
  notNullIn: number
  clientFilledIn: number
}

export interface DeclaredKey {
  columns: string[]
  origin: string
}

export interface DeclaredForeignKey {
  /** The constraint name Drizzle derives (or the declaration gives). */
  name: string
  columns: string[]
  foreignSchema: string
  foreignTable: string
  foreignColumns: string[]
  onDelete?: string
  onUpdate?: string
}

export interface DeclaredIndexPart {
  /** A plain column; `expression` is set instead for a computed part. */
  column?: string
  expression?: string
  order?: string
  nulls?: string
  opClass?: string
}

export interface DeclaredIndex {
  name: string
  unique: boolean
  parts: DeclaredIndexPart[]
  /** The plain column names, in order (shorter than `parts` when a part is an expression). */
  columns: string[]
  method: string
  where?: string
  /** Storage parameters, rendered as WITH (...). */
  withOptions?: Record<string, unknown>
  /** A total index over plain columns: any physical index of the same method that starts with these columns serves it, whatever it is called. */
  plain: boolean
  origin: string
}

export interface DeclaredCheck {
  name: string
  /** The expression, with bare column names. */
  sql: string
}

export interface DeclaredTable {
  schema: string
  name: string
  label: string
  columns: DeclaredColumn[]
  uniqueKeys: DeclaredKey[]
  foreignKeys: DeclaredForeignKey[]
  indexes: DeclaredIndex[]
  checks: DeclaredCheck[]
  /** Every declaration file and export that declares this physical table. */
  sources: string[]
  /** Disagreements between declarations of this physical table. */
  conflicts: Array<{ column: string; severity: 'type' | 'constraint'; detail: string }>
  /** The other declarations' definitions of a column they type differently, each measured against the database as well. */
  variants: DeclaredColumn[]
  /** The other declarations' definitions of a time column that differ only in whether they carry a time zone; measured for the zone alone. */
  zoneVariants: DeclaredColumn[]
  /** How many distinct declarations (table objects) name this physical table. */
  variantCount: number
}

interface PhysicalColumn {
  nullable: boolean
  hasDefault: boolean
  dataType: string
  udt: string
  udtSchema: string
  length: number | null
  precision: number | null
  scale: number | null
}

export interface PhysicalIndex {
  name: string
  /** The plain columns, in order (an expression part has no column). */
  columns: string[]
  method: string
  unique: boolean
  partial: boolean
  expression: boolean
}

export interface Physical {
  columns: Map<string, Map<string, PhysicalColumn>>
  uniqueSets: Map<string, Set<string>>
  foreignKeys: Map<string, Array<{ name: string; columns: string[]; foreignTable: string; foreignColumns: string[]; validated: boolean }>>
  indexes: Map<string, PhysicalIndex[]>
  /** Check constraint name to whether PostgreSQL has validated it. */
  checks: Map<string, Map<string, boolean>>
  enums: Map<string, Set<string>>
  extensions: Set<string>
}

const setKey = (columns: readonly string[]): string => [...columns].sort().join(',')
const relationKey = (schema: string, name: string): string => `${schema}.${name}`
const PG_IDENTIFIER_BYTES = 63
const truncated = (identifier: string): string => Buffer.from(identifier).subarray(0, PG_IDENTIFIER_BYTES).toString('utf8')
const dialect = new PgDialect()

const sqlLiteral = (value: unknown, type: string): string => {
  if (value === null) return 'NULL'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
  if (value instanceof Date) return `'${value.toISOString()}'`
  const cast = /^json\b/.test(type) ? 'json' : 'jsonb'
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::${cast}`
}

/** A declared index expression, predicate or check as SQL with bare column names and any bound value written inline. */
function renderIndexSql(value: SQL): string {
  const { sql, params } = dialect.sqlToQuery(value, 'indexes')
  return sql.replace(/\$(\d+)/g, (_match, position: string) => sqlLiteral(params[Number(position) - 1], ''))
}

/** The SQL a declared default renders to, or null when it has no SQL form (an ORM-computed default). */
function renderDefault(c: Record<string, any>, sqlType: string): string | null {
  if (!c.hasDefault) return null
  if (c.default === undefined) return sqlType === 'uuid' && c.name === 'id' ? 'gen_random_uuid()' : null
  if (c.default instanceof SQL) return dialect.sqlToQuery(c.default).sql
  if (sqlType.endsWith('[]') && Array.isArray(c.default)) return `ARRAY[${(c.default as unknown[]).map((v) => sqlLiteral(v, sqlType)).join(', ')}]::${sqlType}`
  return sqlLiteral(c.default, sqlType)
}

/** Collapses a declared type to the family that decides whether a value can be stored in a physical column. */
export function typeFamily(sqlType: string): string {
  const t = sqlType.toLowerCase()
  if (t.startsWith('uuid')) return 'uuid'
  if (/^(timestamp|date|time)/.test(t)) return 'time'
  if (/^(varchar|character varying|text|char|citext)/.test(t)) return 'text'
  if (/^(int|smallint|bigint|serial|bigserial|numeric|decimal|real|double)/.test(t)) return 'number'
  if (t.startsWith('bool')) return 'bool'
  if (t.startsWith('json')) return 'json'
  return 'enum'
}

function physicalFamily(dataType: string): string {
  if (dataType === 'USER-DEFINED') return 'enum'
  if (dataType === 'ARRAY') return 'array'
  return typeFamily(dataType === 'character varying' ? 'varchar' : dataType)
}

const INTEGER_BYTES: Record<string, number> = { smallint: 2, integer: 4, int: 4, bigint: 8 }

function describeTable(table: PgTable, source: string): DeclaredTable {
  const cfg = getTableConfig(table)
  const schema = cfg.schema ?? 'public'
  const label = schema === 'public' ? cfg.name : `${schema}.${cfg.name}`
  const columns: DeclaredColumn[] = []
  const uniqueKeys: DeclaredKey[] = []
  for (const c of cfg.columns as unknown as Array<Record<string, any>>) {
    const sqlType: string = c.getSQLType()
    const enumValues: readonly string[] | undefined = c.enumValues?.length ? c.enumValues : c.baseColumn?.enumValues?.length ? c.baseColumn.enumValues : undefined
    const clientFilled = c.defaultFn !== undefined || (!c.default && c.onUpdateFn !== undefined)
    columns.push({
      name: c.name,
      sqlType,
      notNull: Boolean(c.notNull),
      hasDefault: Boolean(c.hasDefault),
      defaultSql: renderDefault(c, sqlType),
      // Mirrors drizzle-orm's insert builder: a $defaultFn, or an $onUpdate with no static default, is evaluated client side.
      clientFilled,
      generated: c.generated !== undefined || c.generatedIdentity !== undefined,
      primary: Boolean(c.primary),
      length: typeof c.length === 'number' ? c.length : undefined,
      precision: typeof c.precision === 'number' ? c.precision : undefined,
      scale: typeof c.scale === 'number' ? c.scale : undefined,
      isArray: sqlType.endsWith('[]'),
      enumName: enumValues ? sqlType.replace(/\[\]$/, '') : undefined,
      enumSchema: enumValues ? (c.enum?.schema ?? c.baseColumn?.enum?.schema ?? 'public') : undefined,
      enumValues,
      extension: /^vector\b/i.test(sqlType) ? 'vector' : undefined,
      declaredIn: 1,
      notNullIn: c.notNull ? 1 : 0,
      clientFilledIn: clientFilled ? 1 : 0,
    })
    if (c.primary) uniqueKeys.push({ columns: [c.name], origin: 'primary key' })
    else if (c.isUnique) uniqueKeys.push({ columns: [c.name], origin: `unique ${c.uniqueName ?? ''}`.trim() })
  }
  for (const pk of cfg.primaryKeys) uniqueKeys.push({ columns: pk.columns.map((c) => c.name), origin: `primary key ${pk.getName()}` })
  for (const u of cfg.uniqueConstraints) uniqueKeys.push({ columns: u.columns.map((c) => c.name), origin: `unique ${u.name ?? ''}`.trim() })
  const indexes: DeclaredIndex[] = []
  for (const index of cfg.indexes) {
    const config = index.config as { name?: string; unique?: boolean; where?: SQL; method?: string; with?: Record<string, unknown>; columns: unknown[] }
    const parts: DeclaredIndexPart[] = config.columns.map((c) => {
      if (is(c as never, SQL)) return { expression: renderIndexSql(c as SQL) }
      const column = c as { name: string; indexConfig?: { order?: string; nulls?: string; opClass?: string } }
      return { column: column.name, order: column.indexConfig?.order, nulls: column.indexConfig?.nulls, opClass: column.indexConfig?.opClass }
    })
    const columnNames = parts.flatMap((p) => (p.column !== undefined ? [p.column] : []))
    const where = config.where ? renderIndexSql(config.where) : undefined
    const method = (config.method ?? 'btree').toLowerCase()
    const plain = parts.every((p) => p.column !== undefined) && where === undefined
    const origin = `${config.unique ? 'unique index' : 'index'} ${config.name ?? ''}`.trim()
    if (config.unique && plain && method === 'btree') uniqueKeys.push({ columns: columnNames, origin })
    indexes.push({
      name: config.name ?? '',
      unique: Boolean(config.unique),
      parts,
      columns: columnNames,
      method,
      where,
      withOptions: config.with && Object.keys(config.with).length ? config.with : undefined,
      plain: plain && method === 'btree',
      origin: config.name ? `${config.unique ? 'unique index' : 'index'} ${config.name}` : origin,
    })
  }
  const foreignKeys: DeclaredForeignKey[] = cfg.foreignKeys.map((fk) => {
    const ref = fk.reference()
    const foreign = getTableConfig(ref.foreignTable as PgTable)
    return {
      name: fk.getName(),
      columns: ref.columns.map((c) => c.name),
      foreignSchema: foreign.schema ?? 'public',
      foreignTable: foreign.name,
      foreignColumns: ref.foreignColumns.map((c) => c.name),
      onDelete: (fk as unknown as { onDelete?: string }).onDelete,
      onUpdate: (fk as unknown as { onUpdate?: string }).onUpdate,
    }
  })
  const checks: DeclaredCheck[] = cfg.checks.map((c) => ({ name: c.name, sql: renderIndexSql(c.value) }))
  return { schema, name: cfg.name, label, columns, uniqueKeys, foreignKeys, indexes, checks, sources: [source], conflicts: [], variants: [], zoneVariants: [], variantCount: 1 }
}

export interface DeclarationSource {
  source: string
  exports: Record<string, unknown>
}

/**
 * One entry per physical table. Declarations are merged in the order given (the barrel first, so its definition of a column wins):
 * a column any declaration names must exist, a column two declarations type differently is recorded as a conflict.
 */
export function mergeDeclarations(sources: readonly DeclarationSource[]): DeclaredTable[] {
  const seen = new Set<unknown>()
  const merged = new Map<string, DeclaredTable>()
  for (const { source, exports } of sources) {
    for (const [exportName, value] of Object.entries(exports)) {
      if (!value || typeof value !== 'object' || !is(value, PgTable) || seen.has(value)) continue
      seen.add(value)
      const described = describeTable(value as PgTable, `${source}#${exportName}`)
      const key = relationKey(described.schema, described.name)
      const existing = merged.get(key)
      if (!existing) {
        merged.set(key, described)
        continue
      }
      existing.sources.push(...described.sources)
      existing.variantCount += 1
      const byName = new Map(existing.columns.map((c) => [c.name, c]))
      for (const column of described.columns) {
        const first = byName.get(column.name)
        if (!first) {
          existing.columns.push(column)
          byName.set(column.name, column)
          continue
        }
        first.declaredIn += 1
        first.notNullIn += column.notNullIn
        first.clientFilledIn += column.clientFilledIn
        first.hasDefault = first.hasDefault || column.hasDefault
        if (first.defaultSql === null && column.defaultSql !== null) first.defaultSql = column.defaultSql
        const sameKind = (a: string, b: string) => a === b || (['enum', 'text'].includes(a) && ['enum', 'text'].includes(b))
        if (!sameKind(typeFamily(first.sqlType), typeFamily(column.sqlType)) || first.isArray !== column.isArray) {
          const detail = `${first.sqlType} vs ${column.sqlType}`
          if (!existing.conflicts.some((c) => c.column === column.name && c.detail === detail)) existing.conflicts.push({ column: column.name, severity: 'type', detail })
          existing.variants.push(column)
        } else if (first.notNull !== column.notNull || first.hasDefault !== column.hasDefault) {
          const detail = `${first.notNull ? 'NOT NULL' : 'nullable'}${first.hasDefault ? ' default' : ''} vs ${column.notNull ? 'NOT NULL' : 'nullable'}${column.hasDefault ? ' default' : ''}`
          if (!existing.conflicts.some((c) => c.column === column.name && c.detail === detail)) existing.conflicts.push({ column: column.name, severity: 'constraint', detail })
        }
        if (typeFamily(first.sqlType) === 'time' && typeFamily(column.sqlType) === 'time' && first.sqlType !== column.sqlType && !existing.zoneVariants.some((v) => v.name === column.name && v.sqlType === column.sqlType)) {
          existing.zoneVariants.push(column)
        }
      }
      const keyOf = (k: DeclaredKey) => setKey(k.columns)
      const sameIndex = (a: DeclaredIndex, b: DeclaredIndex) => a.name === b.name || (a.plain && b.plain && a.unique === b.unique && a.method === b.method && a.columns.join(',') === b.columns.join(','))
      for (const k of described.uniqueKeys) if (!existing.uniqueKeys.some((e) => keyOf(e) === keyOf(k))) existing.uniqueKeys.push(k)
      for (const index of described.indexes) if (!existing.indexes.some((e) => sameIndex(e, index))) existing.indexes.push(index)
      for (const fk of described.foreignKeys) {
        if (!existing.foreignKeys.some((e) => e.foreignTable === fk.foreignTable && setKey(e.columns) === setKey(fk.columns) && setKey(e.foreignColumns) === setKey(fk.foreignColumns))) existing.foreignKeys.push(fk)
      }
      for (const check of described.checks) if (!existing.checks.some((e) => e.name === check.name)) existing.checks.push(check)
    }
  }
  // A column is only as strict as the loosest declaration of its table: a declaration that omits the column (or leaves it nullable) inserts
  // without a value, so the database may not require one, and a column that only some declarations fill client side needs the database default.
  for (const table of merged.values()) {
    for (const column of table.columns) {
      column.notNull = column.notNullIn === table.variantCount
      column.clientFilled = column.clientFilledIn === column.declaredIn
    }
  }
  return [...merged.values()]
}

/**
 * Imports every declaration file under db/schema, the barrel first, so a merged table takes its definition from what `@/db/schema` exports.
 * `importModule` lets a test runner (vitest) import through its own module graph; the default is a plain dynamic import for tsx.
 */
export async function loadDeclarationSources(
  appRoot: string = process.cwd(),
  importModule: (file: string) => Promise<Record<string, unknown>> = (file) => import(pathToFileURL(file).href) as Promise<Record<string, unknown>>,
): Promise<DeclarationSource[]> {
  const root = join(appRoot, 'db', 'schema')
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) files.push(p)
    }
  }
  walk(root)
  const rank = (file: string): number => (file === join(root, 'index.ts') ? 0 : file.includes(`${join(root, 'domains')}`) ? 1 : 2)
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  const sources: DeclarationSource[] = []
  for (const file of files) {
    const exports = await importModule(file)
    sources.push({ source: relative(appRoot, file).replace(/\\/g, '/'), exports })
  }
  return sources
}

export async function readPhysical(client: Pick<Client, 'query'>, schemas: readonly string[]): Promise<Physical> {
  const physical: Physical = { columns: new Map(), uniqueSets: new Map(), foreignKeys: new Map(), indexes: new Map(), checks: new Map(), enums: new Map(), extensions: new Set() }
  const list = [...schemas]
  const columns = await client.query(
    `SELECT c.table_schema, c.table_name, c.column_name, c.is_nullable, c.column_default, c.data_type, c.udt_name, c.udt_schema,
            c.character_maximum_length, c.numeric_precision, c.numeric_scale, c.is_identity, c.is_generated
       FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = ANY($1)`,
    [list],
  )
  for (const r of columns.rows) {
    const key = relationKey(r.table_schema, r.table_name)
    if (!physical.columns.has(key)) physical.columns.set(key, new Map())
    const isNumeric = r.data_type === 'numeric'
    physical.columns.get(key)!.set(r.column_name, {
      nullable: r.is_nullable === 'YES',
      hasDefault: r.column_default !== null || r.is_identity === 'YES' || r.is_generated === 'ALWAYS',
      dataType: r.data_type,
      udt: r.udt_name,
      udtSchema: r.udt_schema,
      length: r.character_maximum_length,
      precision: isNumeric ? r.numeric_precision : null,
      scale: isNumeric ? r.numeric_scale : null,
    })
  }
  const constraints = await client.query(
    `SELECT n.nspname AS schema_name, c.relname AS table_name, k.contype, k.conname, k.convalidated,
            (SELECT array_agg(a.attname::text ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum) AS cols,
            fc.relname AS foreign_table,
            (SELECT array_agg(a.attname::text ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.attnum) AS foreign_cols
       FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_class fc ON fc.oid = k.confrelid
      WHERE n.nspname = ANY($1) AND k.contype IN ('p', 'u', 'f', 'c')`,
    [list],
  )
  for (const r of constraints.rows) {
    const key = relationKey(r.schema_name, r.table_name)
    if (r.contype === 'p' || r.contype === 'u') {
      if (!physical.uniqueSets.has(key)) physical.uniqueSets.set(key, new Set())
      physical.uniqueSets.get(key)!.add(setKey(r.cols))
    } else if (r.contype === 'f') {
      if (!physical.foreignKeys.has(key)) physical.foreignKeys.set(key, [])
      physical.foreignKeys.get(key)!.push({ name: r.conname, columns: r.cols, foreignTable: r.foreign_table, foreignColumns: r.foreign_cols, validated: r.convalidated })
    } else if (r.contype === 'c') {
      if (!physical.checks.has(key)) physical.checks.set(key, new Map())
      physical.checks.get(key)!.set(r.conname, r.convalidated)
    }
  }
  const indexes = await client.query(
    `SELECT n.nspname AS schema_name, c.relname AS table_name, i.relname AS index_name, am.amname AS method, ix.indisunique AS is_unique,
            (ix.indpred IS NOT NULL) AS partial, (ix.indexprs IS NOT NULL) AS has_expression,
            (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(string_to_array(ix.indkey::text, ' ')::int2[]) WITH ORDINALITY k(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum WHERE k.attnum > 0) AS cols
       FROM pg_index ix
       JOIN pg_class c ON c.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_am am ON am.oid = i.relam
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ANY($1) AND ix.indisvalid`,
    [list],
  )
  for (const r of indexes.rows) {
    const key = relationKey(r.schema_name, r.table_name)
    if (!physical.indexes.has(key)) physical.indexes.set(key, [])
    physical.indexes.get(key)!.push({ name: r.index_name, columns: r.cols ?? [], method: r.method, unique: r.is_unique, partial: r.partial, expression: r.has_expression })
    if (r.cols && r.is_unique && !r.partial && !r.has_expression) {
      if (!physical.uniqueSets.has(key)) physical.uniqueSets.set(key, new Set())
      physical.uniqueSets.get(key)!.add(setKey(r.cols))
    }
  }
  const enums = await client.query(
    `SELECT n.nspname AS schema_name, t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = ANY($1)`,
    [list],
  )
  for (const r of enums.rows) {
    const key = relationKey(r.schema_name, r.typname)
    if (!physical.enums.has(key)) physical.enums.set(key, new Set())
    physical.enums.get(key)!.add(r.enumlabel)
  }
  for (const r of (await client.query('SELECT extname FROM pg_extension')).rows) physical.extensions.add(r.extname)
  return physical
}

function compareColumn(table: DeclaredTable, column: DeclaredColumn, p: PhysicalColumn, physical: Physical, findings: Finding[]): void {
  const add = (kind: FindingKind, detail: string, data?: Record<string, unknown>) => findings.push({ kind, table: table.label, column: column.name, detail, ...(data ? { data } : {}) })
  const ormFamily = typeFamily(column.sqlType)
  const dbFamily = physicalFamily(p.dataType)
  if (column.isArray !== (dbFamily === 'array')) {
    add('TYPE_MISMATCH', `ORM ${column.sqlType} vs database ${p.dataType}`)
  } else if (!column.isArray) {
    const enumLike = ormFamily === 'enum' && (dbFamily === 'text' || dbFamily === 'enum')
    const comparable = ormFamily !== 'enum' && dbFamily !== 'enum' && !enumLike
    // A numeric amount stored as text is a representation choice, not an insert or key failure.
    const tolerated = ormFamily === 'number' && dbFamily === 'text'
    if (comparable && !tolerated && ormFamily !== dbFamily) add('TYPE_MISMATCH', `ORM ${column.sqlType} vs database ${p.dataType}`)
    if (ormFamily === 'time' && dbFamily === 'time') {
      const ormZone = /with time zone/.test(column.sqlType.toLowerCase())
      const dbZone = /with time zone/.test(p.dataType)
      if (/^timestamp/.test(column.sqlType.toLowerCase()) && ormZone !== dbZone) add('TZ_MISMATCH', `ORM ${column.sqlType} vs database ${p.dataType}`)
    }
    if (ormFamily === 'text' && dbFamily === 'text') {
      if (p.length !== null && (column.length === undefined || column.length > p.length)) {
        add('NARROWER_PHYSICAL', `ORM ${column.sqlType} vs database character varying(${p.length})`, { to: column.length === undefined ? 'text' : `varchar(${column.length})`, from: `varchar(${p.length})` })
      }
    }
    if (ormFamily === 'number' && dbFamily === 'number') {
      const declaredBytes = INTEGER_BYTES[column.sqlType.toLowerCase()]
      const physicalBytes = INTEGER_BYTES[p.dataType]
      if (declaredBytes && physicalBytes && declaredBytes > physicalBytes) {
        add('NARROWER_PHYSICAL', `ORM ${column.sqlType} vs database ${p.dataType}`, { to: column.sqlType.toLowerCase(), from: p.dataType })
      }
      if (/^(numeric|decimal)/.test(column.sqlType.toLowerCase()) && p.dataType === 'numeric' && p.precision !== null) {
        const declaredPrecision = column.precision
        const declaredScale = column.scale ?? 0
        const physicalScale = p.scale ?? 0
        if (declaredPrecision === undefined || declaredPrecision - declaredScale > p.precision - physicalScale || declaredScale > physicalScale) {
          const scale = Math.max(declaredScale, physicalScale)
          const integerDigits = Math.max((declaredPrecision ?? Number.POSITIVE_INFINITY) - declaredScale, p.precision - physicalScale)
          add('NARROWER_PHYSICAL', `ORM ${column.sqlType} vs database numeric(${p.precision},${physicalScale})`, {
            to: Number.isFinite(integerDigits) ? `numeric(${integerDigits + scale},${scale})` : 'numeric',
            from: `numeric(${p.precision},${physicalScale})`,
          })
        }
      }
    }
    if (column.enumValues && dbFamily === 'enum') {
      const members = physical.enums.get(relationKey(p.udtSchema, p.udt))
      const absent = column.enumValues.filter((v) => !members?.has(v))
      if (absent.length) add('ENUM_MEMBER_ABSENT', `database type ${p.udt} lacks ${absent.join(', ')}`, { type: `${p.udtSchema}.${p.udt}`, members: absent })
    }
  }
  const omittable = !(column.notNull && !column.hasDefault)
  if (!p.nullable && !p.hasDefault && !column.clientFilled && !column.generated && omittable) {
    // Another declaration of this relation requires the column: the repair is to unify the declarations, not to loosen a real constraint.
    if (column.defaultSql === null && column.notNullIn > 0 && column.notNullIn < table.variantCount) add('VARIANT_REQUIRED', `NOT NULL, no default, declared NOT NULL by ${column.notNullIn} of ${table.variantCount} declarations`)
    else add(column.hasDefault ? 'NO_DB_DEFAULT' : 'NULLABLE_DECLARED_BUT_REQUIRED', column.hasDefault ? 'NOT NULL, no database default, ORM relies on the DEFAULT keyword' : 'declared nullable, but the column is NOT NULL with no default')
  }
  if (p.nullable && !p.hasDefault && column.defaultSql !== null && !column.clientFilled && !column.generated) add('DEFAULT_ABSENT', `declared default ${column.defaultSql} is not applied by the database`)
  if (column.notNull && p.nullable) add('NOT_NULL_ABSENT', 'declared NOT NULL, the column is nullable')
}

export function compare(declared: readonly DeclaredTable[], physical: Physical): { tables: number; findings: Finding[] } {
  const findings: Finding[] = []
  let tables = 0
  for (const table of declared) {
    const key = relationKey(table.schema, table.name)
    const phys = physical.columns.get(key)
    for (const conflict of table.conflicts) {
      findings.push({ kind: conflict.severity === 'type' ? 'SHAPE_CONFLICT' : 'SHAPE_DRIFT', table: table.label, column: conflict.column, detail: `${conflict.detail} across ${table.sources.length} declarations` })
    }
    if (!phys) {
      findings.push({ kind: 'TABLE_ABSENT', table: table.label, detail: 'declared by the ORM, absent from the database' })
      continue
    }
    tables += 1
    for (const column of [...table.columns, ...table.variants]) {
      const p = phys.get(column.name)
      if (!p) {
        if (table.variants.includes(column)) continue
        const missingExtension = column.extension && !physical.extensions.has(column.extension)
        findings.push({ kind: missingExtension ? 'EXTENSION_ABSENT' : 'MISSING_COLUMN', table: table.label, column: column.name, detail: missingExtension ? `needs extension ${column.extension}` : 'declared by the ORM, absent from the database' })
      } else compareColumn(table, column, p, physical, findings)
    }
    const declaredByName = new Map(table.columns.map((c) => [c.name, c]))
    for (const [name, p] of phys) {
      if (p.nullable || p.hasDefault) continue
      const d = declaredByName.get(name)
      if (!d) {
        findings.push({ kind: 'UNDECLARED_REQUIRED', table: table.label, column: name, detail: 'NOT NULL, no default, and not declared by the ORM' })
      } else if (d.declaredIn < table.variantCount) {
        // Only some declarations of this relation name the column, so an insert through another declaration fails. Resolved by unifying the declarations.
        findings.push({ kind: 'VARIANT_REQUIRED', table: table.label, column: name, detail: `NOT NULL, no default, and ${table.variantCount - d.declaredIn} of ${table.variantCount} declarations omit it` })
      }
    }
    const haveKeys = physical.uniqueSets.get(key) ?? new Set<string>()
    const reportedKeys = new Set<string>()
    // A key over a column that is declared but not yet present is reported as well: the column migration adds the column first.
    for (const k of table.uniqueKeys) {
      const id = setKey(k.columns)
      if (haveKeys.has(id) || reportedKeys.has(id)) continue
      reportedKeys.add(id)
      findings.push({ kind: 'UNIQUE_ABSENT', table: table.label, column: k.columns.join(','), detail: `${k.origin} has no unique constraint or index over (${k.columns.join(', ')})`, data: { columns: k.columns, origin: k.origin } })
    }
    for (const fk of table.foreignKeys) {
      const have = (physical.foreignKeys.get(key) ?? []).find((p) => p.foreignTable === fk.foreignTable && setKey(p.columns) === setKey(fk.columns) && setKey(p.foreignColumns) === setKey(fk.foreignColumns))
      if (!have) {
        findings.push({
          kind: 'FK_ABSENT',
          table: table.label,
          column: fk.columns.join(','),
          detail: `references ${fk.foreignTable}(${fk.foreignColumns.join(', ')})`,
          data: { name: fk.name, columns: fk.columns, foreignSchema: fk.foreignSchema, foreignTable: fk.foreignTable, foreignColumns: fk.foreignColumns, onDelete: fk.onDelete, onUpdate: fk.onUpdate },
        })
      } else if (!have.validated) {
        findings.push({ kind: 'CONSTRAINT_NOT_VALIDATED', table: table.label, column: fk.columns.join(','), detail: `foreign key ${have.name} is not validated`, data: { name: have.name } })
      }
    }
    const physicalIndexes = physical.indexes.get(key) ?? []
    for (const index of table.indexes) {
      // A plain unique index is a unique key, and UNIQUE_ABSENT reports it.
      if (index.unique && index.plain) continue
      // An index over a column that only exists where an extension is installed follows the column (EXTENSION_ABSENT reports it).
      if (index.parts.some((part) => { const extension = table.columns.find((c) => c.name === part.column)?.extension; return extension !== undefined && !physical.extensions.has(extension) })) continue
      const have = index.plain
        ? physicalIndexes.some((p) => !p.partial && !p.expression && p.method === index.method && index.columns.every((c, i) => p.columns[i] === c))
        : physicalIndexes.some((p) => p.name === truncated(index.name))
      if (!have) findings.push({ kind: 'INDEX_ABSENT', table: table.label, column: index.columns.join(',') || index.name, detail: index.origin, data: { name: index.name, columns: index.columns, origin: index.origin } })
    }
    const physicalChecks = physical.checks.get(key) ?? new Map<string, boolean>()
    for (const check of table.checks) {
      const validated = physicalChecks.get(truncated(check.name))
      if (validated === undefined) findings.push({ kind: 'CHECK_ABSENT', table: table.label, detail: `check ${check.name}`, data: { name: check.name } })
      else if (!validated) findings.push({ kind: 'CONSTRAINT_NOT_VALIDATED', table: table.label, detail: `check ${check.name} is not validated`, data: { name: check.name } })
    }
    for (const column of table.zoneVariants) {
      const p = phys.get(column.name)
      if (!p || column.isArray || physicalFamily(p.dataType) !== 'time' || !/^timestamp/.test(column.sqlType.toLowerCase())) continue
      if (/with time zone/.test(column.sqlType.toLowerCase()) !== /with time zone/.test(p.dataType)) {
        findings.push({ kind: 'TZ_MISMATCH', table: table.label, column: column.name, detail: `ORM ${column.sqlType} vs database ${p.dataType}` })
      }
    }
  }
  const unique = new Map<string, Finding>()
  for (const f of findings) unique.set(`${f.kind}|${f.table}|${f.column ?? ''}|${f.detail}`, f)
  return { tables, findings: [...unique.values()] }
}

export async function measureConvergence(client: Pick<Client, 'query'>, sources: readonly DeclarationSource[]): Promise<{ tables: number; findings: Finding[]; declared: DeclaredTable[] }> {
  const declared = mergeDeclarations(sources)
  const schemas = [...new Set(['public', ...declared.map((t) => t.schema)])]
  return { ...compare(declared, await readPhysical(client, schemas)), declared }
}

export function summarize(findings: readonly Finding[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const f of findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1
  return counts
}

/**
 * Foreign-key doctrine. A declaration may not promise a foreign key the platform must not enforce.
 *
 * Identity strings. The identity authority gives a signed-in principal a `profiles` row only when that user first opens the dashboard
 * (app/[locale]/dashboard/layout.tsx is the one place that inserts one), and `user_management.users` belongs to the retired credential schema.
 * An administrator acting through the API, a mobile device, a SCIM-provisioned person or a system job has a perfectly good identity and no such row,
 * so a `created_by`, `user_id` or `member_id` that references `profiles.user_id` or `users.user_id` would refuse the write. An actor reference is a value.
 * Thirty such keys were created by the legacy migrations and are enforced today; removing an enforced key is a separate decision, so they stay declared
 * (GRANDFATHERED_IDENTITY_REFERENCES) until the identity authority provisions a profile for every principal and the rest can follow.
 *
 * Evidence. An append-only audit or security record outlives the rows it describes and records principals that may not exist (a failed sign-in, a
 * system actor), and a cascading delete from its parent would destroy the evidence. It carries identifiers, not foreign keys.
 */
export const IDENTITY_REFERENCE_PARENTS: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'profiles', column: 'user_id' },
  { table: 'user_management.users', column: 'user_id' },
]

export const GRANDFATHERED_IDENTITY_REFERENCES: readonly string[] = [
  'bargaining_units.bargaining_chair_id',
  'bargaining_units.chief_steward_id',
  'bargaining_units.created_by',
  'bargaining_units.updated_by',
  'committee_action_items.assigned_to',
  'committee_action_items.completed_by',
  'committee_action_items.created_by',
  'committee_action_items.updated_by',
  'committee_documents.uploaded_by',
  'committee_intelligence_snapshots.generated_by',
  'committee_meeting_attendees.member_id',
  'committee_meetings.created_by',
  'committee_meetings.minutes_approved_by',
  'committee_meetings.updated_by',
  'committees.chair_id',
  'committees.created_by',
  'committees.secretary_id',
  'committees.updated_by',
  'correspondence.approved_by',
  'correspondence.assigned_signer_id',
  'correspondence.dispatched_by',
  'correspondence.drafted_by',
  'correspondence.signed_by',
  'correspondence_audit_trail.actor_user_id',
  'employers.created_by',
  'employers.updated_by',
  'user_management.oauth_providers.user_id',
  'user_signatures.user_id',
  'worksites.created_by',
  'worksites.updated_by',
]

/**
 * Declared NOT NULL that the platform deliberately leaves nullable, each with the migration that says why. The declaration is what is wrong there: the
 * database has to be able to hold the row the design describes. NOT_NULL_ABSENT keeps reporting these columns, so the exception stays visible and is pinned
 * by the ratchet; it is never applied.
 */
export const NOT_NULL_DELIBERATELY_OPEN: Readonly<Record<string, string>> = {
  'payments.amount':
    'platform 0015_payments_transaction_source: a payment recorded before the finance authority has no amount; the authority refuses to register it, and the database has to be able to hold it',
}

export const EVIDENCE_TABLES: readonly string[] = [
  'audit_security.audit_logs',
  'audit_security.security_events',
  'financial_audit_log',
  'signature_audit_log',
  'signature_audit_trail',
  'cross_org_access_log',
  'user_management.auth_audit_log',
  'data_anonymization_log',
]

/** Every declared foreign key the doctrine forbids, as `child.column -> parent.column (reason)`. */
export function foreignKeyDoctrineViolations(declared: readonly DeclaredTable[]): string[] {
  const violations: string[] = []
  for (const table of declared) {
    for (const fk of table.foreignKeys) {
      const parent = fk.foreignSchema === 'public' ? fk.foreignTable : `${fk.foreignSchema}.${fk.foreignTable}`
      const identity =
        IDENTITY_REFERENCE_PARENTS.some((p) => p.table === parent && fk.foreignColumns.length === 1 && fk.foreignColumns[0] === p.column) &&
        !GRANDFATHERED_IDENTITY_REFERENCES.includes(`${table.label}.${fk.columns.join(',')}`)
      const evidence = EVIDENCE_TABLES.includes(table.label)
      if (identity || evidence) violations.push(`${table.label}.${fk.columns.join(',')} -> ${parent}.${fk.foreignColumns.join(',')} (${identity ? 'identity reference' : 'evidence table'})`)
    }
  }
  return violations.sort()
}
