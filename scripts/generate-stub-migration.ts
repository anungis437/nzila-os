/**
 * Generate ALTER TABLE / CREATE TABLE SQL to bring staging DB columns
 * in line with every Drizzle pgTable definition.
 *
 * Usage:
 *   npx tsx scripts/generate-stub-migration.ts
 *
 * Outputs:
 *   scripts/stub-migration.sql   — ready to run against staging
 */
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_DIR = path.resolve(__dirname, '../apps/union-eyes/db/schema');

// ── Drizzle type → Postgres type mapping ──────────────────────────────────
const typeMap: Record<string, string> = {
  uuid: 'UUID',
  text: 'TEXT',
  varchar: 'VARCHAR',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  timestamp: 'TIMESTAMPTZ',
  jsonb: 'JSONB',
  json: 'JSON',
  numeric: 'NUMERIC',
  decimal: 'NUMERIC',
  serial: 'SERIAL',
  bigint: 'BIGINT',
  smallint: 'SMALLINT',
  real: 'REAL',
  doublePrecision: 'DOUBLE PRECISION',
  char: 'CHAR',
  date: 'DATE',
  time: 'TIME',
  interval: 'INTERVAL',
  vector: 'TEXT',
};

interface ColumnDef {
  sqlName: string;
  pgType: string;
  isPrimaryKey: boolean;
}

interface TableDef {
  tableName: string;
  schema: string;
  columns: ColumnDef[];
  file: string;
}

// ── Extract Drizzle table definitions ─────────────────────────────────────
function extractTables(filePath: string): TableDef[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tables: TableDef[] = [];
  const relPath = path.relative(SCHEMA_DIR, filePath);

  // Detect custom schemas
  const schemaMap = new Map<string, string>();
  const schemaRegex = /(?:export\s+)?(?:const\s+)?(\w+)\s*=\s*pgSchema\s*\(\s*["']([^"']+)["']\s*\)/g;
  let sm;
  while ((sm = schemaRegex.exec(content)) !== null) {
    schemaMap.set(sm[1], sm[2]);
  }

  // Match pgTable("name", { ... }) or schemaVar.table("name", { ... })
  const tableRegex = /(?:(\w+)\.table|pgTable)\s*\(\s*["']([^"']+)["']\s*,\s*\{/g;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const schemaVarName = match[1];
    const tableName = match[2];
    const schema = schemaVarName ? (schemaMap.get(schemaVarName) || 'public') : 'public';
    const startIdx = match.index + match[0].length;

    // Find matching closing brace
    let depth = 1;
    let i = startIdx;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    const body = content.substring(startIdx, i - 1);
    const columns = parseColumns(body);
    if (columns.length > 0) {
      tables.push({ tableName, schema, columns, file: relPath });
    }
  }

  return tables;
}

function parseColumns(body: string): ColumnDef[] {
  const columns: ColumnDef[] = [];
  const seen = new Set<string>();

  // Split into lines and parse each column
  const lines = body.split('\n');
  
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    
    // Match: tsName: typeFunc("sql_name" ...) or tsName: enumVarName("sql_name" ...)
    const colMatch = line.match(/^\s*(\w+)\s*:\s*(\w+)\s*\(\s*["']([^"']+)["']/);
    if (!colMatch) continue;
    
    const typeOrEnum = colMatch[2];
    const sqlName = colMatch[3];
    
    if (seen.has(sqlName)) continue;
    seen.add(sqlName);
    
    // Determine PG type
    const isEnum = !typeMap[typeOrEnum];
    let pgType = isEnum ? 'TEXT' : typeMap[typeOrEnum];
    
    // Check for varchar length
    if (typeOrEnum === 'varchar') {
      const lenMatch = line.match(/length\s*:\s*(\d+)/);
      if (lenMatch) pgType = `VARCHAR(${lenMatch[1]})`;
    }
    
    // Check if primaryKey (look at the rest of this line + next few lines)
    const restOfDef = lines.slice(li, Math.min(li + 3, lines.length)).join(' ');
    const isPrimaryKey = /\.primaryKey\(\)/.test(restOfDef) && restOfDef.indexOf('.primaryKey()') < 200;
    
    columns.push({ sqlName, pgType, isPrimaryKey });
  }

  return columns;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function readStagingColumns(filePath: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('table_') || trimmed.startsWith('-') || trimmed.startsWith('(')) continue;
    const parts = trimmed.split('|').map(s => s.trim());
    if (parts.length < 3) continue;
    const [_schema, table, column] = parts;
    if (!table || !column) continue;
    if (!map.has(table)) map.set(table, new Set());
    map.get(table)!.add(column);
  }
  return map;
}

function getDefault(pgType: string): string {
  if (pgType === 'TEXT' || pgType.startsWith('VARCHAR') || pgType.startsWith('CHAR')) return "''";
  if (['INTEGER', 'BIGINT', 'SMALLINT', 'NUMERIC', 'REAL', 'DOUBLE PRECISION', 'SERIAL'].includes(pgType)) return '0';
  if (pgType === 'BOOLEAN') return 'false';
  if (pgType === 'JSONB') return "'{}'::jsonb";
  if (pgType === 'JSON') return "'{}'::json";
  if (pgType === 'UUID') return 'gen_random_uuid()';
  if (pgType === 'TIMESTAMPTZ' || pgType === 'TIMESTAMP' || pgType === 'DATE') return 'NOW()';
  if (pgType === 'TIME') return "'00:00:00'";
  if (pgType === 'INTERVAL') return "'0'";
  return "''";
}

async function main() {
  const allTables: TableDef[] = [];
  for (const file of walkDir(SCHEMA_DIR)) {
    allTables.push(...extractTables(file));
  }

  // Deduplicate by table name (keep definition with most columns)
  const tableMap = new Map<string, TableDef>();
  for (const t of allTables) {
    const existing = tableMap.get(t.tableName);
    if (!existing || t.columns.length > existing.columns.length) {
      tableMap.set(t.tableName, t);
    }
  }

  console.log(`Parsed ${tableMap.size} Drizzle table definitions`);

  const stagingFile = path.resolve(__dirname, 'staging-columns.txt');
  if (!fs.existsSync(stagingFile)) {
    console.error(`Missing ${stagingFile}`);
    process.exit(1);
  }
  const stagingCols = readStagingColumns(stagingFile);
  console.log(`Read staging data for ${stagingCols.size} tables`);

  const sqlLines: string[] = [
    '-- Auto-generated migration to sync staging DB with Drizzle schemas',
    `-- Generated: ${new Date().toISOString()}`,
    '',
    'BEGIN;',
    '',
  ];

  let alterCount = 0;
  let createCount = 0;
  let colsAdded = 0;

  for (const [tableName, def] of [...tableMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const stagingColSet = stagingCols.get(tableName);

    if (!stagingColSet) {
      // Table missing — CREATE TABLE in public schema
      // Skip non-public schemas
      if (def.schema !== 'public' && def.schema !== 'user_management') {
        sqlLines.push(`-- SKIP (schema "${def.schema}"): ${tableName}`);
        sqlLines.push('');
        continue;
      }

      const colDefs = def.columns.map(col => {
        let d = `  "${col.sqlName}" ${col.pgType}`;
        if (col.isPrimaryKey) d += ` PRIMARY KEY DEFAULT ${getDefault(col.pgType)}`;
        return d;
      });

      sqlLines.push(`-- CREATE: ${tableName} (${def.columns.length} cols) — ${def.file}`);
      sqlLines.push(`CREATE TABLE IF NOT EXISTS "${tableName}" (`);
      sqlLines.push(colDefs.join(',\n'));
      sqlLines.push(');');
      sqlLines.push('');
      createCount++;
      continue;
    }

    // Table exists — find missing columns
    const missingCols = def.columns.filter(col => !stagingColSet.has(col.sqlName));
    if (missingCols.length === 0) continue;

    sqlLines.push(`-- ALTER: ${tableName} (+${missingCols.length} cols) — ${def.file}`);

    for (const col of missingCols) {
      // All added columns are nullable with a type-appropriate default
      sqlLines.push(
        `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${col.sqlName}" ${col.pgType} DEFAULT ${getDefault(col.pgType)};`
      );
      colsAdded++;
    }
    sqlLines.push('');
    alterCount++;
  }

  sqlLines.push('COMMIT;');
  sqlLines.push('');
  sqlLines.push(`-- Summary: ${alterCount} tables altered, ${createCount} tables created, ${colsAdded} columns added`);

  const outFile = path.resolve(__dirname, 'stub-migration.sql');
  fs.writeFileSync(outFile, sqlLines.join('\n'));
  console.log(`\nGenerated: ${outFile}`);
  console.log(`  ${alterCount} ALTER TABLE statements`);
  console.log(`  ${createCount} CREATE TABLE statements`);
  console.log(`  ${colsAdded} total columns to add`);
}

main().catch(console.error);
