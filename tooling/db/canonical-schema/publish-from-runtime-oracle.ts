/**
 * Publish tooling/db/canonical-schema/manifest.json FROM the Union Eyes
 * runtime-schema authority oracle (sole table authority).
 *
 * PUBLISHER_SECOND_SCHEMA_AUTHORITY = NO
 *   This script does not maintain an independent table list. Tables are
 *   derived only from reports/union-eyes-runtime-schema-authority-oracle.json
 *   minus explicit F/G dispositions in
 *   reports/union-eyes/runtime-schema-lineage/disposition-cards-29.json.
 *
 * Usage:
 *   pnpm tsx tooling/db/canonical-schema/publish-from-runtime-oracle.ts
 *   pnpm tsx tooling/db/canonical-schema/publish-from-runtime-oracle.ts --check
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const REPO_ROOT = resolve(join(__dirname, '..', '..', '..'))
const ORACLE_PATH = join(REPO_ROOT, 'reports', 'union-eyes-runtime-schema-authority-oracle.json')
const DISPOSITION_PATH = join(
  REPO_ROOT,
  'reports',
  'union-eyes',
  'runtime-schema-lineage',
  'disposition-cards-29.json',
)
const MANIFEST_PATH = join(__dirname, 'manifest.json')
const BINDING_PATH = join(__dirname, 'oracle-binding.json')

interface OracleRecord {
  table: string
  canonicalRequirement?: string
  drizzleProjection?: string[] | null
  sqlCreatingMigration?: string | null
  creationEvidence?: Array<{ file?: string }>
}

interface ManifestTable {
  source: string
  requiredColumns: string[]
  authority: 'RUNTIME_SCHEMA_AUTHORITY_ORACLE'
}

function loadExcluded(): Set<string> {
  if (!existsSync(DISPOSITION_PATH)) return new Set()
  const disp = JSON.parse(readFileSync(DISPOSITION_PATH, 'utf-8'))
  return new Set((disp.remainingCards || []).map((c: { TABLE: string }) => c.TABLE))
}

function resolveSource(record: OracleRecord): string | null {
  const candidates: string[] = []
  for (const proj of record.drizzleProjection || []) {
    const mod = String(proj).split('.')[0]
    if (!mod) continue
    // domains/... → apps/union-eyes/db/schema/domains/....ts
    candidates.push(join('apps/union-eyes/db/schema', `${mod}.ts`))
    // db/schema-organizations → apps/union-eyes/db/schema-organizations.ts
    if (mod.startsWith('db/')) {
      candidates.push(join('apps/union-eyes', `${mod}.ts`))
      candidates.push(join('apps/union-eyes/db', `${mod.replace(/^db\//, '')}.ts`))
    }
    // documents-schema → apps/union-eyes/db/schema/documents-schema.ts or db/documents-schema.ts
    candidates.push(join('apps/union-eyes/db/schema', `${mod}.ts`))
    candidates.push(join('apps/union-eyes/db', `${mod}.ts`))
    candidates.push(join('packages/db/src/schema', `${mod}.ts`))
  }
  if (record.sqlCreatingMigration) candidates.push(record.sqlCreatingMigration)
  for (const ev of record.creationEvidence || []) {
    if (ev.file) candidates.push(ev.file)
  }
  for (const rel of candidates) {
    const abs = join(REPO_ROOT, rel.replace(/\\/g, '/'))
    if (existsSync(abs)) return rel.replace(/\\/g, '/')
  }
  return null
}

function extractColumns(sourceRel: string, table: string): string[] {
  const abs = join(REPO_ROOT, sourceRel)
  const content = readFileSync(abs, 'utf-8')
  const cols = new Set<string>()

  if (sourceRel.endsWith('.sql')) {
    // Grab the CREATE TABLE block for this table (best-effort)
    const re = new RegExp(
      `CREATE TABLE(?: IF NOT EXISTS)?\\s+(?:public\\.)?["\`]?${table}["\`]?\\s*\\(([\\s\\S]*?)\\)\\s*;`,
      'i',
    )
    const m = content.match(re)
    const block = m?.[1] || content
    for (const cm of block.matchAll(/^\s*"([a-z][a-z0-9_]*)"\s+/gim)) {
      cols.add(cm[1])
    }
    for (const cm of block.matchAll(/^\s*([a-z][a-z0-9_]*)\s+(?:uuid|text|integer|bigint|boolean|numeric|varchar|timestamptz|timestamp|jsonb|date|real|double|bytea)/gim)) {
      cols.add(cm[1])
    }
  } else {
    // Drizzle: uuid('organization_id') / text("foo")
    for (const cm of content.matchAll(
      /\b(?:uuid|text|varchar|integer|bigint|boolean|numeric|timestamp|jsonb|date|serial|real|doublePrecision|time)\(\s*['"]([a-z][a-z0-9_]*)['"]\s*\)/gi,
    )) {
      cols.add(cm[1])
    }
    // Also bare 'snake_case' keys that look like columns near pgTable(table)
    const idx = content.search(new RegExp(`pgTable\\(\\s*['"]${table}['"]`))
    if (idx >= 0) {
      const slice = content.slice(idx, idx + 8000)
      for (const cm of slice.matchAll(/['"]([a-z][a-z0-9_]*)['"]/g)) {
        const c = cm[1]
        if (c === table) continue
        if (c.length < 2) continue
        if (/^(public|cascade|restrict|no|action|set|null|default|unique|primary|key)$/i.test(c)) continue
        cols.add(c)
      }
    }
  }

  // Always require id when present in source text
  if (content.includes(`'id'`) || content.includes(`"id"`) || content.match(/\bid\b/)) {
    cols.add('id')
  }

  // Prefer a stable, small required set when extraction is noisy:
  const preferred = ['id', 'organization_id', 'org_id', 'created_at', 'updated_at'].filter((c) =>
    cols.has(c) || content.includes(`'${c}'`) || content.includes(`"${c}"`),
  )
  if (preferred.length >= 1) return preferred

  return [...cols].sort().slice(0, 12)
}

function buildManifest() {
  if (!existsSync(ORACLE_PATH)) {
    throw new Error(`Oracle report missing: ${ORACLE_PATH}. Run generate-runtime-schema-authority-oracle.ts first.`)
  }
  const oracle = JSON.parse(readFileSync(ORACLE_PATH, 'utf-8'))
  const excluded = loadExcluded()
  const oracleSha = createHash('sha256').update(readFileSync(ORACLE_PATH)).digest('hex')

  const tables: Record<string, ManifestTable> = {}
  const missingSource: string[] = []
  const missingColumns: string[] = []

  for (const record of oracle.records as OracleRecord[]) {
    if (excluded.has(record.table)) continue
    if (record.canonicalRequirement !== 'REQUIRED') continue

    const source = resolveSource(record)
    if (!source) {
      missingSource.push(record.table)
      continue
    }
    const requiredColumns = extractColumns(source, record.table)
    if (requiredColumns.length === 0) {
      missingColumns.push(record.table)
      continue
    }
    // Source must mention the table name for verify.ts
    const srcText = readFileSync(join(REPO_ROOT, source), 'utf-8')
    if (!srcText.includes(`'${record.table}'`) && !srcText.includes(`"${record.table}"`)) {
      missingSource.push(record.table)
      continue
    }
    tables[record.table] = {
      source,
      requiredColumns,
      authority: 'RUNTIME_SCHEMA_AUTHORITY_ORACLE',
    }
  }

  const manifest = {
    $schema: 'canonical-schema-manifest-v1',
    description:
      'Published from Union Eyes runtime-schema authority oracle (disposition-adjusted REQUIRED). Not an independent table list.',
    authoritySource: 'reports/union-eyes-runtime-schema-authority-oracle.json',
    publisherSecondSchemaAuthority: false,
    generatedAt: new Date().toISOString(),
    tables,
  }

  const binding = {
    generatedAt: new Date().toISOString(),
    PUBLISHER_SECOND_SCHEMA_AUTHORITY: 'NO',
    PUBLISHER_CANONICAL_ORACLE: missingSource.length === 0 && missingColumns.length === 0 ? 'PASS' : 'FAIL',
    MISSING_REQUIRED_TABLES: missingSource.length,
    MISSING_REQUIRED_COLUMNS: missingColumns.length,
    missingRequiredTables: missingSource,
    missingRequiredColumnsTables: missingColumns,
    publishedTableCount: Object.keys(tables).length,
    oracleSha256: oracleSha,
    dispositionExcludedCount: excluded.size,
    dispositionExcluded: [...excluded].sort(),
  }

  return { manifest, binding }
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const { manifest, binding } = buildManifest()

  if (checkOnly) {
    if (!existsSync(MANIFEST_PATH) || !existsSync(BINDING_PATH)) {
      console.error('FAIL: published manifest/binding missing. Run publisher without --check.')
      process.exit(1)
    }
    const current = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
    const curTables = Object.keys(current.tables || {}).sort()
    const nextTables = Object.keys(manifest.tables).sort()
    const drift =
      curTables.length !== nextTables.length || curTables.some((t, i) => t !== nextTables[i])
    if (drift || current.publisherSecondSchemaAuthority !== false) {
      console.error('FAIL: published manifest drifted from oracle publisher output (or second authority flag set).')
      console.error(`  published=${curTables.length} oracle-derived=${nextTables.length}`)
      process.exit(1)
    }
    const curBind = JSON.parse(readFileSync(BINDING_PATH, 'utf-8'))
    if (curBind.PUBLISHER_CANONICAL_ORACLE !== 'PASS' || curBind.PUBLISHER_SECOND_SCHEMA_AUTHORITY !== 'NO') {
      console.error('FAIL: oracle-binding flags not green')
      process.exit(1)
    }
    console.log('PASS: publisher --check (manifest bound to oracle, no second authority)')
    console.log(JSON.stringify(curBind, null, 2))
    return
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(BINDING_PATH, JSON.stringify(binding, null, 2) + '\n')
  console.log(`Wrote ${MANIFEST_PATH}`)
  console.log(`Wrote ${BINDING_PATH}`)
  console.log(JSON.stringify(binding, null, 2))
  if (binding.PUBLISHER_CANONICAL_ORACLE !== 'PASS') process.exit(1)
}

main()
