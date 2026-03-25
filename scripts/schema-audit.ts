/**
 * schema-audit.ts — Compare Drizzle schema definitions against actual PostgreSQL database
 * 
 * This script imports the actual Drizzle schema objects (no regex parsing) and
 * introspects their metadata using drizzle-orm internals. This gives 100% accurate
 * table/column discovery across all patterns: pgTable, pgSchema.table, .array(),
 * complex defaults, etc.
 * 
 * Detects:
 * - Tables defined in code but missing from DB
 * - Columns defined in code but missing from DB
 * - Tables in DB but not in schema (orphans)
 * - Type mismatches between Drizzle and PostgreSQL
 */
import { getTableName, getTableColumns, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// ── DB connection ──────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nzila:nzila_dev@localhost:5433/nzila_automation';
const client = postgres(DATABASE_URL, { max: 1 });

interface DBColumn {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
}

interface SchemaIssue {
  id: string;
  area: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  schema: string;
  table: string;
  column?: string;
  drizzleType?: string;
  dbType?: string;
  description: string;
  rootCause: string;
}

interface DrizzleTableInfo {
  dbSchema: string;     // 'public' or 'audit_security' etc.
  tableName: string;
  columns: Map<string, { name: string; columnType: string; notNull: boolean; hasDefault: boolean }>;
}

// ── Query actual DB across all relevant schemas ────────────────────────────
async function getActualColumns(): Promise<Map<string, Map<string, DBColumn>>> {
  const rows = await client<DBColumn[]>`
    SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default::text
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'audit_security', 'user_management')
    ORDER BY table_schema, table_name, ordinal_position
  `;

  // key = "schema.table"
  const result = new Map<string, Map<string, DBColumn>>();
  for (const row of rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!result.has(key)) result.set(key, new Map());
    result.get(key)!.set(row.column_name, row);
  }
  return result;
}

async function getActualTables(): Promise<Set<string>> {
  const rows = await client`
    SELECT table_schema, table_name FROM information_schema.tables 
    WHERE table_type = 'BASE TABLE' 
      AND table_schema IN ('public', 'audit_security', 'user_management')
    ORDER BY table_schema, table_name
  `;
  return new Set(rows.map(r => `${r.table_schema}.${r.table_name}`));
}

// ── Extract table metadata from Drizzle schema objects ─────────────────────
function extractDrizzleTables(schemaExports: Record<string, unknown>): DrizzleTableInfo[] {
  const tables: DrizzleTableInfo[] = [];
  const seen = new Set<string>(); // dedup by schema.table

  for (const [exportName, value] of Object.entries(schemaExports)) {
    if (!is(value, PgTable)) continue;

    const tbl = value as PgTable<any>;
    const tableName = getTableName(tbl);

    // Detect schema — check for Symbol with schema info
    let dbSchema = 'public';
    const symbols = Object.getOwnPropertySymbols(tbl);
    const schemaSym = symbols.find(s => s.toString().includes('Schema'));
    if (schemaSym) {
      const schemaVal = (tbl as any)[schemaSym];
      if (schemaVal && typeof schemaVal === 'string') dbSchema = schemaVal;
      else if (schemaVal && typeof schemaVal === 'object' && schemaVal.schemaName) dbSchema = schemaVal.schemaName;
    }

    const key = `${dbSchema}.${tableName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const drizzleCols = getTableColumns(tbl);
    const columns = new Map<string, { name: string; columnType: string; notNull: boolean; hasDefault: boolean }>();

    for (const [jsName, col] of Object.entries(drizzleCols)) {
      const c = col as any;
      columns.set(c.name, {
        name: c.name,
        columnType: c.columnType,
        notNull: c.notNull ?? false,
        hasDefault: c.hasDefault ?? false,
      });
    }

    tables.push({ dbSchema, tableName, columns });
  }

  return tables;
}

// ── Drizzle columnType → PostgreSQL data_type mapping ──────────────────────
const DRIZZLE_TO_PG: Record<string, string[]> = {
  'PgUUID':     ['uuid'],
  'PgVarchar':  ['character varying'],
  'PgText':     ['text', 'ARRAY'],       // text or text[]
  'PgBoolean':  ['boolean'],
  'PgTimestamp': ['timestamp with time zone', 'timestamp without time zone'],
  'PgDate':     ['date'],
  'PgInteger':  ['integer'],
  'PgNumeric':  ['numeric'],
  'PgJsonb':    ['jsonb'],
  'PgSerial':   ['integer'],
  'PgBigint':   ['bigint'],
  'PgDoublePrecision': ['double precision'],
  'PgReal':     ['real'],
  'PgSmallInt': ['smallint'],
  'PgChar':     ['character'],
  'PgTime':     ['time with time zone', 'time without time zone'],
  'PgInterval': ['interval'],
  'PgCidr':     ['cidr'],
  'PgInet':     ['inet'],
  'PgMacaddr':  ['macaddr'],
  'PgBigSerial': ['bigint'],
  'PgSmallSerial': ['smallint'],
  'PgDecimal':  ['numeric'],
  'PgEnumColumn': ['USER-DEFINED'],
  'PgArray':    ['ARRAY'],
  'PgCustomColumn': [],  // skip custom columns
};

function typesCompatible(drizzleType: string, pgDataType: string): boolean {
  const allowed = DRIZZLE_TO_PG[drizzleType];
  if (!allowed) return true; // unknown type — don't flag
  if (allowed.length === 0) return true; // skip
  return allowed.includes(pgDataType);
}

async function main() {
  console.log('=== SCHEMA AUDIT: Drizzle vs Actual Database ===\n');

  // ── Load actual DB schema ──
  const actualColumns = await getActualColumns();
  const actualTables = await getActualTables();
  const issues: SchemaIssue[] = [];

  const totalDbCols = Array.from(actualColumns.values()).reduce((sum, cols) => sum + cols.size, 0);
  console.log(`Actual DB tables: ${actualTables.size}`);
  console.log(`Actual DB columns: ${totalDbCols}`);

  // ── Import Drizzle schema ──
  // Main schema: what union-eyes actually uses (for missing table/column/type checks)
  const mainSchema = await import('../apps/union-eyes/db/schema/index');
  const drizzleTables = extractDrizzleTables(mainSchema);

  console.log(`\nDrizzle tables (deduplicated): ${drizzleTables.length}`);
  const totalSchemaCols = drizzleTables.reduce((sum, t) => sum + t.columns.size, 0);
  console.log(`Drizzle columns: ${totalSchemaCols}`);

  // Extended schema: collect table keys from ALL sources for orphan detection
  // IMPORTANT: extract tables from each source independently to avoid Object.assign
  // overwriting table definitions (e.g., phase-4 schema remaps communicationPreferences)
  const allDefinedTableKeys = new Set(drizzleTables.map(t => `${t.dbSchema}.${t.tableName}`));

  function addTablesFromModule(mod: Record<string, unknown>) {
    for (const tbl of extractDrizzleTables(mod)) {
      allDefinedTableKeys.add(`${tbl.dbSchema}.${tbl.tableName}`);
    }
  }

  // packages/db
  try {
    const pkgDbSchema = await import('../packages/db/src/schema/index');
    addTablesFromModule(pkgDbSchema);
  } catch { /* optional */ }

  // Legacy flat *-schema.ts files
  const legacyDir = path.join(process.cwd(), 'apps', 'union-eyes', 'db', 'schema');
  const legacyFiles = fs.readdirSync(legacyDir).filter(f => f.endsWith('-schema.ts'));
  for (const file of legacyFiles) {
    try {
      const absPath = path.join(legacyDir, file);
      const mod = await import(`file://${absPath.replace(/\\/g, '/')}`);
      addTablesFromModule(mod);
    } catch { /* skip files with broken deps */ }
  }

  // Financial-service sub-schema
  try {
    const finMod = await import('../apps/union-eyes/services/financial-service/drizzle/schema');
    addTablesFromModule(finMod);
  } catch { /* optional */ }

  console.log(`Extended schema table keys (for orphan check): ${allDefinedTableKeys.size}`);

  const definedTableKeys = new Set(drizzleTables.map(t => `${t.dbSchema}.${t.tableName}`));

  // ── CHECK 1: Tables in schema but missing from DB ──
  console.log('\n─── TABLES IN SCHEMA BUT MISSING FROM DB ───');
  let missingCount = 0;
  for (const table of drizzleTables) {
    const key = `${table.dbSchema}.${table.tableName}`;
    if (!actualTables.has(key)) {
      missingCount++;
      console.log(`  MISSING TABLE: ${key}  (${table.columns.size} cols)`);
      issues.push({
        id: `MISSING_TABLE_${issues.length + 1}`,
        area: 'schema_mismatch',
        severity: 'critical',
        schema: table.dbSchema,
        table: table.tableName,
        description: `Table "${key}" defined in schema but does not exist in database`,
        rootCause: 'Migration not applied or table definition added without migration',
      });
    }
  }
  if (missingCount === 0) console.log('  None');

  // ── CHECK 2: Columns in schema but missing from DB ──
  console.log('\n─── COLUMNS IN SCHEMA BUT MISSING FROM DB ───');
  let colMissingCount = 0;
  for (const table of drizzleTables) {
    const key = `${table.dbSchema}.${table.tableName}`;
    if (!actualTables.has(key)) continue;
    const actualCols = actualColumns.get(key);
    if (!actualCols) continue;

    for (const [colName, colDef] of table.columns) {
      if (!actualCols.has(colName)) {
        colMissingCount++;
        console.log(`  MISSING COLUMN: ${key}.${colName}  (drizzle type: ${colDef.columnType})`);
        issues.push({
          id: `MISSING_COL_${issues.length + 1}`,
          area: 'schema_mismatch',
          severity: 'critical',
          schema: table.dbSchema,
          table: table.tableName,
          column: colName,
          drizzleType: colDef.columnType,
          description: `Column "${colName}" defined in schema but missing from "${key}"`,
          rootCause: 'Migration not applied for this column',
        });
      }
    }
  }
  if (colMissingCount === 0) console.log('  None');

  // ── CHECK 3: Type mismatches ──
  console.log('\n─── TYPE MISMATCHES ───');
  let typeMismatchCount = 0;
  for (const table of drizzleTables) {
    const key = `${table.dbSchema}.${table.tableName}`;
    if (!actualTables.has(key)) continue;
    const actualCols = actualColumns.get(key);
    if (!actualCols) continue;

    for (const [colName, colDef] of table.columns) {
      const actual = actualCols.get(colName);
      if (!actual) continue;
      if (!typesCompatible(colDef.columnType, actual.data_type)) {
        typeMismatchCount++;
        console.log(`  TYPE MISMATCH: ${key}.${colName}  drizzle=${colDef.columnType} db=${actual.data_type} (${actual.udt_name})`);
        issues.push({
          id: `TYPE_MISMATCH_${issues.length + 1}`,
          area: 'type_mismatch',
          severity: 'medium',
          schema: table.dbSchema,
          table: table.tableName,
          column: colName,
          drizzleType: colDef.columnType,
          dbType: `${actual.data_type} (${actual.udt_name})`,
          description: `Type mismatch on "${key}.${colName}": Drizzle=${colDef.columnType}, DB=${actual.data_type}`,
          rootCause: 'Schema definition does not match actual column type',
        });
      }
    }
  }
  if (typeMismatchCount === 0) console.log('  None');

  // ── CHECK 4: Tables in DB but not in schema (orphans) ──
  // Uses allDefinedTableKeys (extended schema) to avoid false-positive orphans
  console.log('\n─── TABLES IN DB BUT NOT IN SCHEMA (potential orphans) ───');
  let orphanCount = 0;
  const knownExternalPrefixes = [
    'django_', 'auth_', 'commerce_', 'trade_', 'nacp_', 'platform_', 'zonga_',
  ];
  for (const fullKey of actualTables) {
    if (allDefinedTableKeys.has(fullKey)) continue;
    const tableName = fullKey.split('.')[1];
    if (knownExternalPrefixes.some(p => tableName.startsWith(p))) continue;
    orphanCount++;
    console.log(`  ORPHAN TABLE: ${fullKey}`);
  }
  if (orphanCount === 0) console.log('  None');

  // ── SUMMARY ──
  console.log('\n═══ AUDIT SUMMARY ═══');
  console.log(`Missing tables: ${missingCount}`);
  console.log(`Missing columns: ${colMissingCount}`);
  console.log(`Type mismatches: ${typeMismatchCount}`);
  console.log(`Orphan tables: ${orphanCount}`);
  console.log(`Total issues: ${issues.length}`);

  // Write issues to JSON
  const outputPath = path.join(process.cwd(), 'audit-schema-issues.json');
  fs.writeFileSync(outputPath, JSON.stringify(issues, null, 2));
  console.log(`\nIssues written to: ${outputPath}`);
  
  await client.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
