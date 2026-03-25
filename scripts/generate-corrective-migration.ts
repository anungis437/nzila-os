/**
 * generate-corrective-migration.ts
 * 
 * Reads the Drizzle schema, compares against actual DB, and generates
 * corrective DDL (CREATE TABLE / ALTER TABLE ADD COLUMN) for all gaps.
 * 
 * Output: apps/union-eyes/db/migrations/corrective-full-sync.sql
 */
import * as schema from '../apps/union-eyes/db/schema/index';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nzila:nzila_dev@localhost:5433/nzila_automation';
const client = postgres(DATABASE_URL, { max: 1 });

interface ColMeta {
  name: string;
  sqlType: string;
  notNull: boolean;
  hasDefault: boolean;
  primary: boolean;
  defaultFn: any;
  defaultValue: any;
  columnType: string;
  enumValues?: string[];
}

function extractTableSchema(tbl: PgTable<any>): string {
  const symbols = Object.getOwnPropertySymbols(tbl);
  const schemaSym = symbols.find(s => s.toString().includes('Schema'));
  if (schemaSym) {
    const val = (tbl as any)[schemaSym];
    if (val && typeof val === 'string') return val;
    if (val && typeof val === 'object' && val.schemaName) return val.schemaName;
  }
  return 'public';
}

function getColumnMeta(tbl: PgTable<any>): ColMeta[] {
  const drizzleCols = getTableColumns(tbl);
  const cols: ColMeta[] = [];
  for (const [, col] of Object.entries(drizzleCols)) {
    const c = col as any;
    cols.push({
      name: c.name,
      sqlType: typeof c.getSQLType === 'function' ? c.getSQLType() : 'text',
      notNull: c.notNull ?? false,
      hasDefault: c.hasDefault ?? false,
      primary: c.primary ?? false,
      defaultFn: c.defaultFn,
      defaultValue: c.default,
      columnType: c.columnType,
      enumValues: c.enumValues,
    });
  }
  return cols;
}

function escapeId(name: string): string {
  return `"${name}"`;
}

function colDDL(col: ColMeta, isPK: boolean): string {
  let ddl = `  ${escapeId(col.name)} ${col.sqlType}`;
  if (isPK) ddl += ' PRIMARY KEY';
  // For new tables, respect NOT NULL. For ALTER ADD COLUMN, we skip NOT NULL
  // unless there's a default (to avoid failing on existing rows)
  if (col.notNull && !isPK) ddl += ' NOT NULL';
  if (col.hasDefault && col.defaultValue !== undefined) {
    const dv = col.defaultValue;
    if (typeof dv === 'object' && dv !== null && dv.toSQL) {
      // SQL expression default — skip for safety (gen_random_uuid, now(), etc. are handled by Drizzle)
    }
  }
  return ddl;
}

function alterColDDL(col: ColMeta): string {
  let ddl = `ADD COLUMN ${escapeId(col.name)} ${col.sqlType}`;
  // For ALTER TABLE on existing data, we make new columns nullable even if schema says notNull
  // to avoid "column ... of relation ... contains null values" errors
  // Exception: if there's a default that can fill existing rows
  if (col.hasDefault && col.notNull) {
    ddl += ' NOT NULL';
    // Add default for common patterns
    if (col.columnType === 'PgUUID' && col.primary) {
      ddl += ' DEFAULT gen_random_uuid()';
    } else if (col.columnType === 'PgBoolean') {
      ddl += ' DEFAULT false';
    } else if (col.columnType === 'PgInteger') {
      ddl += ' DEFAULT 0';
    } else if (col.columnType === 'PgNumeric') {
      ddl += " DEFAULT '0'";
    } else if (col.columnType === 'PgTimestamp') {
      ddl += ' DEFAULT now()';
    } else if (col.columnType === 'PgJsonb') {
      ddl += " DEFAULT '{}'::jsonb";
    } else if (col.columnType === 'PgText' || col.columnType === 'PgVarchar') {
      ddl += " DEFAULT ''";
    }
  }
  return ddl;
}

async function main() {
  // Get actual DB state
  const actualTablesRows = await client`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_type = 'BASE TABLE' AND table_schema IN ('public', 'audit_security', 'user_management')
  `;
  const actualTables = new Set(actualTablesRows.map(r => `${r.table_schema}.${r.table_name}`));

  const actualColsRows = await client`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'audit_security', 'user_management')
  `;
  const actualColsSet = new Set(actualColsRows.map(r => `${r.table_schema}.${r.table_name}.${r.column_name}`));

  // Collect all Drizzle tables
  const seen = new Set<string>();
  const missingTables: { schema: string; name: string; cols: ColMeta[] }[] = [];
  const missingColumns: { schema: string; table: string; cols: ColMeta[] }[] = [];
  const enumsNeeded = new Set<string>(); // track enum types we need to create

  for (const [, value] of Object.entries(schema)) {
    if (!is(value, PgTable)) continue;
    const tbl = value as PgTable<any>;
    const tableName = getTableName(tbl);
    const dbSchema = extractTableSchema(tbl);
    const key = `${dbSchema}.${tableName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const cols = getColumnMeta(tbl);

    if (!actualTables.has(key)) {
      missingTables.push({ schema: dbSchema, name: tableName, cols });
      // Track enum columns that need types
      for (const col of cols) {
        if (col.columnType === 'PgEnumColumn' && col.enumValues && col.enumValues.length > 0) {
          // Get the enum type name from the SQL type
          enumsNeeded.add(`${col.sqlType}:${col.enumValues.join(',')}`);
        }
      }
    } else {
      // Check for missing columns
      const missing: ColMeta[] = [];
      for (const col of cols) {
        const colKey = `${key}.${col.name}`;
        if (!actualColsSet.has(colKey)) {
          missing.push(col);
          if (col.columnType === 'PgEnumColumn' && col.enumValues && col.enumValues.length > 0) {
            enumsNeeded.add(`${col.sqlType}:${col.enumValues.join(',')}`);
          }
        }
      }
      if (missing.length > 0) {
        missingColumns.push({ schema: dbSchema, table: tableName, cols: missing });
      }
    }
  }

  // Check which enums already exist in DB
  const existingEnums = await client`
    SELECT typname FROM pg_type WHERE typtype = 'e'
  `;
  const existingEnumNames = new Set(existingEnums.map(r => r.typname as string));

  // Generate SQL
  const lines: string[] = [];
  lines.push('-- ==============================================');
  lines.push('-- CORRECTIVE MIGRATION: Full Schema Sync');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Missing tables: ${missingTables.length}`);
  lines.push(`-- Tables with missing columns: ${missingColumns.length}`);
  lines.push('-- ==============================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // Create schemas if needed
  const schemasNeeded = new Set(missingTables.filter(t => t.schema !== 'public').map(t => t.schema));
  for (const s of schemasNeeded) {
    lines.push(`CREATE SCHEMA IF NOT EXISTS ${escapeId(s)};`);
  }
  if (schemasNeeded.size > 0) lines.push('');

  // Create enum types
  lines.push('-- ── ENUM TYPES ──');
  let enumCount = 0;
  for (const entry of enumsNeeded) {
    const [typeName, valuesStr] = entry.split(':');
    if (existingEnumNames.has(typeName)) continue;
    const values = valuesStr.split(',').map(v => `'${v}'`).join(', ');
    lines.push(`DO $$ BEGIN CREATE TYPE ${escapeId(typeName)} AS ENUM (${values}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    enumCount++;
  }
  if (enumCount === 0) lines.push('-- (none needed)');
  lines.push('');

  // Create missing tables
  lines.push('-- ── MISSING TABLES ──');
  for (const table of missingTables) {
    const qualified = table.schema === 'public' ? escapeId(table.name) : `${escapeId(table.schema)}.${escapeId(table.name)}`;
    lines.push(`-- ${table.name} (${table.cols.length} columns)`);
    lines.push(`CREATE TABLE IF NOT EXISTS ${qualified} (`);
    const pkCols = table.cols.filter(c => c.primary);
    const colLines: string[] = [];
    for (const col of table.cols) {
      colLines.push(colDDL(col, col.primary));
    }
    lines.push(colLines.join(',\n'));
    lines.push(');');
    lines.push('');
  }

  // Add missing columns to existing tables
  lines.push('-- ── MISSING COLUMNS (ALTER TABLE) ──');
  for (const entry of missingColumns) {
    const qualified = entry.schema === 'public' ? escapeId(entry.table) : `${escapeId(entry.schema)}.${escapeId(entry.table)}`;
    lines.push(`-- ${entry.table}: +${entry.cols.length} columns`);
    lines.push(`ALTER TABLE ${qualified}`);
    const alterParts = entry.cols.map(c => '  ' + alterColDDL(c));
    lines.push(alterParts.join(',\n') + ';');
    lines.push('');
  }

  lines.push('COMMIT;');

  const outputPath = path.join(process.cwd(), 'apps', 'union-eyes', 'db', 'migrations', 'corrective-full-sync.sql');
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`Generated: ${outputPath}`);
  console.log(`  Missing tables: ${missingTables.length}`);
  console.log(`  Tables with missing columns: ${missingColumns.length} (${missingColumns.reduce((s, e) => s + e.cols.length, 0)} total columns)`);
  console.log(`  New enum types: ${enumCount}`);

  await client.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
