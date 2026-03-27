/**
 * Canonical Schema Verification (Phase 2)
 *
 * Reads manifest.json and verifies that every declared table exists
 * in its source file with all required columns.
 *
 * Usage:
 *   pnpm tsx tooling/db/canonical-schema/verify.ts
 *
 * Exit code 1 on any missing table or column.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(join(__dirname, '..', '..', '..'))
const MANIFEST_PATH = join(__dirname, 'manifest.json')

interface ManifestTable {
  source: string
  requiredColumns: string[]
}

interface Manifest {
  tables: Record<string, ManifestTable>
}

function verify(): void {
  if (!existsSync(MANIFEST_PATH)) {
    console.error('❌ Canonical schema manifest not found:', MANIFEST_PATH)
    process.exit(1)
  }

  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  const errors: string[] = []

  for (const [tableName, def] of Object.entries(manifest.tables)) {
    const sourcePath = join(REPO_ROOT, def.source)

    if (!existsSync(sourcePath)) {
      errors.push(`Table "${tableName}": source file not found — ${def.source}`)
      continue
    }

    const content = readFileSync(sourcePath, 'utf-8')

    // Verify pgTable definition references this table name (single or double quotes)
    if (!content.includes(`'${tableName}'`) && !content.includes(`"${tableName}"`)) {
      errors.push(`Table "${tableName}": pgTable('${tableName}', …) not found in ${def.source}`)
      continue
    }

    // Verify each required column is present (Drizzle uses 'column_name' or "column_name")
    for (const col of def.requiredColumns) {
      if (!content.includes(`'${col}'`) && !content.includes(`"${col}"`)) {
        errors.push(`Table "${tableName}": required column '${col}' not found in ${def.source}`)
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Canonical schema verification failed!\n')
    for (const err of errors) {
      console.error(`  • ${err}`)
    }
    console.error(`\n${errors.length} error(s) found.`)
    console.error('Update the source schema or tooling/db/canonical-schema/manifest.json\n')
    process.exit(1)
  }

  console.log(
    `✅ Canonical schema verified: ${Object.keys(manifest.tables).length} tables, all required columns present.`,
  )
}

verify()
