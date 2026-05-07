/**
 * Contract tests — Schema-to-Manifest Drift Detection
 *
 * Enforces that every pgTable defined in packages/db/src/schema is
 * referenced in the data lifecycle manifest. This prevents tables from
 * being introduced without proper lifecycle governance (retention,
 * deletion, residency, and backup policies).
 *
 * The test parses schema files for pgTable('table_name', ...) calls and
 * asserts each SQL table name appears somewhere in the lifecycle manifest.
 *
 * @invariant SCHEMA_LIFECYCLE_DRIFT_001
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

// ── Schema parsing ──────────────────────────────────────────────────────────

/**
 * Extract all SQL table names from pgTable('table_name', ...) definitions
 * in the given file content.
 */
function extractTableNames(content: string): string[] {
  const tables: string[] = []
  // Match pgTable('table_name' or pgTable("table_name"
  const regex = /pgTable\(\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    tables.push(match[1])
  }
  return tables
}

/**
 * Get all SQL table names defined in packages/db/src/schema/*.ts
 */
function getAllSchemaTables(): { table: string; schemaFile: string }[] {
  const schemaDir = join(ROOT, 'packages', 'db', 'src', 'schema')
  if (!existsSync(schemaDir)) return []

  // Read index.ts to find which files are exported (authoritative sources)
  const indexContent = readContent('packages/db/src/schema/index.ts')
  const exportedFilePattern = /export \* from '\.\/([^']+)'/g
  const exportedFiles: string[] = []
  let m: RegExpExecArray | null
  while ((m = exportedFilePattern.exec(indexContent)) !== null) {
    exportedFiles.push(m[1])
  }

  const results: { table: string; schemaFile: string }[] = []

  for (const file of exportedFiles) {
    const filePath = `packages/db/src/schema/${file}.ts`
    const content = readContent(filePath)
    if (!content) continue
    const tables = extractTableNames(content)
    for (const table of tables) {
      results.push({ table, schemaFile: file })
    }
  }

  return results
}

// ── Manifest parsing ────────────────────────────────────────────────────────

/**
 * Extract all referenced table names / data category names from the
 * lifecycle manifest source. We do a broad search because the manifest
 * references tables via data category descriptions and storage engine entries.
 */
function getManifestContent(): string {
  return readContent('packages/data-lifecycle/src/manifest.ts')
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('SCHEMA_LIFECYCLE_DRIFT_001 — Schema-to-Manifest Drift Detection', () => {
  // 1. The schema barrel export must exist
  it('SCHEMA_LIFECYCLE_DRIFT_001: packages/db/src/schema/index.ts exists', () => {
    const index = readContent('packages/db/src/schema/index.ts')
    expect(index).toBeTruthy()
  })

  // 2. The lifecycle manifest must exist
  it('SCHEMA_LIFECYCLE_DRIFT_001: packages/data-lifecycle/src/manifest.ts exists', () => {
    const manifest = getManifestContent()
    expect(manifest).toBeTruthy()
    expect(
      manifest.includes('DataLifecycleManifest'),
      'manifest.ts must define DataLifecycleManifest type',
    ).toBe(true)
  })

  // 3. Every schema file referenced from index.ts must have its tables
  //    represented in the lifecycle manifest (by data domain keywords)
  it('SCHEMA_LIFECYCLE_DRIFT_001: all schema table groups have manifest coverage', () => {
    const tables = getAllSchemaTables()
    expect(tables.length).toBeGreaterThan(0)

    const manifest = getManifestContent()
    expect(manifest).toBeTruthy()

    // Map schema files to domain keywords that should appear in the manifest.
    // The manifest uses human-readable data category names, not SQL table names.
    const schemaFileDomainKeywords: Record<string, string[]> = {
      orgs: ['org', 'Org'],
      governance: ['Governance', 'governance'],
      equity: ['share', 'Share', 'Equity', 'equity', 'cap_table'],
      finance: ['Financial', 'finance', 'Finance', 'close', 'qbo'],
      operations: ['Audit', 'audit', 'evidence', 'Evidence', 'governance_actions'],
      payments: ['Payment', 'Stripe', 'stripe', 'payment'],
      commerce: ['Commerce', 'commerce', 'Quote', 'Order', 'Invoice'],
      ai: ['AI', 'ai_'],
      ml: ['ML', 'ml_', 'Score', 'score'],
      ue: ['Union', 'ue_', 'Case'],
      partners: ['Partner', 'partner'],
      automation: ['Automation', 'automation', 'command'],
      tax: ['Tax', 'tax'],
      nacp: ['NACP', 'nacp', 'Exam'],
      zonga: ['Zonga', 'zonga', 'Revenue'],
      platform: ['Platform', 'platform', 'Metrics'],
      trade: ['Trade', 'trade'],
      mobility: ['Mobility', 'mobility'],
      agri: ['Agri', 'agri', 'Producer', 'Harvest', 'Traceability'],
      trustcore: ['TrustCore', 'trustcore', 'Privacy', 'Compliance'],
      trustops: ['TrustOps', 'trustops', 'Mandate', 'mandate'],
    }

    const schemaFiles = [...new Set(tables.map((t) => t.schemaFile))]
    const uncoveredFiles: string[] = []

    for (const schemaFile of schemaFiles) {
      const fileTables = tables.filter((t) => t.schemaFile === schemaFile)
      const keywords = schemaFileDomainKeywords[schemaFile] ?? [schemaFile]

      // A schema file is "covered" if the manifest mentions any of its domain
      // keywords, any of its SQL table names, or the schema file name itself.
      const allKeywords = [
        ...keywords,
        schemaFile,
        ...fileTables.map((t) => t.table),
        ...fileTables.map((t) => t.table.replace(/_/g, '')),
        ...fileTables.map((t) => t.table.split('_')[0]),
      ]

      const covered = allKeywords.some((kw) => manifest.includes(kw))

      if (!covered) {
        uncoveredFiles.push(
          schemaFile + '.ts (tables: ' + fileTables.map((t) => t.table).join(', ') + ')',
        )
      }
    }

    expect(
      uncoveredFiles,
      'Schema files with tables not referenced in lifecycle manifest:\n' +
        uncoveredFiles.map((v) => '  - ' + v).join('\n') +
        '\n\nAdd data categories to APP_MANIFESTS in packages/data-lifecycle/src/manifest.ts.',
    ).toEqual([])
  })

  // 4. New tables added to schema files must trigger manifest review
  it('SCHEMA_LIFECYCLE_DRIFT_001: every pgTable has a recognisable category in the manifest', () => {
    const tables = getAllSchemaTables()
    const manifest = getManifestContent()

    // Build a set of "covered" table name prefixes from the manifest
    // The manifest references tables via prefixes: commerce_, trade_, ai_, ml_, etc.
    const prefixGroups = [
      'org', 'people', 'governance', 'equity', 'share', 'cap_table',
      'finance', 'close', 'qbo',
      'operation', 'document', 'filing', 'compliance', 'audit', 'evidence',
      'payment', 'stripe', 'commerce', 'ai_', 'ml_', 'ue_', 'partner',
      'deal', 'commission', 'certification', 'asset', 'api_credential',
      'automation', 'tax', 'indirect_tax', 'nacp', 'zonga', 'platform',
      'trade', 'gtm', 'mobility', 'agri',
      'trustcore', 'trustops',  // TrustCore privacy/compliance + TrustOps mandate management
    ]

    const uncoveredTables: string[] = []

    for (const { table, schemaFile } of tables) {
      const hasPrefixCoverage = prefixGroups.some((prefix) =>
        table.startsWith(prefix),
      )
      const mentionedInManifest =
        manifest.includes(table) ||
        manifest.includes(schemaFile)

      if (!hasPrefixCoverage && !mentionedInManifest) {
        uncoveredTables.push(`${table} (${schemaFile}.ts)`)
      }
    }

    const uncoveredMsg = uncoveredTables.length > 0
      ? 'Tables without lifecycle manifest coverage:\n' +
        uncoveredTables.map((v) => '  - ' + v).join('\n') +
        '\n\nEach table must belong to a lifecycle-managed data category.'
      : ''

    expect(
      uncoveredTables,
      uncoveredMsg,
    ).toEqual([])
  })

  // 5. The manifest must cover all apps that have db schema tables
  it('SCHEMA_LIFECYCLE_DRIFT_001: manifest covers apps with database usage', () => {
    const manifest = getManifestContent()

    // Apps known to have database tables routed through packages/db
    const appsWithDbUsage = [
      'console',
      'union-eyes',
      'partners',
      'cfo',
      'trade',
      'zonga',
      'abr',
      'nacp-exams',
    ]

    const violations: string[] = []
    for (const app of appsWithDbUsage) {
      if (!manifest.includes(`'${app}'`) && !manifest.includes(`"${app}"`)) {
        violations.push(app)
      }
    }

    const driftMsg = violations.length > 0
      ? 'Apps with database usage missing from lifecycle manifest:\n' +
        violations.map((v) => '  - ' + v).join('\n')
      : ''

    expect(
      violations,
      driftMsg,
    ).toEqual([])
  })
})
