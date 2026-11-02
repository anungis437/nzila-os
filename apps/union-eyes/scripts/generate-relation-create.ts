/**
 * Generates the platform migration that creates declared Drizzle relations Django never created (UE-CONV-H-007), taking the DDL
 * from the declarations themselves through drizzle-kit's generator. Output is reviewed and committed as a platform migration;
 * nothing here touches a database.
 *
 *   npx tsx scripts/generate-relation-create.ts --tables=a,b --label=<label> > db/migrations-platform/00NN_name.sql
 *   npx tsx scripts/generate-relation-create.ts --tables=a,b --label=<label> --rollback > db/migrations-platform/00NN_name.rollback.sql
 *
 * The forward migration is additive and fails closed:
 *   - it refuses to run when any target relation already exists, so an existing relation of another shape is never masked;
 *   - an enum type that already exists must have exactly the declared members, otherwise it is created;
 *   - every relation and enum it creates is tagged with the label, and the rollback removes exactly the tagged objects;
 *   - privileges are revoked explicitly, so the exact grants and row security come only from the storage-authority manifest and
 *     the scoped RLS closure migrations, never from defaults.
 * The rollback refuses to drop a relation that holds rows.
 */
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { PgEnumColumn, PgTable, getTableConfig } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import * as declarations from '../db/schema'

const flagValue = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const tableNames = (flagValue('tables') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const label = flagValue('label') ?? ''
const rollback = process.argv.includes('--rollback')
if (tableNames.length === 0) throw new Error('--tables=a,b is required')
if (!/^[a-z0-9][a-z0-9_-]{2,60}$/.test(label)) throw new Error('--label must be 3 to 61 characters of a-z, 0-9, _ and -')
if (new Set(tableNames).size !== tableNames.length) throw new Error('--tables names a table twice')
const marker = `platform-migration:${label}`
const ROLES = ['union_eyes_runtime', 'union_eyes_system']

const declared = new Map<string, { key: string; table: PgTable }>()
for (const [key, value] of Object.entries(declarations as Record<string, unknown>)) {
  if (is(value, PgTable)) {
    const name = getTableConfig(value).name
    if (!declared.has(name)) declared.set(name, { key, table: value })
  }
}
for (const name of tableNames) if (!declared.has(name)) throw new Error(`no Drizzle declaration for ${name}`)

const enumsUsed = new Map<string, { enumName: string; enumValues: string[] }>()
const imports: Record<string, unknown> = {}
const columnCounts = new Map<string, number>()
const dependsOn = new Map<string, Set<string>>()
for (const name of tableNames) {
  const { key, table } = declared.get(name)!
  const config = getTableConfig(table)
  imports[`table_${key}`] = table
  columnCounts.set(name, config.columns.length)
  for (const column of config.columns) {
    if (is(column, PgEnumColumn)) {
      const e = (column as unknown as { enum: { enumName: string; enumValues: string[] } }).enum
      enumsUsed.set(e.enumName, e)
    }
  }
  dependsOn.set(name, new Set(config.foreignKeys.map((fk) => getTableConfig(fk.reference().foreignTable).name).filter((t) => t !== name)))
}
for (const [name, e] of enumsUsed) imports[`enum_${name}`] = e

// Children first: a relation is dropped before the relations its foreign keys point at.
function dropOrder(): string[] {
  const order: string[] = []
  const remaining = new Set(tableNames)
  while (remaining.size > 0) {
    const free = [...remaining].filter((t) => ![...remaining].some((other) => other !== t && dependsOn.get(other)!.has(t)))
    if (free.length === 0) throw new Error('foreign keys form a cycle')
    for (const t of free.sort()) { order.push(t); remaining.delete(t) }
  }
  return order
}

const quoteList = (values: string[]) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
const tableList = () => `ARRAY[${quoteList(tableNames)}]`
const breakpoint = '--> statement-breakpoint'
const header = (kind: string) => `-- ${kind} ${label}
--
-- Creates ${tableNames.length} relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: ${tableNames.join(', ')}.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=${tableNames.join(',')} --label=${label}${rollback ? ' --rollback' : ''}
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.
`

async function forward(): Promise<string> {
  const empty = generateDrizzleJson({})
  const snapshot = generateDrizzleJson(imports as never, empty.id)
  const statements = (await generateMigration(empty, snapshot)).map((s) => s.trim()).filter(Boolean)
  const creates = statements.filter((s) => /^CREATE TABLE /.test(s))
  const enums = statements.filter((s) => /^CREATE TYPE /.test(s))
  const rest = statements.filter((s) => !/^CREATE TABLE /.test(s) && !/^CREATE TYPE /.test(s))
  if (creates.length !== tableNames.length) throw new Error(`drizzle-kit produced ${creates.length} tables for ${tableNames.length} requested`)
  if (enums.length !== enumsUsed.size) throw new Error(`drizzle-kit produced ${enums.length} enum types for ${enumsUsed.size} used`)
  for (const s of rest) if (!/^(ALTER TABLE .* ADD CONSTRAINT|CREATE (UNIQUE )?INDEX)/.test(s)) throw new Error(`unexpected statement: ${s.slice(0, 80)}`)

  const out: string[] = [header('Platform migration'), `
DO $ue_create$
DECLARE
  present text[];
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'platform ${label} fail-closed: public.organizations does not exist (a foreign key target).';
  END IF;
  SELECT array_agg(t ORDER BY t) INTO present FROM unnest(${tableList()}) AS t WHERE to_regclass('public.' || t) IS NOT NULL;
  IF present IS NOT NULL THEN
    RAISE EXCEPTION 'platform ${label} fail-closed: relations already exist and are not replaced: %', present;
  END IF;
END $ue_create$;`]

  for (const [name, e] of [...enumsUsed].sort(([a], [b]) => a.localeCompare(b))) {
    const members = quoteList(e.enumValues)
    out.push(breakpoint, `DO $ue_enum$
BEGIN
  IF to_regtype('public.${name}') IS NULL THEN
    CREATE TYPE public.${name} AS ENUM (${members});
    COMMENT ON TYPE public.${name} IS '${marker}';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.${name}')) IS DISTINCT FROM ARRAY[${members}]::text[] THEN
    RAISE EXCEPTION 'platform ${label} fail-closed: enum type ${name} exists with members other than the declared ones.';
  END IF;
END $ue_enum$;`)
  }

  for (const create of creates) {
    const name = /^CREATE TABLE "([^"]+)"/.exec(create)![1]
    out.push(breakpoint, create.replace(/^CREATE TABLE "([^"]+)"/, 'CREATE TABLE public."$1"'))
    out.push(breakpoint, `COMMENT ON TABLE public."${name}" IS '${marker}';`)
    out.push(breakpoint, `REVOKE ALL ON TABLE public."${name}" FROM PUBLIC;`)
    for (const role of ROLES) out.push(breakpoint, `DO $$ BEGIN IF to_regrole('${role}') IS NOT NULL THEN REVOKE ALL ON TABLE public."${name}" FROM ${role}; END IF; END $$;`)
  }
  for (const s of rest) out.push(breakpoint, s.replace(/^ALTER TABLE "([^"]+)"/, 'ALTER TABLE public."$1"').replace(/^(CREATE (?:UNIQUE )?INDEX "[^"]+" ON) "([^"]+)"/, '$1 public."$2"'))

  const expected = tableNames.map((t) => `('${t}', ${columnCounts.get(t)})`).join(', ')
  out.push(breakpoint, `DO $ue_post$
DECLARE
  wrong text[];
BEGIN
  SELECT array_agg(e.t ORDER BY e.t) INTO wrong
  FROM (VALUES ${expected}) AS e(t, n)
  WHERE (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = e.t) <> e.n
     OR obj_description(to_regclass('public.' || e.t), 'pg_class') IS DISTINCT FROM '${marker}';
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform ${label} postflight: relations without the declared column count or tag: %', wrong;
  END IF;
  SELECT array_agg(t ORDER BY t) INTO wrong
  FROM unnest(${tableList()}) AS t
  WHERE ${ROLES.map((role) => `(to_regrole('${role}') IS NOT NULL AND (has_table_privilege('${role}', 'public.' || t, 'SELECT') OR has_table_privilege('${role}', 'public.' || t, 'INSERT')
        OR has_table_privilege('${role}', 'public.' || t, 'UPDATE') OR has_table_privilege('${role}', 'public.' || t, 'DELETE')))`).join('\n     OR ')};
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform ${label} postflight: relations already carry runtime or system privileges before the manifest grants them: %', wrong;
  END IF;
END $ue_post$;`)
  return out.join('\n') + '\n'
}

function reverse(): string {
  const order = dropOrder()
  const enumNames = [...enumsUsed.keys()].sort()
  const out: string[] = [header('Platform migration rollback'), `
DO $ue_rollback$
DECLARE
  t text;
  held boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[${quoteList(order)}] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    IF obj_description(to_regclass('public.' || t), 'pg_class') IS DISTINCT FROM '${marker}' THEN
      RAISE EXCEPTION 'rollback ${label} refuses: % was not created by this migration.', t;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', t) INTO held;
    IF held THEN
      RAISE EXCEPTION 'rollback ${label} refuses: % holds rows; export them before removing the relation.', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY[${quoteList(order)}] LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY[${quoteList(enumNames)}] LOOP
    IF to_regtype('public.' || t) IS NOT NULL AND obj_description(to_regtype('public.' || t), 'pg_type') IS NOT DISTINCT FROM '${marker}' THEN
      EXECUTE format('DROP TYPE public.%I', t);
    END IF;
  END LOOP;
END $ue_rollback$;`]
  return out.join('\n') + '\n'
}

async function main() {
  process.stdout.write(rollback ? reverse() : await forward())
}
main().catch((error) => {
  console.error(error)
  process.exit(1)
})
