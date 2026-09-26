/**
 * Canonical Schema Verification — oracle-bound publisher consumer.
 *
 * Reads tooling/db/canonical-schema/manifest.json (published from the
 * runtime-schema authority oracle) and verifies every declared table exists
 * in its source file with all required columns.
 *
 * Also asserts publisher binding flags:
 *   PUBLISHER_SECOND_SCHEMA_AUTHORITY = NO
 *   PUBLISHER_CANONICAL_ORACLE = PASS
 *   MISSING_REQUIRED_TABLES/COLUMNS = 0
 *
 * Usage:
 *   pnpm tsx tooling/db/canonical-schema/verify.ts
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(join(__dirname, '..', '..', '..'))
const MANIFEST_PATH = join(__dirname, 'manifest.json')
const BINDING_PATH = join(__dirname, 'oracle-binding.json')
const ORACLE_PATH = join(REPO_ROOT, 'reports', 'union-eyes-runtime-schema-authority-oracle.json')
const DISPOSITION_PATH = join(
  REPO_ROOT,
  'reports',
  'union-eyes',
  'runtime-schema-lineage',
  'disposition-cards-29.json',
)

interface ManifestTable {
  source: string
  requiredColumns: string[]
  authority?: string
}

interface Manifest {
  tables: Record<string, ManifestTable>
  publisherSecondSchemaAuthority?: boolean
  authoritySource?: string
}

function verify(): void {
  const errors: string[] = []

  if (!existsSync(MANIFEST_PATH)) {
    console.error('❌ Canonical schema manifest not found:', MANIFEST_PATH)
    process.exit(1)
  }
  if (!existsSync(BINDING_PATH)) {
    console.error('❌ Oracle binding not found (run publish-from-runtime-oracle.ts):', BINDING_PATH)
    process.exit(1)
  }

  const binding = JSON.parse(readFileSync(BINDING_PATH, 'utf-8'))
  if (binding.PUBLISHER_SECOND_SCHEMA_AUTHORITY !== 'NO') {
    errors.push('PUBLISHER_SECOND_SCHEMA_AUTHORITY must be NO')
  }
  if (binding.PUBLISHER_CANONICAL_ORACLE !== 'PASS') {
    errors.push(`PUBLISHER_CANONICAL_ORACLE=${binding.PUBLISHER_CANONICAL_ORACLE}`)
  }
  if ((binding.MISSING_REQUIRED_TABLES ?? 1) !== 0) {
    errors.push(`MISSING_REQUIRED_TABLES=${binding.MISSING_REQUIRED_TABLES}`)
  }
  if ((binding.MISSING_REQUIRED_COLUMNS ?? 1) !== 0) {
    errors.push(`MISSING_REQUIRED_COLUMNS=${binding.MISSING_REQUIRED_COLUMNS}`)
  }

  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  if (manifest.publisherSecondSchemaAuthority !== false) {
    errors.push('manifest.publisherSecondSchemaAuthority must be false')
  }
  if (manifest.authoritySource !== 'reports/union-eyes-runtime-schema-authority-oracle.json') {
    errors.push('manifest.authoritySource must point at the runtime-schema authority oracle')
  }

  // Set equality vs oracle (disposition-adjusted REQUIRED)
  if (existsSync(ORACLE_PATH) && existsSync(DISPOSITION_PATH)) {
    const oracle = JSON.parse(readFileSync(ORACLE_PATH, 'utf-8'))
    const disp = JSON.parse(readFileSync(DISPOSITION_PATH, 'utf-8'))
    const excluded = new Set((disp.remainingCards || []).map((c: { TABLE: string }) => c.TABLE))
    const oracleRequired = new Set(
      (oracle.records || [])
        .filter((r: { table: string; canonicalRequirement?: string }) =>
          r.canonicalRequirement === 'REQUIRED' && !excluded.has(r.table),
        )
        .map((r: { table: string }) => r.table),
    )
    const published = new Set(Object.keys(manifest.tables))
    for (const t of oracleRequired) {
      if (!published.has(t)) errors.push(`Oracle REQUIRED table missing from published manifest: ${t}`)
    }
    for (const t of published) {
      if (!oracleRequired.has(t)) errors.push(`Published table not in oracle REQUIRED set (second authority?): ${t}`)
    }
  }

  for (const [tableName, def] of Object.entries(manifest.tables)) {
    if (def.authority && def.authority !== 'RUNTIME_SCHEMA_AUTHORITY_ORACLE') {
      errors.push(`Table "${tableName}": unexpected authority ${def.authority}`)
    }
    const sourcePath = join(REPO_ROOT, def.source)
    if (!existsSync(sourcePath)) {
      errors.push(`Table "${tableName}": source file not found — ${def.source}`)
      continue
    }
    const content = readFileSync(sourcePath, 'utf-8')
    if (!content.includes(`'${tableName}'`) && !content.includes(`"${tableName}"`)) {
      errors.push(`Table "${tableName}": table name not found in ${def.source}`)
      continue
    }
    for (const col of def.requiredColumns) {
      if (!content.includes(`'${col}'`) && !content.includes(`"${col}"`)) {
        errors.push(`Table "${tableName}": required column '${col}' not found in ${def.source}`)
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Canonical schema verification failed!\n')
    for (const err of errors.slice(0, 80)) console.error(`  • ${err}`)
    if (errors.length > 80) console.error(`  … ${errors.length - 80} more`)
    console.error(`\n${errors.length} error(s).`)
    console.error('Re-run: pnpm tsx tooling/db/canonical-schema/publish-from-runtime-oracle.ts\n')
    process.exit(1)
  }

  console.log(
    `✅ Canonical schema verified: ${Object.keys(manifest.tables).length} tables (oracle-bound), all required columns present.`,
  )
  console.log('PUBLISHER_SECOND_SCHEMA_AUTHORITY=NO')
  console.log('PUBLISHER_CANONICAL_ORACLE=PASS')
  console.log('MISSING_REQUIRED_TABLES=0')
  console.log('MISSING_REQUIRED_COLUMNS=0')
}

verify()
