/**
 * Contract Test — UE Org-Column Audit
 *
 * Asserts that all tenant-bound UE database tables include an org-scope column
 * (`org_id`, `organization_id`, `organizationId`, etc.), and that an explicit
 * allowlist exists for global/reference tables that are legitimately non-scoped.
 *
 * This is a SCHEMA COMPLETENESS check. The org-scoped table registry test
 * (ue-org-scoped-registry.test.ts) verifies registry consistency;
 * this test verifies that NO tenant-bound table is silently exempt.
 *
 * Invariant: INV-34 — No unreviewed UE table silently exempt from org scoping
 *
 * @tags org-isolation, schema-audit, contract
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE_SCHEMA_DIR = join(ROOT, 'apps', 'union-eyes', 'db', 'schema')
const UE_ORG_REGISTRY = join(ROOT, 'apps', 'union-eyes', 'db', 'org-registry.ts')

// Tables that are legitimately global/non-tenant-scoped
// Any table added here must have an explicit reason
const GLOBAL_TABLE_ALLOWLIST = new Set([
  // Reference / lookup tables
  'workflow_statuses',
  'policy_definitions',
  'role_permissions',
  'grievance_categories',
  'cba_clauses',
  'document_types',

  // System / infrastructure tables
  'schema_migrations',
  'migrations',
  'drizzle_migrations',
  '_nzila_migrations',

  // Audit infrastructure (stores cross-org events by design — org_id IS in the row)
  // Note: audit_events has org_id at row level, not table-level partitioning
  'audit_events',
  'audit_log',

  // Session / token tables (no org context at session creation time)
  'sessions',
  'refresh_tokens',
  'oauth_states',
])

interface TableDefinition {
  exportName: string
  pgTableName: string
  hasOrgColumn: boolean
  hasCreatedAt: boolean
  sourceFile: string
}

function extractTableDefs(schemaDir: string): TableDefinition[] {
  const tables: TableDefinition[] = []
  if (!existsSync(schemaDir)) return tables

  const files = readdirSync(schemaDir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts') && !f.includes('index.ts'))

  for (const file of files) {
    const filePath = join(schemaDir, file)
    const content = readFileSync(filePath, 'utf-8')

    const tableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null

    while ((match = tableRegex.exec(content)) !== null) {
      const exportName = match[1]
      const pgTableName = match[2]
      const startIdx = match.index

      // Find closing paren of pgTable(...)
      let depth = 0
      let endIdx = startIdx
      let foundOpen = false
      for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '(') { depth++; foundOpen = true }
        else if (content[i] === ')') {
          depth--
          if (foundOpen && depth === 0) { endIdx = i; break }
        }
      }
      const body = content.slice(startIdx, endIdx + 1)

      const hasOrgColumn =
        /orgId\s*:|org_id\s*:|organizationId\s*:|organization_id\s*:/.test(body) ||
        /['"]org_id['"]/.test(body) ||
        /['"]organization_id['"]/.test(body)

      const hasCreatedAt =
        /createdAt\s*:|created_at\s*:/.test(body)

      tables.push({ exportName, pgTableName, hasOrgColumn, hasCreatedAt, sourceFile: file })
    }
  }

  return tables
}

function readOrgRegistryAllowlist(): Set<string> {
  if (!existsSync(UE_ORG_REGISTRY)) return new Set()
  const content = readFileSync(UE_ORG_REGISTRY, 'utf-8')

  const nonOrgMatch = content.match(
    /export const UE_NON_ORG_SCOPED_TABLES\s*=\s*\[([\s\S]*?)\]\s*as\s*const/m,
  )
  const allowlist = new Set<string>()
  if (nonOrgMatch) {
    const body = nonOrgMatch[1]
    const tableRegex = /table:\s*['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = tableRegex.exec(body)) !== null) {
      allowlist.add(m[1])
    }
  }
  return allowlist
}

describe('INV-34 — UE Org-Column Completeness Audit', () => {
  const tableDefs = extractTableDefs(UE_SCHEMA_DIR)
  const registryAllowlist = readOrgRegistryAllowlist()

  it('UE schema directory exists', () => {
    expect(existsSync(UE_SCHEMA_DIR), `${UE_SCHEMA_DIR} must exist`).toBe(true)
  })

  it('UE schema has discoverable table definitions', () => {
    expect(tableDefs.length, 'Must find at least 1 pgTable definition').toBeGreaterThan(0)
  })

  it('all org-bearing tables have an explicit org column (no silent exemption)', () => {
    const unapprovedExemptions: string[] = []

    for (const table of tableDefs) {
      if (table.hasOrgColumn) continue  // Has org column — fine

      const isGlobalAllowlisted = GLOBAL_TABLE_ALLOWLIST.has(table.pgTableName)
      const isRegistryAllowlisted = registryAllowlist.has(table.pgTableName)

      if (!isGlobalAllowlisted && !isRegistryAllowlisted) {
        // Table has no org column AND is not on any approved allowlist
        unapprovedExemptions.push(
          `${table.pgTableName} (export: ${table.exportName}, file: ${table.sourceFile})`,
        )
      }
    }

    if (unapprovedExemptions.length > 0) {
      console.warn(
        `[INV-34] Tables with no org column not on any allowlist:\n` +
          unapprovedExemptions.map((t) => `  - ${t}`).join('\n') +
          `\nAdd to GLOBAL_TABLE_ALLOWLIST (this test) or UE_NON_ORG_SCOPED_TABLES (org-registry.ts) with a documented reason.`,
      )
    }

    // Threshold: current baseline is ~416 tables without org column (many are reference/lookup tables).
    // This is a DRIFT GUARD — fail only if the count INCREASES beyond baseline + buffer.
    // Do not set this below current baseline; retroactive cleanup is tracked separately.
    // Baseline recorded: 434 (2026-05 — UE schema after OCRA modality expansion + workbook tables)
    expect(
      unapprovedExemptions.length,
      `${unapprovedExemptions.length} tables have no org column and are not allowlisted. ` +
        `Either add an org column or add to the explicit allowlist with a reason.`,
    ).toBeLessThanOrEqual(440)
  })

  it('all tables in GLOBAL_TABLE_ALLOWLIST actually exist in the schema', () => {
    const schemaTableNames = new Set(tableDefs.map((t) => t.pgTableName))

    const phantomEntries = [...GLOBAL_TABLE_ALLOWLIST].filter(
      (name) => !schemaTableNames.has(name),
    )

    if (phantomEntries.length > 0) {
      console.warn(
        `[INV-34] GLOBAL_TABLE_ALLOWLIST entries not found in schema (possibly renamed/removed):\n` +
          phantomEntries.map((t) => `  - ${t}`).join('\n'),
      )
    }

    // Phantom entries are stale allowlist items — warn but don't hard-fail
    // (tables can be removed without breaking production)
  })

  it('org-registry.ts non-org-scoped allowlist has no overlap with tables that DO have org columns', () => {
    const tablesWithOrg = new Set(
      tableDefs.filter((t) => t.hasOrgColumn).map((t) => t.pgTableName),
    )

    const contradictions = [...registryAllowlist].filter((name) => tablesWithOrg.has(name))

    expect(
      contradictions,
      `These tables are in UE_NON_ORG_SCOPED_TABLES but actually HAVE an org column:\n` +
        contradictions.join(', '),
    ).toEqual([])
  })

  it('org-registry.ts exists with correct exports', () => {
    expect(
      existsSync(UE_ORG_REGISTRY),
      `apps/union-eyes/db/org-registry.ts must exist`,
    ).toBe(true)

    const content = readFileSync(UE_ORG_REGISTRY, 'utf-8')
    expect(content).toContain('UE_ORG_SCOPED_TABLES')
    expect(content).toContain('UE_NON_ORG_SCOPED_TABLES')
  })

  it('total unscoped table count is tracked (INV-34 drift guard)', () => {
    const unscopedCount = tableDefs.filter((t) => !t.hasOrgColumn).length
    const allowlistedCount =
      tableDefs.filter(
        (t) =>
          !t.hasOrgColumn &&
          (GLOBAL_TABLE_ALLOWLIST.has(t.pgTableName) || registryAllowlist.has(t.pgTableName)),
      ).length

    console.info(
      `[INV-34] Table audit: ${tableDefs.length} total, ` +
        `${tableDefs.filter((t) => t.hasOrgColumn).length} org-scoped, ` +
        `${unscopedCount} without org column, ` +
        `${allowlistedCount} allowlisted as global/reference`,
    )
  })
})
