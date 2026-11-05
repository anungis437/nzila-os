/**
 * A snapshot of the physical database, as far as a statement can name it: relations and their columns, unique keys, functions, types, enum labels and
 * extensions. The census (UE-CONV-H-013) compares every reference a statement makes against this, so what it says is what PostgreSQL itself holds, not
 * what a migration file or a declaration claims.
 */
import type pg from 'pg'

export interface CatalogColumn {
  name: string
  type: string
  notNull: boolean
  /** A DEFAULT, an identity or a generated expression: an insert may omit the column. */
  hasDefault: boolean
  generated: boolean
}

export interface CatalogUnique {
  name: string
  columns: string[]
  partial: boolean
  primary: boolean
  /** The index key holds an expression, so its column set cannot be compared with a conflict target by name. */
  expression: boolean
}

export interface CatalogRelation {
  schema: string
  name: string
  /** pg_class.relkind: r table, p partitioned table, v view, m materialized view, f foreign table, S sequence, c composite type. */
  kind: string
  /** In attnum order, so a positional INSERT can be mapped to its columns. */
  columns: Map<string, CatalogColumn>
  uniques: CatalogUnique[]
  /** Enabled BEFORE INSERT triggers: a NOT NULL column an INSERT omits may be filled by one. */
  beforeInsertTriggers: string[]
}

export interface CatalogFunction {
  schema: string
  name: string
  /** pg_proc.prokind: f function, p procedure, a aggregate, w window. */
  kind: string
  minArgs: number
  maxArgs: number
  variadic: boolean
}

export interface Catalog {
  /** Keyed `schema.name`. */
  relations: Map<string, CatalogRelation>
  /** Keyed `schema.name`; every overload of one name in one list. */
  functions: Map<string, CatalogFunction[]>
  /** Keyed `schema.name`. */
  types: Set<string>
  /** Keyed `schema.name`. */
  enumLabels: Map<string, string[]>
  extensions: Set<string>
  /** current_schemas(true): where an unqualified name is looked up, in order. */
  searchPath: string[]
}

export const SYSTEM_COLUMNS = new Set(['ctid', 'xmin', 'xmax', 'cmin', 'cmax', 'tableoid'])

const key = (schema: string, name: string): string => `${schema}.${name}`

export function findRelation(catalog: Catalog, schema: string | undefined, name: string): CatalogRelation | undefined {
  if (schema) return catalog.relations.get(key(schema, name))
  for (const candidate of catalog.searchPath) {
    const found = catalog.relations.get(key(candidate, name))
    if (found) return found
  }
  return undefined
}

export function findFunctions(catalog: Catalog, schema: string | undefined, name: string): CatalogFunction[] {
  if (schema) return catalog.functions.get(key(schema, name)) ?? []
  const found: CatalogFunction[] = []
  for (const candidate of catalog.searchPath) found.push(...(catalog.functions.get(key(candidate, name)) ?? []))
  return found
}

export function hasType(catalog: Catalog, schema: string | undefined, name: string): boolean {
  if (schema) return catalog.types.has(key(schema, name))
  return catalog.searchPath.some((candidate) => catalog.types.has(key(candidate, name)))
}

export function acceptsArgumentCount(candidate: CatalogFunction, count: number): boolean {
  // A VARIADIC parameter may receive no arguments at all.
  return count >= candidate.minArgs - (candidate.variadic ? 1 : 0) && (candidate.variadic || count <= candidate.maxArgs)
}

/** Columns an INSERT must name: NOT NULL, with nothing to fill them. */
export function requiredColumns(relation: CatalogRelation): string[] {
  return [...relation.columns.values()].filter((column) => column.notNull && !column.hasDefault && !column.generated).map((column) => column.name)
}

export async function loadCatalog(client: Pick<pg.Client, 'query'>): Promise<Catalog> {
  const relations = new Map<string, CatalogRelation>()
  const columnRows = await client.query<{ schema: string; name: string; kind: string; column: string | null; type: string | null; not_null: boolean | null; has_default: boolean | null; generated: boolean | null }>(
    `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind, a.attname AS "column", format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS not_null, (a.atthasdef OR a.attidentity <> '') AS has_default, (a.attgenerated <> '') AS generated
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S', 'c')
        AND n.nspname NOT LIKE 'pg\\_toast%' AND n.nspname NOT LIKE 'pg\\_temp%'
      ORDER BY n.nspname, c.relname, a.attnum`,
  )
  for (const row of columnRows.rows) {
    const id = key(row.schema, row.name)
    let relation = relations.get(id)
    if (!relation) {
      relation = { schema: row.schema, name: row.name, kind: row.kind, columns: new Map(), uniques: [], beforeInsertTriggers: [] }
      relations.set(id, relation)
    }
    if (row.column) relation.columns.set(row.column, { name: row.column, type: row.type ?? '', notNull: row.not_null === true, hasDefault: row.has_default === true, generated: row.generated === true })
  }

  const uniqueRows = await client.query<{ schema: string; name: string; index_name: string; primary: boolean; partial: boolean; columns: string[]; expression: boolean }>(
    `SELECT n.nspname AS schema, c.relname AS name, i.relname AS index_name, ix.indisprimary AS "primary", (ix.indpred IS NOT NULL) AS partial,
            COALESCE(array_agg(a.attname::text ORDER BY k.ord) FILTER (WHERE a.attname IS NOT NULL), '{}') AS columns, COALESCE(bool_or(k.attnum = 0), false) AS expression
       FROM pg_index ix
       JOIN pg_class c ON c.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_class i ON i.oid = ix.indexrelid
       CROSS JOIN LATERAL unnest(ix.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
       LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      WHERE ix.indisunique AND ix.indisvalid AND k.ord <= ix.indnkeyatts
        AND n.nspname NOT LIKE 'pg\\_toast%'
      GROUP BY n.nspname, c.relname, i.relname, ix.indisprimary, ix.indpred`,
  )
  for (const row of uniqueRows.rows) {
    relations.get(key(row.schema, row.name))?.uniques.push({ name: row.index_name, columns: row.columns, partial: row.partial, primary: row.primary, expression: row.expression })
  }
  // A unique or exclusion constraint is also an arbiter, and ON CONFLICT ON CONSTRAINT names it.
  const constraintRows = await client.query<{ schema: string; name: string; constraint_name: string; columns: string[] }>(
    `SELECT n.nspname AS schema, c.relname AS name, k.conname AS constraint_name,
            COALESCE((SELECT array_agg(a.attname::text ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY AS u(attnum, ord) JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = u.attnum), '{}') AS columns
       FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE k.contype IN ('u', 'x', 'p')`,
  )
  for (const row of constraintRows.rows) {
    const relation = relations.get(key(row.schema, row.name))
    if (relation && !relation.uniques.some((existing) => existing.name === row.constraint_name)) relation.uniques.push({ name: row.constraint_name, columns: row.columns, partial: false, primary: false, expression: false })
  }

  const functions = new Map<string, CatalogFunction[]>()
  const triggerRows = await client.query<{ schema: string; name: string; trigger: string }>(
    `SELECT n.nspname AS schema, c.relname AS name, t.tgname AS trigger
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND t.tgenabled <> 'D' AND (t.tgtype & 2) <> 0 AND (t.tgtype & 4) <> 0`,
  )
  for (const row of triggerRows.rows) relations.get(key(row.schema, row.name))?.beforeInsertTriggers.push(row.trigger)

  const functionRows = await client.query<{ schema: string; name: string; kind: string; nargs: number; ndefaults: number; variadic: boolean }>(
    `SELECT n.nspname AS schema, p.proname AS name, p.prokind AS kind, p.pronargs AS nargs, p.pronargdefaults AS ndefaults, (p.provariadic <> 0) AS variadic
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT LIKE 'pg\\_toast%'`,
  )
  for (const row of functionRows.rows) {
    const id = key(row.schema, row.name)
    const list = functions.get(id) ?? []
    list.push({ schema: row.schema, name: row.name, kind: row.kind, minArgs: Math.max(0, row.nargs - row.ndefaults), maxArgs: row.nargs, variadic: row.variadic })
    functions.set(id, list)
  }

  const types = new Set<string>()
  const typeRows = await client.query<{ schema: string; name: string }>(`SELECT n.nspname AS schema, t.typname AS name FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace`)
  for (const row of typeRows.rows) types.add(key(row.schema, row.name))

  const enumLabels = new Map<string, string[]>()
  const enumRows = await client.query<{ schema: string; name: string; labels: string[] }>(
    `SELECT n.nspname AS schema, t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace GROUP BY n.nspname, t.typname`,
  )
  for (const row of enumRows.rows) enumLabels.set(key(row.schema, row.name), row.labels)

  const extensions = new Set((await client.query<{ extname: string }>('SELECT extname FROM pg_extension')).rows.map((row) => row.extname))
  const path = (await client.query<{ schemas: string[] }>('SELECT current_schemas(true)::text[] AS schemas')).rows[0]?.schemas ?? ['pg_catalog', 'public']
  return { relations, functions, types, enumLabels, extensions, searchPath: path }
}
