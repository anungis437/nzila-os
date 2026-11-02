/**
 * Generates the platform migration that converges the physical database on every Drizzle declaration (UE-CONV-H-007). The input is a
 * register of findings that scripts/runtime/orm-physical-parity.ts wrote against a database built from the previous head; the output is
 * reviewed and committed as a platform migration. Nothing here touches a database.
 *
 *   npx tsx scripts/generate-declared-convergence.ts --register=<findings.json> --label=<label> > db/migrations-platform/00NN_name.sql
 *   npx tsx scripts/generate-declared-convergence.ts --register=<findings.json> --label=<label> --rollback > db/migrations-platform/00NN_name.rollback.sql
 *   npx tsx scripts/generate-declared-convergence.ts --register=<findings.json> --label=<label> --uniques > db/migrations-platform/00NN_name.sql
 *   npx tsx scripts/generate-declared-convergence.ts --register=<findings.json> --label=<label> --enums > db/migrations-platform/00NN_name.sql
 *
 * Enum migration (--enums). A member PostgreSQL has just added cannot be used in the same transaction, so the enum types and members the
 * shape migration needs are their own migration, applied first.
 *
 * Shape migration (default). Every change is additive or relaxing, and the migration fails closed:
 *   - MISSING_COLUMN: the column is added with its declared type and SQL default. A declared NOT NULL column with a SQL default is added
 *     NOT NULL (existing rows take the default); one without is added nullable and made NOT NULL only when the relation holds no rows,
 *     so a populated relation is never given invented values;
 *   - NO_DB_DEFAULT, DEFAULT_ABSENT: the declared SQL default is set on a column that has none;
 *   - NULLABLE_DECLARED_BUT_REQUIRED, UNDECLARED_REQUIRED: a NOT NULL column no insert can fill gets the Django base default (uuid id and
 *     event_id, created_at and updated_at) and otherwise loses NOT NULL, because no declaration can supply a value for it;
 *   - NARROWER_PHYSICAL: the column is widened (never narrowed) to the declared width;
 *   - ENUM_MEMBER_ABSENT: the member is added to the database enum type; a missing enum type is created;
 *   - TYPE_MISMATCH: only the two representations that are lossless to convert (uuid to text for a provider-assigned key, text to text[]).
 *   Every column, default and relaxation it applies is tagged with the label, so --rollback undoes exactly what this migration did. A
 *   preflight and a postflight prove that no constraint, index, policy, grant or row-security setting changed.
 * --uniques adds the declared unique keys the database lacks (so ON CONFLICT can infer them). It refuses to run when duplicates exist.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { loadDeclarationSources, mergeDeclarations, type DeclaredColumn, type DeclaredTable, type Finding } from './runtime/schema-convergence'

const flagValue = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const registerPath = flagValue('register')
const label = flagValue('label') ?? ''
const rollback = process.argv.includes('--rollback')
const uniquesMode = process.argv.includes('--uniques')
const enumsMode = process.argv.includes('--enums')
if (!registerPath) throw new Error('--register=<findings.json> is required')
if (!/^[a-z0-9][a-z0-9_-]{2,60}$/.test(label)) throw new Error('--label must be 3 to 61 characters of a-z, 0-9, _ and -')
const marker = `platform-migration:${label}`
const MARK_DEFAULT = `${marker}:default`
const MARK_RELAX = `${marker}:relax`
const SEP = '\n--> statement-breakpoint\n'

const q = (s: string) => `"${s.replace(/"/g, '""')}"`
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`

const rawRegister = readFileSync(registerPath, 'utf8')
const findings: Finding[] = JSON.parse(rawRegister).findings
const registerHash = createHash('sha256').update(rawRegister.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16)

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

/** What format_type() prints for a type, so a guard can recognise the exact column it means to change. */
function formatType(sqlType: string): string {
  const t = sqlType.toLowerCase().trim()
  const varchar = /^varchar\s*\((\d+)\)$/.exec(t)
  if (varchar) return `character varying(${varchar[1]})`
  const numeric = /^(?:numeric|decimal)\s*\((\d+)\s*,\s*(\d+)\)$/.exec(t)
  if (numeric) return `numeric(${numeric[1]},${numeric[2]})`
  if (t === 'int') return 'integer'
  return t
}

const tableOf = (labelName: string): DeclaredTable => {
  const t = declared.get(labelName)
  if (!t) throw new Error(`no declaration found for ${labelName}`)
  return t
}

let declared = new Map<string, DeclaredTable>()
const columnOf = (t: DeclaredTable, name: string): DeclaredColumn => {
  const c = t.columns.find((x) => x.name === name)
  if (!c) throw new Error(`${t.label}.${name} is not declared`)
  return c
}

const typeSql = (c: DeclaredColumn): string => {
  if (c.extension) return c.sqlType
  if (c.enumName) return `${q(c.enumSchema ?? 'public')}.${q(c.enumName)}${c.isArray ? '[]' : ''}`
  return c.sqlType
}

async function main(): Promise<void> {
  declared = new Map(mergeDeclarations(await loadDeclarationSources()).map((t) => [t.label, t]))
  const sql = rollback ? rollbackSql() : uniquesMode ? uniqueMigration() : enumsMode ? enumMigration() : shapeMigration()
  const out = flagValue('out')
  if (out) writeFileSync(out, `${sql}\n`)
  else process.stdout.write(`${sql}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

function rollbackSql(): string {
  return `-- Rollback of platform-migration:${label}. It removes exactly what that migration added or relaxed, and nothing that existed before it.
-- Widened columns, enum members and lossless retypes are not reversed: narrowing a column could truncate data, and PostgreSQL cannot remove an enum member.
DO $rollback$
DECLARE
  r record;
BEGIN
  -- Constraints added by --uniques.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, k.conname
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE k.contype = 'u' AND obj_description(k.oid, 'pg_constraint') = ${lit(marker)}
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.schema_name, r.table_name, r.conname);
  END LOOP;
  -- Columns this migration added.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = ${lit(marker)} AND NOT a.attisdropped
     ORDER BY n.nspname, c.relname, a.attnum
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS %I', r.schema_name, r.table_name, r.column_name);
  END LOOP;
  -- Defaults this migration set on columns that had none.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = ${lit(MARK_DEFAULT)} AND NOT a.attisdropped
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', r.schema_name, r.table_name, r.column_name);
    EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS NULL', r.schema_name, r.table_name, r.column_name);
  END LOOP;
  -- NOT NULL this migration dropped: restored only where no row has since stored a NULL.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = ${lit(MARK_RELAX)} AND NOT a.attisdropped
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET NOT NULL', r.schema_name, r.table_name, r.column_name);
      EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS NULL', r.schema_name, r.table_name, r.column_name);
    EXCEPTION WHEN not_null_violation THEN
      RAISE NOTICE 'platform rollback: %.%.% holds NULL values, so NOT NULL was not restored.', r.schema_name, r.table_name, r.column_name;
    END;
  END LOOP;
  -- Only the enum types this migration created, and only when no column uses them any more.
  FOR r IN
    SELECT t.oid AS type_oid, t.typarray AS array_oid, t.typname, n.nspname AS schema_name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typtype = 'e' AND obj_description(t.oid, 'pg_type') = ${lit(marker)}
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
       WHERE a.atttypid IN (r.type_oid, r.array_oid) AND NOT a.attisdropped AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format('DROP TYPE %I.%I', r.schema_name, r.typname);
    END IF;
  END LOOP;
END
$rollback$;`
}

/**
 * The enum types the shape migration's new columns need, and the members the database types lack. A member PostgreSQL has just added
 * cannot be used in the same transaction, so this runs as its own migration, ahead of the one that adds columns defaulting to a member.
 */
function enumMigration(): string {
  const types = new Map<string, { create: boolean; values: string[] }>()
  const note = (key: string, values: readonly string[], create: boolean) => {
    const e = types.get(key) ?? { create: false, values: [] }
    for (const v of values) if (!e.values.includes(v)) e.values.push(v)
    e.create = e.create || create
    types.set(key, e)
  }
  for (const f of findings) {
    if (f.kind === 'MISSING_COLUMN') {
      const c = columnOf(tableOf(f.table), f.column!)
      if (!c.enumName || !c.enumValues) continue
      const schema = c.enumSchema ?? 'public'
      if (schema !== 'public') throw new Error(`enum ${schema}.${c.enumName} is not in the public schema; extend the generator before adding a column of that type`)
      note(`${schema}.${c.enumName}`, c.enumValues, true)
    } else if (f.kind === 'ENUM_MEMBER_ABSENT') {
      const type = String(f.data?.type ?? '')
      const members = (f.data?.members as string[] | undefined) ?? []
      if (!type || members.length === 0) throw new Error(`${f.table}.${f.column} has no enum members in the register`)
      note(type, members, false)
    }
  }
  if (types.size === 0) throw new Error('the register needs no enum type')
  const blocks: string[] = []
  for (const [key, e] of [...types].sort(([a], [b]) => a.localeCompare(b))) {
    const [schema, name] = key.split('.')
    const add = e.values.map((v) => `    ALTER TYPE ${q(schema)}.${q(name)} ADD VALUE IF NOT EXISTS ${lit(v)};`).join('\n')
    blocks.push(`DO $enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace WHERE t.typname = ${lit(name)} AND s.nspname = ${lit(schema)}) THEN
    ${e.create ? `CREATE TYPE ${q(schema)}.${q(name)} AS ENUM (${e.values.map(lit).join(', ')});
    COMMENT ON TYPE ${q(schema)}.${q(name)} IS ${lit(marker)};` : `RAISE EXCEPTION 'platform enum convergence fail-closed: enum ${key} does not exist.';`}
  ELSE
${add}
  END IF;
END
$enum$;`)
  }
  return `-- platform-migration:${label}: ${types.size} enum types (generated by scripts/generate-declared-convergence.ts --enums from register ${registerHash}).\n${blocks.join(SEP)}`
}

function uniqueMigration(): string {
  const wanted = findings.filter((f) => f.kind === 'UNIQUE_ABSENT')
  if (wanted.length === 0) throw new Error('the register has no UNIQUE_ABSENT finding')
  const blocks: string[] = []
  const seen = new Set<string>()
  const used = new Set<string>()
  for (const f of wanted) {
    const t = tableOf(f.table)
    const columns = (f.data?.columns as string[] | undefined) ?? []
    const id = `${f.table}|${[...columns].sort().join(',')}`
    if (columns.length === 0 || seen.has(id)) continue
    seen.add(id)
    for (const c of columns) columnOf(t, c)
    let name = `${t.name}_${columns.join('_')}_key`
    if (name.length > 63) name = `${name.slice(0, 54)}_${createHash('sha1').update(name).digest('hex').slice(0, 8)}`
    if (used.has(`${t.schema}.${name}`)) throw new Error(`constraint name ${name} is used twice`)
    used.add(`${t.schema}.${name}`)
    const cols = columns.map(q).join(', ')
    const notNull = columns.map((c) => `${q(c)} IS NOT NULL`).join(' AND ')
    const key = JSON.stringify([...columns].sort())
    blocks.push(`-- ${f.table} (${columns.join(', ')}): ${f.data?.origin ?? ''}
DO $unique$
BEGIN
  IF to_regclass(${lit(`${t.schema}.${t.name}`)}) IS NULL THEN
    RAISE EXCEPTION 'platform unique keys fail-closed: ${t.schema}.${t.name} does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index ix
     WHERE ix.indrelid = to_regclass(${lit(`${t.schema}.${t.name}`)}) AND ix.indisunique AND ix.indpred IS NULL AND ix.indexprs IS NULL
       AND (SELECT jsonb_agg(a.attname::text ORDER BY a.attname::text) FROM pg_attribute a WHERE a.attrelid = ix.indrelid AND a.attnum = ANY (string_to_array(ix.indkey::text, ' ')::int2[])) = ${lit(key)}::jsonb
  ) THEN
    IF EXISTS (SELECT 1 FROM ${q(t.schema)}.${q(t.name)} WHERE ${notNull} GROUP BY ${cols} HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'platform unique keys fail-closed: ${t.schema}.${t.name} holds duplicate rows for (${columns.join(', ')}); deduplicate them before this migration.';
    END IF;
    ALTER TABLE ${q(t.schema)}.${q(t.name)} ADD CONSTRAINT ${q(name)} UNIQUE (${cols});
    COMMENT ON CONSTRAINT ${q(name)} ON ${q(t.schema)}.${q(t.name)} IS ${lit(marker)};
  END IF;
END
$unique$;`)
  }
  return `-- platform-migration:${label}: ${blocks.length} declared unique keys (generated by scripts/generate-declared-convergence.ts --uniques from register ${registerHash}).\n${blocks.join(SEP)}`
}

function shapeMigration(): string {
  const handled = new Set(['MISSING_COLUMN', 'NO_DB_DEFAULT', 'DEFAULT_ABSENT', 'NULLABLE_DECLARED_BUT_REQUIRED', 'UNDECLARED_REQUIRED', 'NARROWER_PHYSICAL', 'ENUM_MEMBER_ABSENT', 'TYPE_MISMATCH', 'EXTENSION_ABSENT'])
  const work = findings.filter((f) => handled.has(f.kind))
  const byTable = new Map<string, Finding[]>()
  for (const f of work) byTable.set(f.table, [...(byTable.get(f.table) ?? []), f])

  const expectedColumns: Array<Record<string, unknown>> = []
  const guarded: Array<{ schema: string; name: string }> = []
  const addStatements: string[] = []
  const extensionBlocks: string[] = []
  const defaults: Array<{ s: string; t: string; c: string; e: string }> = []
  const relax: Array<{ s: string; t: string; c: string }> = []
  const widen: Array<{ s: string; t: string; c: string; from: string; to: string }> = []
  const retype: Array<{ s: string; t: string; c: string; kind: 'uuid-to-text' | 'text-to-array' }> = []
  const notNulls: Array<{ s: string; t: string; c: string }> = []
  const summary: Record<string, number> = {}
  const bump = (k: string) => { summary[k] = (summary[k] ?? 0) + 1 }

  for (const label_ of [...byTable.keys()].sort()) {
    const t = tableOf(label_)
    const { schema, name } = t
    guarded.push({ schema, name })
    const rel = `${q(schema)}.${q(name)}`
    const adds: string[] = []
    for (const f of byTable.get(label_)!) {
      switch (f.kind) {
        case 'MISSING_COLUMN': {
          const c = columnOf(t, f.column!)
          const nullable = !(c.notNull && c.defaultSql !== null)
          adds.push(`  ADD COLUMN IF NOT EXISTS ${q(c.name)} ${typeSql(c)}${c.notNull && c.defaultSql !== null ? ' NOT NULL' : ''}${c.defaultSql !== null ? ` DEFAULT ${c.defaultSql}` : ''}`)
          expectedColumns.push({ s: schema, t: name, c: c.name, ...(informationType(c.sqlType) ?? {}) })
          if (c.notNull && c.defaultSql === null && !c.primary) notNulls.push({ s: schema, t: name, c: c.name })
          void nullable
          bump('MISSING_COLUMN')
          break
        }
        case 'NO_DB_DEFAULT':
        case 'DEFAULT_ABSENT': {
          const c = columnOf(t, f.column!)
          if (c.defaultSql === null) throw new Error(`${f.table}.${f.column} has no SQL default to set`)
          defaults.push({ s: schema, t: name, c: c.name, e: c.defaultSql })
          bump(f.kind)
          break
        }
        case 'NULLABLE_DECLARED_BUT_REQUIRED':
        case 'UNDECLARED_REQUIRED':
          relax.push({ s: schema, t: name, c: f.column! })
          bump(f.kind)
          break
        case 'NARROWER_PHYSICAL': {
          const to = String(f.data?.to ?? '')
          const from = String(f.data?.from ?? '')
          if (!to || !from) throw new Error(`${f.table}.${f.column} has no widening target in the register`)
          widen.push({ s: schema, t: name, c: f.column!, from: formatType(from), to })
          bump('NARROWER_PHYSICAL')
          break
        }
        case 'ENUM_MEMBER_ABSENT':
          bump('ENUM_MEMBER_ABSENT')
          break
        case 'EXTENSION_ABSENT': {
          // A column whose type an optional extension provides: created where the server offers the extension, skipped (with a notice) where it does not.
          const c = columnOf(t, f.column!)
          if (!c.extension) throw new Error(`${f.table}.${f.column} names no extension`)
          extensionBlocks.push(`DO $ext$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = ${lit(c.extension)}) OR EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = ${lit(c.extension)}) THEN
    CREATE EXTENSION IF NOT EXISTS ${q(c.extension)};
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ${lit(schema)} AND table_name = ${lit(name)} AND column_name = ${lit(c.name)}) THEN
      ALTER TABLE ${rel} ADD COLUMN ${q(c.name)} ${c.sqlType};
      COMMENT ON COLUMN ${rel}.${q(c.name)} IS ${lit(marker)};
    END IF;
  ELSE
    RAISE NOTICE 'platform shape convergence: extension ${c.extension} is not available on this server, so ${schema}.${name}.${c.name} is not created.';
  END IF;
END
$ext$;`)
          bump('EXTENSION_ABSENT')
          break
        }
        case 'TYPE_MISMATCH':
          if (f.detail === 'ORM text vs database uuid') retype.push({ s: schema, t: name, c: f.column!, kind: 'uuid-to-text' })
          else if (/^ORM text\[\] vs database text$/.test(f.detail)) retype.push({ s: schema, t: name, c: f.column!, kind: 'text-to-array' })
          else throw new Error(`${f.table}.${f.column}: ${f.detail} has no lossless conversion; fix the declaration`)
          bump('TYPE_MISMATCH')
          break
        default:
          break
      }
    }
    if (adds.length) addStatements.push(`ALTER TABLE ${rel}\n${adds.join(',\n')};`)
  }

  const tableValues = guarded.map((g) => `(${lit(g.schema)}, ${lit(g.name)})`).join(', ')
  const jsonOf = (v: unknown) => `$json$${JSON.stringify(v)}$json$::jsonb`
  const guardTable = 'platform_convergence_guard'
  const preTable = 'platform_convergence_pre'
  const snapshot = `c.relrowsecurity,
         coalesce((SELECT string_agg(k.conname || ':' || pg_get_constraintdef(k.oid), '|' ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid = c.oid), ''),
         coalesce((SELECT string_agg(i.relname || ':' || pg_get_indexdef(ix.indexrelid), '|' ORDER BY i.relname) FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid WHERE ix.indrelid = c.oid), ''),
         coalesce((SELECT string_agg(p.polname || ':' || p.polcmd::text || ':' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ':' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''), '|' ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid = c.oid), ''),
         coalesce((SELECT string_agg(g.grantee || ':' || g.privilege_type || ':' || g.is_grantable, '|' ORDER BY g.grantee, g.privilege_type) FROM information_schema.role_table_grants g WHERE g.table_schema = n.nspname AND g.table_name = c.relname), ''),
         coalesce((SELECT string_agg(a.attname || ':' || a.attacl::text, '|' ORDER BY a.attname) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL), '')`

  const preflight = `DO $preflight$
DECLARE
  spec jsonb;
  col record;
  expected jsonb := ${jsonOf(expectedColumns)};
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
  CREATE TEMP TABLE IF NOT EXISTS ${preTable} (schema_name text NOT NULL, table_name text NOT NULL, column_name text NOT NULL, nullable boolean NOT NULL, has_default boolean NOT NULL) ON COMMIT DROP;
  DELETE FROM ${guardTable};
  DELETE FROM ${preTable};
  INSERT INTO ${guardTable} (relation_name, row_security, constraint_defs, index_defs, policy_defs, grant_defs, column_grant_defs)
  SELECT n.nspname || '.' || c.relname,
         ${snapshot}
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE (n.nspname, c.relname) IN (VALUES ${tableValues});
  IF (SELECT count(*) FROM ${guardTable}) <> ${guarded.length} THEN
    RAISE EXCEPTION 'platform shape convergence fail-closed: expected ${guarded.length} relations before altering shape.';
  END IF;
  INSERT INTO ${preTable} (schema_name, table_name, column_name, nullable, has_default)
  SELECT n.nspname, c.relname, a.attname, NOT a.attnotnull, a.atthasdef
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE (n.nspname, c.relname) IN (VALUES ${tableValues}) AND a.attnum > 0 AND NOT a.attisdropped;
  FOR spec IN SELECT value FROM jsonb_array_elements(expected) LOOP
    SELECT c.data_type, c.character_maximum_length, c.numeric_precision, c.numeric_scale
      INTO col
      FROM information_schema.columns c
     WHERE c.table_schema = spec->>'s' AND c.table_name = spec->>'t' AND c.column_name = spec->>'c';
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    IF spec ? 'data_type' AND col.data_type IS DISTINCT FROM spec->>'data_type' THEN
      RAISE EXCEPTION 'platform shape convergence fail-closed: %.%.% has type %; expected %.', spec->>'s', spec->>'t', spec->>'c', col.data_type, spec->>'data_type';
    END IF;
  END LOOP;
END
$preflight$;`

  const block = (tag: string, body: string) => `DO $${tag}$\n${body}\nEND\n$${tag}$;`
  const loop = (specs: unknown[], action: string, declare = '') =>
    block('apply', `DECLARE\n  spec jsonb;\n${declare}BEGIN\n  FOR spec IN SELECT value FROM jsonb_array_elements(${jsonOf(specs)}) LOOP\n${action}\n  END LOOP;`)

  const defaultsSql = defaults.length
    ? loop(defaults, `    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = spec->>'s' AND table_name = spec->>'t' AND column_name = spec->>'c' AND column_default IS NULL) THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s', spec->>'s', spec->>'t', spec->>'c', spec->>'e');
    END IF;`)
    : ''
  const relaxSql = relax.length
    ? loop(relax, `    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = spec->>'s' AND table_name = spec->>'t' AND column_name = spec->>'c' AND is_nullable = 'NO' AND column_default IS NULL;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    IF kind = 'uuid' AND spec->>'c' IN ('id', 'event_id') THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT gen_random_uuid()', spec->>'s', spec->>'t', spec->>'c');
    ELSIF kind LIKE 'timestamp%' AND spec->>'c' IN ('created_at', 'updated_at') THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT now()', spec->>'s', spec->>'t', spec->>'c');
    ELSE
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL', spec->>'s', spec->>'t', spec->>'c');
    END IF;`, '  kind text;\n')
    : ''
  const widenSql = widen.length
    ? loop(widen, `    IF EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = spec->>'s' AND c.relname = spec->>'t' AND a.attname = spec->>'c' AND NOT a.attisdropped AND format_type(a.atttypid, a.atttypmod) = spec->>'from'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE %s', spec->>'s', spec->>'t', spec->>'c', spec->>'to');
    END IF;`)
    : ''
  const retypeSql = retype.length
    ? loop(retype, `    IF spec->>'kind' = 'uuid-to-text' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = spec->>'s' AND table_name = spec->>'t' AND column_name = spec->>'c' AND data_type = 'uuid') THEN
      IF EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = ANY (k.confkey) WHERE k.contype = 'f' AND k.confrelid = format('%I.%I', spec->>'s', spec->>'t')::regclass AND a.attname = spec->>'c') THEN
        RAISE EXCEPTION 'platform shape convergence fail-closed: %.%.% is referenced by a foreign key, so it cannot be retyped to text here.', spec->>'s', spec->>'t', spec->>'c';
      END IF;
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE text USING %I::text', spec->>'s', spec->>'t', spec->>'c', spec->>'c');
    ELSIF spec->>'kind' = 'text-to-array' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = spec->>'s' AND table_name = spec->>'t' AND column_name = spec->>'c' AND data_type = 'text') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = spec->>'s' AND table_name = spec->>'t' AND column_name = spec->>'c' AND column_default IS NOT NULL) THEN
        RAISE EXCEPTION 'platform shape convergence fail-closed: %.%.% has a default that cannot be retyped automatically.', spec->>'s', spec->>'t', spec->>'c';
      END IF;
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE text[] USING CASE WHEN %I ~ ''^\\{.*\\}$'' THEN %I::text[] ELSE ARRAY[%I] END', spec->>'s', spec->>'t', spec->>'c', spec->>'c', spec->>'c', spec->>'c');
    END IF;`)
    : ''
  const notNullSql = notNulls.length
    ? loop(notNulls, `    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = spec->>'s' AND table_name = spec->>'t' AND column_name = spec->>'c' AND is_nullable = 'YES') THEN
      EXECUTE format('SELECT NOT EXISTS (SELECT 1 FROM %I.%I)', spec->>'s', spec->>'t') INTO empty;
      IF empty THEN
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET NOT NULL', spec->>'s', spec->>'t', spec->>'c');
      END IF;
    END IF;`, '  empty boolean;\n')
    : ''

  const tag = `DO $tag$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name, c.oid AS rel_oid, a.attnum,
           CASE
             WHEN p.column_name IS NULL THEN ${lit(marker)}
             WHEN p.has_default = false AND a.atthasdef THEN ${lit(MARK_DEFAULT)}
             WHEN p.nullable = false AND NOT a.attnotnull THEN ${lit(MARK_RELAX)}
           END AS tag
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN ${preTable} p ON p.schema_name = n.nspname AND p.table_name = c.relname AND p.column_name = a.attname
     WHERE (n.nspname, c.relname) IN (VALUES ${tableValues}) AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    IF r.tag IS NOT NULL AND col_description(r.rel_oid, r.attnum) IS NULL THEN
      EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L', r.schema_name, r.table_name, r.column_name, r.tag);
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
    SELECT relation_name, row_security, constraint_defs, index_defs, policy_defs, grant_defs, column_grant_defs FROM ${guardTable}
  LOOP
    SELECT ${snapshot}
      INTO current_rls, current_constraints, current_indexes, current_policies, current_grants, current_column_grants
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname || '.' || c.relname = prior.relation_name;
    IF current_constraints IS DISTINCT FROM prior.constraint_defs THEN
      RAISE EXCEPTION 'platform shape convergence fail-closed: % constraint definitions changed.', prior.relation_name;
    END IF;
    IF current_indexes IS DISTINCT FROM prior.index_defs THEN
      RAISE EXCEPTION 'platform shape convergence fail-closed: % index definitions changed.', prior.relation_name;
    END IF;
    IF current_policies IS DISTINCT FROM prior.policy_defs THEN
      RAISE EXCEPTION 'platform shape convergence fail-closed: % policy definitions changed.', prior.relation_name;
    END IF;
    IF current_grants IS DISTINCT FROM prior.grant_defs OR current_column_grants IS DISTINCT FROM prior.column_grant_defs THEN
      RAISE EXCEPTION 'platform shape convergence fail-closed: % grant definitions changed.', prior.relation_name;
    END IF;
    IF current_rls IS DISTINCT FROM prior.row_security THEN
      RAISE EXCEPTION 'platform shape convergence fail-closed: % row security changed.', prior.relation_name;
    END IF;
  END LOOP;
END
$postflight$;`

  const header = `-- platform-migration:${label}
-- Generated by scripts/generate-declared-convergence.ts from a register of declared-versus-physical findings (sha256 ${registerHash}).
-- Applied: ${Object.entries(summary).sort().map(([k, v]) => `${k} ${v}`).join(', ')}.
-- ${guarded.length} relations; ${addStatements.length} column batches; ${defaults.length} defaults; ${relax.length} required columns; ${widen.length} widenings; ${retype.length} retypes.`
  return [header, preflight, ...addStatements, ...extensionBlocks, defaultsSql, relaxSql, widenSql, retypeSql, notNullSql, tag, postflight].filter(Boolean).join(SEP)
}
