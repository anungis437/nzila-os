#!/usr/bin/env node
/**
 * Generates a fixup migration SQL for all tables present in a Drizzle snapshot
 * but missing from specified SQL migration files.
 *
 * Usage:
 *   node scripts/gen-fixup-migration.mjs [snapshotPath] [comma-separated migration files]
 *
 * Default: 0004 snapshot, files 0000-0004
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = `${ROOT}/apps/union-eyes/db/migrations`;

const args = process.argv.slice(2);
const snapshotPath = args[0] || `${MIGRATIONS_DIR}/meta/0004_snapshot.json`;
const migrationFileList = args[1]
  ? args[1].split(',').map(f => `${MIGRATIONS_DIR}/${f.trim()}`)
  : [
      '0000_flippant_luke_cage.sql',
      '0001_phase5b_inter_union_features.sql',
      '0002_true_selene.sql',
      '0003_curious_agent_zero.sql',
      '0004_phase2_complete.sql',
    ].map(f => `${MIGRATIONS_DIR}/${f}`);

// Extra SQL to include in the "already created" search (e.g., a previous fixup file)
const extraFiles = args.slice(2).map(f => `${MIGRATIONS_DIR}/${f.trim()}`);

const snap = JSON.parse(readFileSync(snapshotPath, 'utf8'));

const sqlFiles = [...migrationFileList, ...extraFiles];
const combinedSQL = sqlFiles.map(f => {
  try { return readFileSync(f, 'utf8'); }
  catch (e) { console.error(`WARNING: Could not read ${f}: ${e.message}`); return ''; }
}).join('\n');

function isTableCreated(tableName) {
  return new RegExp(`CREATE TABLE[\\s\\S]*?"${tableName}"`).test(combinedSQL);
}

function isEnumCreated(enumName) {
  return combinedSQL.includes(`CREATE TYPE "public"."${enumName}"`) ||
    combinedSQL.includes(`CREATE TYPE "${enumName}"`) ||
    combinedSQL.includes(`create type "${enumName}"`);
}

const BUILTIN_TYPES = new Set([
  'uuid', 'text', 'varchar', 'character varying', 'integer', 'int', 'int4', 'int8',
  'bigint', 'boolean', 'bool', 'jsonb', 'json', 'timestamp', 'timestamptz',
  'timestamp with time zone', 'timestamp without time zone', 'date', 'numeric',
  'decimal', 'real', 'double precision', 'float', 'float4', 'float8', 'smallint',
  'serial', 'bigserial', 'bytea', 'inet', 'cidr', 'macaddr', 'interval', 'char',
  'character', 'time', 'time without time zone', 'time with time zone',
  'text[]', 'uuid[]', 'integer[]', 'int[]', 'jsonb[]', 'varchar[]',
  'money', 'oid', 'xml', 'point', 'line', 'circle', 'box', 'polygon', 'path',
  'tsvector', 'tsquery', 'pg_catalog.tsvector',
]);

function isBuiltinType(type) {
  const base = type.replace(/\([^)]*\)/g, '').trim().toLowerCase();
  if (BUILTIN_TYPES.has(base)) return true;
  if (base.startsWith('varchar(') || base.startsWith('char(') || base.startsWith('character(')) return true;
  if (base.startsWith('numeric(') || base.startsWith('decimal(')) return true;
  if (base.endsWith('[]')) return true;
  if (base.startsWith('timestamp')) return true;
  if (base.startsWith('time')) return true;
  return false;
}

function colDefault(def) {
  if (def === undefined || def === null) return null;
  if (typeof def === 'boolean') return String(def);
  if (typeof def === 'number') return String(def);
  if (typeof def === 'string') {
    if (
      /^[a-zA-Z_][a-zA-Z0-9_."]*\(/.test(def) || // function call: gen_random_uuid(), now()
      def.startsWith('ARRAY[') || // array constructor: ARRAY['push']
      def === 'now()' || def === 'current_timestamp' ||
      def === 'true' || def === 'false' ||
      /^\d+$/.test(def) ||
      def.startsWith("'") || // already single-quoted string literal or 'val'::type
      def.includes('::') // type cast
    ) {
      return def;
    }
    return `'${def.replace(/'/g, "''")}'`;
  }
  return null;
}

function colSQL(col) {
  let sql = `"${col.name}" ${col.type}`;
  const def = colDefault(col.default);
  if (def !== null) {
    sql += ` DEFAULT ${def}`;
  }
  if (col.notNull) sql += ' NOT NULL';
  if (col.primaryKey) sql += ' PRIMARY KEY';
  return sql;
}

const missingTables = Object.keys(snap.tables)
  .map(k => snap.tables[k])
  .filter(tbl => !isTableCreated(tbl.name));

console.error(`Found ${missingTables.length} missing tables`);

const usedEnumNames = new Set();
for (const tbl of missingTables) {
  for (const col of Object.values(tbl.columns)) {
    const baseType = col.type.replace(/\([^)]*\)/g, '').trim().toLowerCase();
    if (!isBuiltinType(baseType)) {
      usedEnumNames.add(baseType);
    }
  }
}

const enumsToCreate = [];
for (const enumName of usedEnumNames) {
  if (!isEnumCreated(enumName)) {
    const enumKey = `public.${enumName}`;
    if (snap.enums && snap.enums[enumKey]) {
      enumsToCreate.push(snap.enums[enumKey]);
    } else {
      console.error(`NOTE: Type "${enumName}" not in snapshot enums - skipping`);
    }
  }
}

console.error(`Found ${enumsToCreate.length} enums to create`);

if (missingTables.length === 0) {
  console.error('No missing tables - nothing to generate');
  process.exit(0);
}

const lines = [];
lines.push(`-- ============================================================================`);
lines.push(`-- FIXUP MIGRATION: Create all tables present in snapshot but missing`);
lines.push(`-- from the actual SQL migration files.`);
lines.push(`--`);
lines.push(`-- Tables created: ${missingTables.length}`);
lines.push(`-- Enums created: ${enumsToCreate.length}`);
lines.push(`-- ============================================================================`);
lines.push('');

if (enumsToCreate.length > 0) {
  lines.push(`-- ============================================================================`);
  lines.push(`-- SECTION 1: Enum Types`);
  lines.push(`-- ============================================================================`);
  lines.push('');
  for (const en of enumsToCreate) {
    lines.push(`DO $$ BEGIN`);
    lines.push(`  CREATE TYPE "public"."${en.name}" AS ENUM(${en.values.map(v => `'${v}'`).join(', ')});`);
    lines.push(`EXCEPTION`);
    lines.push(`  WHEN duplicate_object THEN null;`);
    lines.push(`END $$;`);
    lines.push(`--> statement-breakpoint`);
  }
  lines.push('');
}

lines.push(`-- ============================================================================`);
lines.push(`-- SECTION 2: Tables`);
lines.push(`-- ============================================================================`);
lines.push('');

for (const tbl of missingTables) {
  lines.push(`CREATE TABLE IF NOT EXISTS "${tbl.name}" (`);
  const cols = Object.values(tbl.columns);
  const colLines = cols.map(col => `  ${colSQL(col)}`);
  lines.push(colLines.join(',\n'));
  lines.push(`);`);
  lines.push(`--> statement-breakpoint`);
}

process.stdout.write(lines.join('\n'));
