/**
 * Generates the SQL that evolves Django-created stub relations to the shape their Drizzle declarations select and
 * write (UE-CONV-H-007). Output is reviewed and committed as a platform migration; nothing here touches a database.
 *
 *   npx tsx scripts/generate-stub-evolution.ts <tableNameFile> > db/migrations-platform/00NN_name.sql
 *   npx tsx scripts/generate-stub-evolution.ts <tableNameFile> --guard=<label> > db/migrations-platform/00NN_name.sql
 *   npx tsx scripts/generate-stub-evolution.ts <tableNameFile> --rollback=<label> > db/migrations-platform/00NN_name.rollback.sql
 *
 * --guard wraps the evolution in a preflight and a postflight that prove no constraint, index, policy, grant or row-security
 * setting changed and that an existing column has the declared type, and tags every column and enum type it adds with the label.
 * --rollback emits the matching reversal: it removes exactly the tagged columns and enum types and nothing else.
 * The missing columns come from the committed census (ue-canonical-schema-census.json), which shrinks as relations are evolved, so
 * generate before regenerating the census and record in the migration header which census revision it was generated from.
 *
 * Rules, all additive:
 *   - every missing declared column is added NULLABLE with its declared literal or SQL default;
 *   - declared defaults (random uuid, now(), literals) are set on columns that exist without one;
 *   - declared NOT NULL is enforced only when the relation holds no rows, so a populated stub is never given
 *     invented values;
 *   - enum types the declaration names are created when absent (with --guard, an existing one must have the declared members);
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
// --guard=<label>: wrap the evolution in a preflight that snapshots constraints, indexes, policies, grants and row security and checks the
// type of any column that already exists, and a postflight that proves none of them changed. Every column and enum type the migration adds is
// tagged with the label, so that --rollback=<label> removes exactly what this migration added and nothing that existed before it.
const flagValue = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const guardLabel = flagValue('guard')
const rollbackLabel = flagValue('rollback')
if (guardLabel && rollbackLabel) throw new Error('--guard and --rollback are separate outputs')
const label = guardLabel ?? rollbackLabel
if (label !== undefined && !/^[a-z0-9][a-z0-9_-]{2,60}$/.test(label)) throw new Error('the label must be 3 to 61 characters of a-z, 0-9, _ and -')
const marker = label ? `platform-migration:${label}` : ''

/** The type a column reports through information_schema, so the preflight can recognise an existing column of the wrong type. */
function informationType(sqlType: string): { data_type: string; max_length?: number; precision?: number; scale?: number } | null {
  const t = sqlType.toLowerCase().trim()
  if (t.endsWith('[]')) return { data_type: 'ARRAY' }
  const varchar = /^(?:varchar|character varying)\s*\((\d+)\)$/.exec(t)
  if (varchar) return { data_type: 'character varying', max_length: Number(varchar[1]) }
  const numeric = /^(?:numeric|decimal)\s*\((\d+)\s*,\s*(\d+)\)$/.exec(t)
  if (numeric) return { data_type: 'numeric', precision: Number(numeric[1]), scale: Number(numeric[2]) }
  if (/^timestamp\b/.test(t)) return { data_type: /with time zone/.test(t) ? 'timestamp with time zone' : 'timestamp without time zone' }
  if (/^time\b/.test(t)) return { data_type: /with time zone/.test(t) ? 'time with time zone' : 'time without time zone' }
  const plain: Record<string, string> = { uuid: 'uuid', text: 'text', boolean: 'boolean', integer: 'integer', int: 'integer', bigint: 'bigint', smallint: 'smallint', real: 'real', 'double precision': 'double precision', jsonb: 'jsonb', json: 'json', date: 'date', numeric: 'numeric' }
  if (plain[t]) return { data_type: plain[t] }
  return /^[a-z_][a-z0-9_]*$/.test(t) ? { data_type: 'USER-DEFINED' } : null
}
const expectedColumns: Array<{ table: string; column: string; data_type?: string; max_length?: number; precision?: number; scale?: number }> = []
const guardedTables: string[] = []
// ga-check:exempt one-shot generator script: a local census built per run, never persistence.
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
// ga-check:exempt one-shot generator script: a local census built per run, never persistence.
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
      // Every added column is listed, so the rollback can find it; the type is checked only when it is one information_schema can report.
      expectedColumns.push({ table: cfg.name, column: c.name, ...(informationType(type) ?? {}) })
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
  guardedTables.push(cfg.name)
  out.push(`DO $$ BEGIN IF to_regclass(${lit('public.' + cfg.name)}) IS NULL THEN RAISE EXCEPTION 'platform stub evolution fail-closed: public.${cfg.name} does not exist.'; END IF; END $$;`)
  if (adds.length) out.push(`ALTER TABLE ${rel}\n${adds.join(',\n')};`)
  if (defaults.length || notNulls.length) {
    out.push(`DO $$\nBEGIN\n${defaults.join('\n')}${notNulls.length ? `\n    IF NOT EXISTS (SELECT 1 FROM ${rel}) THEN\n      ALTER TABLE ${rel}\n${notNulls.map((n) => `        ALTER COLUMN ${q(n)} SET NOT NULL`).join(',\n')};\n    END IF;` : ''}\nEND $$;`)
  }
  blocks.push(out.join('\n--> statement-breakpoint\n'))
}
const missingTables = [...wanted].filter((t) => !seen.has(t))
if (missingTables.length) throw new Error(`no declaration found for: ${missingTables.join(', ')}`)

const sep = '\n--> statement-breakpoint\n'
const guardTable = 'platform_stub_shape_guard'
const tableList = guardedTables.map(lit).join(', ')
const expectedJson = `[\n${expectedColumns.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`

/** Everything that grants or restricts access to a relation, as text: the migration must leave all of it exactly as it found it. */
const snapshotColumns = `c.relrowsecurity,
         coalesce((
           SELECT string_agg(k.conname || ':' || pg_get_constraintdef(k.oid), '|' ORDER BY k.conname)
           FROM pg_constraint k WHERE k.conrelid = c.oid
         ), ''),
         coalesce((
           SELECT string_agg(i.relname || ':' || pg_get_indexdef(ix.indexrelid), '|' ORDER BY i.relname)
           FROM pg_index ix
           JOIN pg_class i ON i.oid = ix.indexrelid
           WHERE ix.indrelid = c.oid
         ), ''),
         coalesce((
           SELECT string_agg(
             p.polname || ':' || p.polcmd::text || ':' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ':' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
             '|' ORDER BY p.polname
           )
           FROM pg_policy p WHERE p.polrelid = c.oid
         ), ''),
         coalesce((
           SELECT string_agg(g.grantee || ':' || g.privilege_type || ':' || g.is_grantable, '|' ORDER BY g.grantee, g.privilege_type)
           FROM information_schema.role_table_grants g
           WHERE g.table_schema = 'public' AND g.table_name = c.relname
         ), ''),
         coalesce((
           SELECT string_agg(a.attname || ':' || a.attacl::text, '|' ORDER BY a.attname)
           FROM pg_attribute a
           WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
         ), '')`

const preflight = `DO $preflight$
DECLARE
  spec jsonb;
  col record;
  expected jsonb := $json$${expectedJson}$json$;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS ${guardTable} (
    relation_name text PRIMARY KEY,
    row_security boolean NOT NULL,
    constraint_defs text NOT NULL,
    index_defs text NOT NULL,
    policy_defs text NOT NULL,
    grant_defs text NOT NULL,
    column_grant_defs text NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS ${guardTable}_pre (table_name text NOT NULL, column_name text NOT NULL) ON COMMIT DROP;
  DELETE FROM ${guardTable};
  DELETE FROM ${guardTable}_pre;
  INSERT INTO ${guardTable} (relation_name, row_security, constraint_defs, index_defs, policy_defs, grant_defs, column_grant_defs)
  SELECT c.relname,
         ${snapshotColumns}
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (${tableList});
  IF (SELECT count(*) FROM ${guardTable}) <> ${guardedTables.length} THEN
    RAISE EXCEPTION 'platform stub evolution fail-closed: expected ${guardedTables.length} public relations before altering shape.';
  END IF;
  INSERT INTO ${guardTable}_pre (table_name, column_name)
  SELECT c.table_name, c.column_name FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name IN (${tableList});
  FOR spec IN SELECT value FROM jsonb_array_elements(expected) LOOP
    IF to_regclass('public.' || (spec->>'table')) IS NULL THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.% does not exist.', spec->>'table';
    END IF;
    SELECT c.data_type, c.character_maximum_length, c.numeric_precision, c.numeric_scale
      INTO col
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = spec->>'table'
       AND c.column_name = spec->>'column';
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    IF spec ? 'data_type' AND col.data_type IS DISTINCT FROM spec->>'data_type' THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.%.% has type %; expected %.',
        spec->>'table', spec->>'column', col.data_type, spec->>'data_type';
    END IF;
    IF spec ? 'max_length' AND col.character_maximum_length IS DISTINCT FROM (spec->>'max_length')::integer THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.%.% length is %; expected %.',
        spec->>'table', spec->>'column', col.character_maximum_length, spec->>'max_length';
    END IF;
    IF spec ? 'precision' AND (
      col.numeric_precision IS DISTINCT FROM (spec->>'precision')::integer
      OR col.numeric_scale IS DISTINCT FROM (spec->>'scale')::integer
    ) THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.%.% numeric precision does not match.',
        spec->>'table', spec->>'column';
    END IF;
  END LOOP;
END
$preflight$;`

// Tags the columns this run added (not the ones that were already there), so the rollback removes exactly those.
const tagColumns = `DO $tag$
DECLARE
  spec jsonb;
  expected jsonb := $json$${expectedJson}$json$;
BEGIN
  FOR spec IN SELECT value FROM jsonb_array_elements(expected) LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = spec->>'table' AND c.column_name = spec->>'column'
    ) AND NOT EXISTS (
      SELECT 1 FROM ${guardTable}_pre p WHERE p.table_name = spec->>'table' AND p.column_name = spec->>'column'
    ) THEN
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', spec->>'table', spec->>'column', ${lit(marker)});
    END IF;
  END LOOP;
END
$tag$;`

const postflight = `DO $postflight$
DECLARE
  prior record;
  current_rls boolean;
  current_constraints text;
  current_indexes text;
  current_policies text;
  current_grants text;
  current_column_grants text;
BEGIN
  FOR prior IN
    SELECT relation_name, row_security, constraint_defs, index_defs, policy_defs, grant_defs, column_grant_defs
    FROM ${guardTable}
  LOOP
    SELECT ${snapshotColumns}
      INTO current_rls, current_constraints, current_indexes, current_policies, current_grants, current_column_grants
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = prior.relation_name;
    IF current_constraints IS DISTINCT FROM prior.constraint_defs THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.% constraint definitions changed.', prior.relation_name;
    END IF;
    IF current_indexes IS DISTINCT FROM prior.index_defs THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.% index definitions changed.', prior.relation_name;
    END IF;
    IF current_policies IS DISTINCT FROM prior.policy_defs THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.% policy definitions changed.', prior.relation_name;
    END IF;
    IF current_grants IS DISTINCT FROM prior.grant_defs OR current_column_grants IS DISTINCT FROM prior.column_grant_defs THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.% grant definitions changed.', prior.relation_name;
    END IF;
    IF current_rls IS DISTINCT FROM prior.row_security THEN
      RAISE EXCEPTION 'platform stub evolution fail-closed: public.% row security changed.', prior.relation_name;
    END IF;
  END LOOP;
END
$postflight$;`

const rollbackSql = `DO $rollback$
DECLARE
  r record;
BEGIN
  -- Only the columns this migration tagged when it added them; a column that existed before it was applied is never touched.
  FOR r IN
    SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE n.nspname = 'public' AND d.objsubid > 0 AND d.description = ${lit(marker)} AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS %I', r.table_name, r.column_name);
  END LOOP;
  -- Only the enum types this migration created, and only when no column uses them any more.
  FOR r IN
    SELECT t.oid AS type_oid, t.typarray AS array_oid, t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typtype = 'e' AND obj_description(t.oid, 'pg_type') = ${lit(marker)}
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
       WHERE a.atttypid IN (r.type_oid, r.array_oid) AND NOT a.attisdropped AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format('DROP TYPE public.%I', r.typname);
    END IF;
  END LOOP;
END
$rollback$;`

if (rollbackLabel) {
  process.stdout.write(rollbackSql + '\n')
} else {
  const enumSql = [...enums].map(([n, vals]) =>
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace WHERE t.typname = ${lit(n)} AND s.nspname = 'public') THEN CREATE TYPE public.${q(n)} AS ENUM (${vals.map(lit).join(', ')});${guardLabel ? ` COMMENT ON TYPE public.${q(n)} IS ${lit(marker)};` : ''} ELSIF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace s ON s.oid = t.typnamespace WHERE t.typname = ${lit(n)} AND s.nspname = 'public') IS DISTINCT FROM ARRAY[${vals.map(lit).join(', ')}]::text[] THEN RAISE EXCEPTION 'platform stub evolution fail-closed: enum public.${n} exists with other members than its declaration.'; END IF; END $$;`)
  const parts = guardLabel ? [preflight, ...enumSql, ...blocks, tagColumns, postflight] : [...enumSql, ...blocks]
  process.stdout.write(parts.join(sep) + '\n')
}
