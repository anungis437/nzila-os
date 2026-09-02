#!/usr/bin/env tsx
/**
 * scripts/generate-public-schema-grant-census.ts
 *
 * PR #752 round 7: the storage-authority manifest was built by scanning for
 * tenant-shaped columns (organization_id/org_id/tenant_id) plus the 0108
 * baseline — but the manifest is becoming the source for the eventual
 * explicit REVOKE + per-table GRANT generation for union_eyes_runtime and
 * union_eyes_system, which cannot be scoped to "tenant-shaped tables" alone.
 * A non-tenant-shaped but operational table (global reference data, a
 * queue/state table, a lookup table) that never qualified for the
 * tenant-column scan would silently lose its runtime grant the moment a
 * blanket `GRANT ... ON ALL TABLES IN SCHEMA public` is replaced with
 * explicit per-table grants derived only from this manifest.
 *
 * This script answers the actual scope question directly: for every
 * canonical PUBLIC-schema table declaration (scripts/schema-duplicate-table-scan.ts's
 * scanSchemaDeclarations() — the same canonical scanner used for schema-
 * conflict analysis, not a second independent table list), does it have
 * exactly one entry in db/rls-storage-authority-manifest.ts?
 *
 * Usage: tsx scripts/generate-public-schema-grant-census.ts
 * Output: reports/union-eyes-public-schema-grant-census.{json,md}
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { scanSchemaDeclarations } from './schema-duplicate-table-scan'
import { storageAuthorityManifest } from '../db/rls-storage-authority-manifest'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

function main() {
  const declarations = scanSchemaDeclarations()
  const manifestTables = new Set(storageAuthorityManifest.map((e) => e.table))

  const publicTables: string[] = []
  const nonPublicTables: Array<{ table: string; schema: string }> = []

  for (const [key, decls] of declarations) {
    const schema = decls[0]?.schema ?? 'public'
    // Keys are `${schema}.${table}` per canonical-schema-map.ts's own
    // convention; strip the schema prefix to get the bare table name that
    // db/rls-storage-authority-manifest.ts's `table` field uses.
    const tableName = key.startsWith(`${schema}.`) ? key.slice(schema.length + 1) : key
    if (schema === 'public') {
      publicTables.push(tableName)
    } else {
      nonPublicTables.push({ table: tableName, schema })
    }
  }

  const withEntry = publicTables.filter((t) => manifestTables.has(t)).sort()
  const withoutEntry = publicTables.filter((t) => !manifestTables.has(t)).sort()

  const summary = {
    generatedAt: new Date().toISOString(),
    note:
      'Source of truth for "every canonical PUBLIC-schema table" is scripts/schema-duplicate-table-scan.ts\'s scanSchemaDeclarations() (db/schema/** only \u2014 does not include services/financial-service\'s own separate database boundary). This census answers scope-completeness for the eventual explicit-GRANT generator; it does NOT re-verify RLS policy correctness (see scripts/rls-verify.ts for that).',
    totalPhysicalTableKeys: declarations.size,
    publicSchemaTableCount: publicTables.length,
    nonPublicSchemaTableCount: nonPublicTables.length,
    nonPublicSchemas: [...new Set(nonPublicTables.map((t) => t.schema))].sort(),
    publicTablesWithAuthorityEntry: withEntry.length,
    publicTablesWithoutAuthorityEntry: withoutEntry.length,
    publicTablesWithoutAuthorityEntryList: withoutEntry,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'union-eyes-public-schema-grant-census.json'), JSON.stringify(summary, null, 2))

  const md = [
    '# Union Eyes — Public-Schema Grant-Scope Census',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    summary.note,
    '',
    `- Total canonical physical (schema, table) keys: ${summary.totalPhysicalTableKeys}`,
    `- Public-schema tables: ${summary.publicSchemaTableCount}`,
    `- Non-public-schema tables: ${summary.nonPublicSchemaTableCount} (schemas: ${summary.nonPublicSchemas.join(', ') || 'none'})`,
    `- Public tables WITH an authority-manifest entry: ${summary.publicTablesWithAuthorityEntry}`,
    `- Public tables WITHOUT an authority-manifest entry: ${summary.publicTablesWithoutAuthorityEntry}`,
    '',
    '## Public tables missing an authority-manifest entry',
    '',
    ...(withoutEntry.length > 0 ? withoutEntry.map((t) => `- ${t}`) : ['(none)']),
    '',
  ].join('\n')
  writeFileSync(resolve(OUT_DIR, 'union-eyes-public-schema-grant-census.md'), md)

  console.log(`Total physical keys: ${summary.totalPhysicalTableKeys}`)
  console.log(`Public schema tables: ${summary.publicSchemaTableCount}`)
  console.log(`Non-public schema tables: ${summary.nonPublicSchemaTableCount}`)
  console.log(`Public tables WITH authority entry: ${summary.publicTablesWithAuthorityEntry}`)
  console.log(`Public tables WITHOUT authority entry: ${summary.publicTablesWithoutAuthorityEntry}`)
  console.log('Report written to reports/union-eyes-public-schema-grant-census.{json,md}')
}

main()
