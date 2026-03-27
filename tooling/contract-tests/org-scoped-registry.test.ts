/**
 * Contract Test — Org-Scoped Table Registry Consistency
 *
 * Ensures the Org-scoped table registry in @nzila/db/org-registry
 * is bidirectionally consistent with the actual schema:
 *
 *   1. Every table with an `org_id` column MUST be in the registry.
 *   2. Every table in the registry MUST actually have an `org_id` column.
 *   3. Every table MUST be accounted for (either in ORG_SCOPED or NON_ORG_SCOPED).
 *
 * @invariant INV-20: Org-scoped table registry consistency
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const SCHEMA_DIR = join(ROOT, 'packages', 'db', 'src', 'schema')

// ── Load registry ──────────────────────────────────────────────────────────

// We read the registry source to extract table names rather than importing,
// so this test works at the contract-test level without needing to resolve TS.

function loadRegistryTableNames(registryPath: string, arrayName: string): string[] {
  const content = readFileSync(registryPath, 'utf-8')
  // Extract the array contents between the arrayName declaration and the closing `] as const`
  const regex = new RegExp(`export const ${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*const`, 'm')
  const match = content.match(regex)
  if (!match) return []
  const body = match[1]
  // Extract quoted strings (single or double)
  const strings: string[] = []
  const strRegex = /['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = strRegex.exec(body)) !== null) {
    strings.push(m[1])
  }
  return strings
}

function loadNonOrgTableNames(registryPath: string): string[] {
  const content = readFileSync(registryPath, 'utf-8')
  const regex = /export const NON_ORG_SCOPED_TABLES\s*=\s*\[([\s\S]*?)\]\s*as\s*const/m
  const match = content.match(regex)
  if (!match) return []
  const body = match[1]
  // Extract table: 'name' entries
  const results: string[] = []
  const entryRegex = /table:\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = entryRegex.exec(body)) !== null) {
    results.push(m[1])
  }
  return results
}

// ── Schema introspection ──────────────────────────────────────────────────

interface TableInfo {
  exportName: string
  hasEntityId: boolean
  sourceFile: string
}

/**
 * Scan all schema files and extract table export names + whether they have org_id.
 */
function introspectSchemaFiles(): TableInfo[] {
  const tables: TableInfo[] = []
  if (!existsSync(SCHEMA_DIR)) return tables

  const schemaFiles = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')

  for (const file of schemaFiles) {
    const filePath = join(SCHEMA_DIR, file)
    const content = readFileSync(filePath, 'utf-8')

    // Find all pgTable exports: export const <name> = pgTable(...)
    const tableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(/g
    let match: RegExpExecArray | null

    while ((match = tableRegex.exec(content)) !== null) {
      const exportName = match[1]
      const startIdx = match.index

      // Find the closing of this pgTable definition by counting braces
      let braceDepth = 0
      let foundOpen = false
      let endIdx = startIdx

      for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '(') {
          braceDepth++
          foundOpen = true
        } else if (content[i] === ')') {
          braceDepth--
          if (foundOpen && braceDepth === 0) {
            endIdx = i
            break
          }
        }
      }

      const tableBody = content.slice(startIdx, endIdx + 1)

      // Check if org_id or entity_id column exists in this table definition
      // Look for: orgId: uuid('org_id') or orgId: uuid('entity_id') pattern
      const hasEntityId =
        /orgId:\s*uuid\s*\(\s*['"](?:org_id|entity_id)['"]\s*\)/.test(tableBody) ||
        /['"](?:org_id|entity_id)['"]\s*\)/.test(tableBody)

      tables.push({ exportName, hasEntityId, sourceFile: file })
    }
  }

  return tables
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('INV-20 — Org-Scoped Table Registry Consistency', () => {
  const REGISTRY_PATH = join(ROOT, 'packages', 'db', 'src', 'org-registry.ts')

  it('org-registry.ts exists', () => {
    expect(existsSync(REGISTRY_PATH), 'org-registry.ts must exist').toBe(true)
  })

  const orgScopedNames = loadRegistryTableNames(REGISTRY_PATH, 'ORG_SCOPED_TABLES')
  const nonOrgScopedNames = loadNonOrgTableNames(REGISTRY_PATH)
  const schemaTables = introspectSchemaFiles()

  it('registry is not empty', () => {
    expect(orgScopedNames.length).toBeGreaterThan(0)
    expect(nonOrgScopedNames.length).toBeGreaterThan(0)
  })

  it('every table with org_id is in the ORG_SCOPED registry', () => {
    const registrySet = new Set(orgScopedNames)
    const nonOrgSet = new Set(nonOrgScopedNames)
    const missing: string[] = []

    for (const table of schemaTables) {
      if (table.hasEntityId && !registrySet.has(table.exportName) && !nonOrgSet.has(table.exportName)) {
        missing.push(`${table.exportName} (in ${table.sourceFile})`)
      }
    }

    expect(
      missing,
      `Tables with org_id column not in ORG_SCOPED_TABLES registry:\n${missing.join('\n')}`,
    ).toEqual([])
  })

  it('every table in ORG_SCOPED registry actually has org_id', () => {
    const schemaMap = new Map(schemaTables.map((t) => [t.exportName, t]))
    const invalid: string[] = []

    for (const name of orgScopedNames) {
      const table = schemaMap.get(name)
      if (!table) {
        invalid.push(`${name} — not found in any schema file`)
      } else if (!table.hasEntityId) {
        invalid.push(`${name} (in ${table.sourceFile}) — missing org_id column`)
      }
    }

    expect(
      invalid,
      `Tables in ORG_SCOPED_TABLES but lacking org_id:\n${invalid.join('\n')}`,
    ).toEqual([])
  })

  it('every schema table is accounted for (either Org-scoped or explicitly excluded)', () => {
    const orgSet = new Set(orgScopedNames)
    const nonOrgSet = new Set(nonOrgScopedNames)
    const unaccounted: string[] = []

    for (const table of schemaTables) {
      if (!orgSet.has(table.exportName) && !nonOrgSet.has(table.exportName)) {
        unaccounted.push(`${table.exportName} (in ${table.sourceFile})`)
      }
    }

    expect(
      unaccounted,
      `Tables not accounted for in either ORG_SCOPED_TABLES or NON_ORG_SCOPED_TABLES:\n${unaccounted.join('\n')}\n` +
        'Add them to the appropriate list in packages/db/src/org-registry.ts.',
    ).toEqual([])
  })

  it('no duplicates in ORG_SCOPED_TABLES', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const name of orgScopedNames) {
      if (seen.has(name)) dupes.push(name)
      seen.add(name)
    }
    expect(dupes, `Duplicate entries in ORG_SCOPED_TABLES: ${dupes.join(', ')}`).toEqual([])
  })

  it('no overlap between ORG_SCOPED and NON_ORG_SCOPED', () => {
    const orgSet = new Set(orgScopedNames)
    const overlap = nonOrgScopedNames.filter((n) => orgSet.has(n))
    expect(
      overlap,
      `Tables appear in both ORG and NON_ORG lists: ${overlap.join(', ')}`,
    ).toEqual([])
  })

  it('registry documentation exists', () => {
    const docPath = join(ROOT, 'docs', 'architecture', 'ORG_SCOPED_TABLES.md')
    expect(existsSync(docPath), 'docs/architecture/ORG_SCOPED_TABLES.md must exist').toBe(true)
  })
})
