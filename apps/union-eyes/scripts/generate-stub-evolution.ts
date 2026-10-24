/**
 * Generates the SQL that evolves Django-created stub relations to the shape their Drizzle declarations select and
 * write (UE-CONV-H-007). Output is reviewed and committed as a platform migration; nothing here touches a database.
 *
 *   npx tsx scripts/generate-stub-evolution.ts <tableNameFile> > db/migrations-platform/00NN_name.sql
 *
 * Rules, all additive:
 *   - every missing declared column is added NULLABLE with its declared literal or SQL default;
 *   - declared defaults (random uuid, now(), literals) are set on columns that exist without one;
 *   - declared NOT NULL is enforced only when the relation holds no rows, so a populated stub is never given
 *     invented values;
 *   - enum types the declaration names are created when absent;
 *   - foreign keys, indexes and row-level security are NOT created here: tenant isolation stays with the scoped RLS
 *     migrations and the storage-authority registry.
 */
import { readFileSync } from 'node:fs'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is, SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import * as declarations from '../db/schema'

const dialect = new PgDialect()
const wanted = new Set(readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
const census = new Map<string, { columnsMissing: string[]; requiredUndeclared: string[] }>(
  (JSON.parse(readFileSync('../../docs/union-eyes/convergence/register/ue-canonical-schema-census.json', 'utf8')).entries as { table: string; columnsMissing: string[]; requiredUndeclared: string[] }[]).map((e) => [e.table, e]),
)

// Django's base model made these NOT NULL without a default and the declarations do not supply them, so every
// insert through a declaration fails. A database default is the only change that keeps both sides honest.
const DJANGO_BASE_DEFAULTS: Record<string, string> = { id: 'gen_random_uuid()', created_at: 'now()', updated_at: 'now()' }

const q = (s: string) => `"${s.replace(/"/g, '""')}"`
const lit = (v: unknown): string => {
  if (v === null) return 'NULL'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
}
function defaultSql(c: any): string | null {
  if (!c.hasDefault) return null
  if (c.default === undefined) {
    if (c.getSQLType() === 'uuid' && c.name === 'id') return 'gen_random_uuid()'
    return null // runtime-generated ($defaultFn) defaults have no SQL form
  }
  if (c.default instanceof SQL) return dialect.sqlToQuery(c.default).sql
  const type: string = c.getSQLType()
  if (type.endsWith('[]') && Array.isArray(c.default)) return `ARRAY[${(c.default as unknown[]).map(lit).join(', ')}]::${type}`
  return lit(c.default)
}

// One enum name declared with different members in different tables cannot be served by one database type.
const enumVariants = new Map<string, Set<string>>()
for (const value of Object.values(declarations as Record<string, unknown>)) {
  if (!is(value, PgTable)) continue
  for (const c of getTableConfig(value).columns as any[]) {
    const values: readonly string[] | undefined = c.enumValues?.length ? c.enumValues : c.baseColumn?.enumValues
    if (!values?.length) continue
    const type: string = c.getSQLType().replace(/\[\]$/, '')
    enumVariants.set(type, new Set([...(enumVariants.get(type) ?? []), JSON.stringify([...values])]))
  }
}

const enums = new Map<string, readonly string[]>()
const blocks: string[] = []
const seen = new Set<string>()
for (const value of Object.values(declarations as Record<string, unknown>)) {
  if (!is(value, PgTable)) continue
  const cfg = getTableConfig(value)
  const name = cfg.schema && cfg.schema !== 'public' ? `${cfg.schema}.${cfg.name}` : cfg.name
  if (seen.has(name) || !wanted.has(name)) continue
  seen.add(name)
  const missing = new Set(census.get(name)?.columnsMissing ?? [])
  const rel = `public.${q(cfg.name)}`
  const adds: string[] = []
  const notNulls: string[] = []
  const defaults: string[] = []
  for (const c of cfg.columns as any[]) {
    const type: string = c.getSQLType()
    if (type.startsWith('vector')) throw new Error(`${name}.${c.name} needs the pgvector extension; resolve that prerequisite before evolving this table`)
    const base = type.replace(/\[\]$/, '')
    if ((c.enumValues?.length || c.baseColumn?.enumValues?.length) && (enumVariants.get(base)?.size ?? 0) > 1) {
      throw new Error(`${name}.${c.name} uses enum ${base}, declared with different members elsewhere; it needs an individual decision`)
    }
    if (c.enumValues && c.enumValues.length) enums.set(type, c.enumValues)
    else if (type.endsWith('[]') && c.baseColumn?.enumValues?.length) enums.set(type.slice(0, -2), c.baseColumn.enumValues)
    const def = defaultSql(c)
    if (missing.has(c.name)) {
      adds.push(`  ADD COLUMN IF NOT EXISTS ${q(c.name)} ${type}${def ? ` DEFAULT ${def}` : ''}`)
      if (c.notNull && !c.primary) notNulls.push(c.name)
    } else if (def) {
      defaults.push(`    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${lit(cfg.name)} AND column_name = ${lit(c.name)} AND column_default IS NULL) THEN
      ALTER TABLE ${rel} ALTER COLUMN ${q(c.name)} SET DEFAULT ${def};
    END IF;`)
    }
  }
  for (const col of census.get(name)?.requiredUndeclared ?? []) {
    const def = DJANGO_BASE_DEFAULTS[col]
    if (!def) throw new Error(`${name}.${col} is NOT NULL without a default and undeclared; it needs an individual decision`)
    defaults.push(`    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${lit(cfg.name)} AND column_name = ${lit(col)} AND column_default IS NULL) THEN
      ALTER TABLE ${rel} ALTER COLUMN ${q(col)} SET DEFAULT ${def};
    END IF;`)
  }
  const out: string[] = [`-- ${name}`]
  out.push(`DO $$ BEGIN IF to_regclass(${lit('public.' + cfg.name)}) IS NULL THEN RAISE EXCEPTION 'platform stub evolution fail-closed: public.${cfg.name} does not exist.'; END IF; END $$;`)
  if (adds.length) out.push(`ALTER TABLE ${rel}\n${adds.join(',\n')};`)
  if (defaults.length || notNulls.length) {
    out.push(`DO $$\nBEGIN\n${defaults.join('\n')}${notNulls.length ? `\n    IF NOT EXISTS (SELECT 1 FROM ${rel}) THEN\n      ALTER TABLE ${rel}\n${notNulls.map((n) => `        ALTER COLUMN ${q(n)} SET NOT NULL`).join(',\n')};\n    END IF;` : ''}\nEND $$;`)
  }
  blocks.push(out.join('\n--> statement-breakpoint\n'))
}
const missingTables = [...wanted].filter((t) => !seen.has(t))
if (missingTables.length) throw new Error(`no declaration found for: ${missingTables.join(', ')}`)

const enumSql = [...enums].map(([n, vals]) =>
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace WHERE t.typname = ${lit(n)} AND s.nspname = 'public') THEN CREATE TYPE public.${q(n)} AS ENUM (${vals.map(lit).join(', ')}); END IF; END $$;`)
process.stdout.write([...enumSql, ...blocks].join('\n--> statement-breakpoint\n') + '\n')
