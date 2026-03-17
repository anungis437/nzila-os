/**
 * Audit script: compare Drizzle pgTable column counts vs staging DB column counts.
 * Outputs mismatches where staging has fewer columns than the schema expects.
 *
 * Usage: npx tsx scripts/audit-stubs.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_DIR = path.resolve(__dirname, '../apps/union-eyes/db/schema');
const STAGING_FILE = path.resolve(__dirname, 'staging-col-counts.txt');

// Parse staging column counts
const stagingCounts = new Map<string, number>();
for (const line of fs.readFileSync(STAGING_FILE, 'utf-8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const [tableName, countStr] = trimmed.split('|');
  if (tableName && countStr) {
    stagingCounts.set(tableName.trim(), parseInt(countStr.trim()));
  }
}

// Parse Drizzle schema files for pgTable definitions
interface TableDef {
  tableName: string;
  columnCount: number;
  file: string;
  columns: string[];
}

function extractTables(filePath: string): TableDef[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tables: TableDef[] = [];
  
  // Match pgTable("table_name", { ... }) or .table("table_name", { ... })
  const tableRegex = /(?:pgTable|\.table)\s*\(\s*["']([^"']+)["']\s*,\s*\{/g;
  let match;
  
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const startIdx = match.index + match[0].length;
    
    // Find the matching closing brace by counting braces
    let depth = 1;
    let i = startIdx;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    
    const body = content.substring(startIdx, i - 1);
    
    // Count columns: lines that contain a colon followed by a Drizzle type call
    // e.g., `columnName: uuid(...)`, `columnName: text(...)`, etc.
    const columnPatterns = /^\s*(\w+)\s*:\s*(?:uuid|text|varchar|integer|boolean|timestamp|jsonb|json|numeric|decimal|serial|bigint|smallint|real|doublePrecision|char|date|time|interval|pgEnum|customType|vector)\s*\(/gm;
    const columns: string[] = [];
    let colMatch;
    while ((colMatch = columnPatterns.exec(body)) !== null) {
      columns.push(colMatch[1]);
    }
    
    // Also catch enum references like: decisionType: decisionTypeEnum("decision_type")
    const enumColumnPattern = /^\s*(\w+)\s*:\s*\w+Enum\s*\(/gm;
    let enumMatch;
    while ((enumMatch = enumColumnPattern.exec(body)) !== null) {
      if (!columns.includes(enumMatch[1])) {
        columns.push(enumMatch[1]);
      }
    }
    
    if (columns.length > 0) {
      tables.push({
        tableName,
        columnCount: columns.length,
        file: path.relative(SCHEMA_DIR, filePath),
        columns,
      });
    }
  }
  
  return tables;
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

// Gather all Drizzle table definitions
const allTables: TableDef[] = [];
for (const file of walkDir(SCHEMA_DIR)) {
  allTables.push(...extractTables(file));
}

// Deduplicate by table name (keep the one with most columns)
const tableMap = new Map<string, TableDef>();
for (const t of allTables) {
  const existing = tableMap.get(t.tableName);
  if (!existing || t.columnCount > existing.columnCount) {
    tableMap.set(t.tableName, t);
  }
}

// Compare
interface Mismatch {
  tableName: string;
  drizzleCols: number;
  stagingCols: number;
  missingCount: number;
  file: string;
  drizzleColumns: string[];
}

const mismatches: Mismatch[] = [];
const missing: TableDef[] = [];

for (const [tableName, def] of tableMap) {
  const stagingCount = stagingCounts.get(tableName);
  if (stagingCount === undefined) {
    missing.push(def);
  } else if (stagingCount < def.columnCount) {
    mismatches.push({
      tableName,
      drizzleCols: def.columnCount,
      stagingCols: stagingCount,
      missingCount: def.columnCount - stagingCount,
      file: def.file,
      drizzleColumns: def.columns,
    });
  }
}

// Sort by missing count descending
mismatches.sort((a, b) => b.missingCount - a.missingCount);

console.log(`\n=== DRIZZLE SCHEMA AUDIT ===`);
console.log(`Total Drizzle tables: ${tableMap.size}`);
console.log(`Total staging tables: ${stagingCounts.size}`);
console.log(`Tables with column mismatches: ${mismatches.length}`);
console.log(`Tables missing from staging entirely: ${missing.length}`);

if (mismatches.length > 0) {
  console.log(`\n--- COLUMN MISMATCHES (staging has fewer cols than Drizzle) ---`);
  console.log(`${'TABLE'.padEnd(45)} ${'DRIZZLE'.padStart(8)} ${'STAGING'.padStart(8)} ${'MISSING'.padStart(8)}  FILE`);
  for (const m of mismatches) {
    console.log(`${m.tableName.padEnd(45)} ${String(m.drizzleCols).padStart(8)} ${String(m.stagingCols).padStart(8)} ${String(m.missingCount).padStart(8)}  ${m.file}`);
  }
}

if (missing.length > 0) {
  console.log(`\n--- TABLES MISSING FROM STAGING ---`);
  for (const m of missing) {
    console.log(`  ${m.tableName} (${m.columnCount} cols, ${m.file})`);
  }
}

// Output JSON for further processing
const report = { mismatches, missing: missing.map(m => ({ tableName: m.tableName, columnCount: m.columnCount, file: m.file })) };
fs.writeFileSync(path.resolve(__dirname, 'stub-audit-report.json'), JSON.stringify(report, null, 2));
console.log(`\nFull report written to scripts/stub-audit-report.json`);
