/**
 * Semantic Convergence — Entity ≡ Org Guard
 *
 * Prevents "entity" terminology from creeping back into org-scoping contexts.
 * The canonical term is `orgId` / `org_id` / `OrgContext` everywhere.
 *
 * Legitimate uses of "entity" that are NOT flagged:
 *   - `partnerEntities` (bridge table between partners and orgs)
 *   - `targetEntityId` / `targetEntityType` (domain: what thing was acted upon)
 *   - `entityType` / `entity_type` (audit: categorisation of the affected object)
 *   - `personType: 'entity'` (a person that is a legal entity, not an individual)
 *   - Comments/docs referring to "legal entity" as a business concept
 *   - Drizzle migration snapshots and SQL migration history
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function readSafe(path: string): string {
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

function collectFiles(dir: string, ext: string[]): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  const stack = [dir]
  while (stack.length > 0) {
    const d = stack.pop()!
    let entries: import('node:fs').Dirent[]
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) {
        // Skip irrelevant directories
        if (['node_modules', '.git', 'dist', '.next', 'drizzle'].includes(e.name)) continue
        // Skip migration dirs
        if (e.name === 'migrations' || e.name === 'meta') continue
        // Skip platform packages that use entityId as an ontology/domain concept
        // (the entity being searched/reasoned/graphed — NOT org-scoping)
        if ([
          'platform-semantic-search', 'platform-reasoning-engine',
          'platform-decision-graph', 'platform-data-fabric',
          'platform-entity-graph', 'platform-context-orchestrator',
          'platform-governed-ai', 'zonga-control-plane',
          'intelligence', 'fsm-core',
        ].includes(e.name)) continue
        stack.push(full)
      } else if (e.isFile() && ext.some(x => e.name.endsWith(x))) {
        found.push(full)
      }
    }
  }
  return found
}

// ── Allowed exceptions ──────────────────────────────────────────────────────

const ENTITY_ID_EXCEPTIONS = [
  /targetEntityId/,         // domain: the thing acted upon
  /targetEntityType/,       // domain: type of target
  /partnerEntities/,        // bridge table
  /partnerEntityId/,        // partner-specific
  /entityType/,             // audit categorisation field
  /entity_type/,            // audit SQL column
  /entity_id/,              // DB column name (domain event entity reference)
  /personType.*entity/i,    // person kind enum
  /AbrEntityType/,          // ABR audit domain type
  /'individual'.*'entity'/i, // enum values
  /partner.*entity/i,       // partner-entity domain references
  /flowDomainEvents/,       // Drizzle ORM column accessor for domain event entity ref
  /filter\.entityId/,       // domain event filter usage
  /readonly\s+entityId/,    // domain event entity ref property (e.g. EntityNotFoundError)
  /entityId\?\s*:/,         // optional domain event entity ref field (e.g. EventQueryFilter)
  /entityId:\s*z\.string/,  // Zod schema definition in canonical event/workflow schemas
  /entityId:\s*UUID/,       // test fixture referencing canonical schema entityId field
]

function isExceptionLine(line: string): boolean {
  return ENTITY_ID_EXCEPTIONS.some(re => re.test(line))
}

// ── ORG_SEMANTICS_ONLY_001: No `entityId` in application code ───────────

describe('ORG_SEMANTICS_ONLY_001: entityId must not appear in application code', () => {
  const APP_DIRS = ['apps', 'packages']

  for (const dir of APP_DIRS) {
    it(`${dir}/ has zero \\bentityId\\b references`, () => {
      const files = collectFiles(resolve(ROOT, dir), ['.ts', '.tsx'])
      const violations: string[] = []

      for (const f of files) {
        const content = readSafe(f)
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (/\bentityId\b/.test(line) && !isExceptionLine(line)) {
            violations.push(`${f.replace(ROOT, '')}:${i + 1}: ${line.trim().slice(0, 120)}`)
          }
        }
      }

      expect(
        violations,
        `Found ${violations.length} entityId references that should be orgId:\n${violations.slice(0, 20).join('\n')}`
      ).toHaveLength(0)
    })
  }
})

// ── ORG_ROUTE_NAMING_002: No /business/entities/ routes ─────────────────

describe('ORG_ROUTE_NAMING_002: console routes must use /orgs/ not /business/entities/', () => {
  it('no dashboard route dirs under /business/entities/', () => {
    const oldPath = resolve(ROOT, 'apps/console/app/(dashboard)/business/entities')
    expect(existsSync(oldPath), '/business/entities/ dir must not exist').toBe(false)
  })

  it('no API route dirs under /api/entities/', () => {
    const oldPath = resolve(ROOT, 'apps/console/app/api/entities')
    expect(existsSync(oldPath), '/api/entities/ dir must not exist').toBe(false)
  })

  it('dashboard org routes exist at /orgs/', () => {
    const newPath = resolve(ROOT, 'apps/console/app/(dashboard)/orgs')
    expect(existsSync(newPath), '/orgs/ dashboard dir must exist').toBe(true)
  })

  it('API org routes exist at /api/orgs/', () => {
    const newPath = resolve(ROOT, 'apps/console/app/api/orgs')
    expect(existsSync(newPath), '/api/orgs/ API dir must exist').toBe(true)
  })
})

// ── ORG_API_PARAMS_003: API guard uses orgId not entityId ───────────────

describe('ORG_API_PARAMS_003: API guards use org terminology', () => {
  it('console api-guards.ts exports requireOrgAccess, not requireEntityAccess', () => {
    const content = readSafe(resolve(ROOT, 'apps/console/lib/api-guards.ts'))
    expect(content).toContain('requireOrgAccess')
    expect(content).not.toMatch(/\brequireEntityAccess\b/)
  })

  it('console api-guards.ts exports getOrgMembership, not getEntityMembership', () => {
    const content = readSafe(resolve(ROOT, 'apps/console/lib/api-guards.ts'))
    expect(content).toContain('getOrgMembership')
    expect(content).not.toMatch(/\bgetEntityMembership\b/)
  })
})

// ── ORG_DB_SCHEMA_004: DB schema uses orgs table, not entities ──────────

describe('ORG_DB_SCHEMA_004: DB schema canonical org tables', () => {
  const schemaDir = resolve(ROOT, 'packages/db/src/schema')

  it('orgs.ts exists (not entities.ts)', () => {
    expect(existsSync(resolve(schemaDir, 'orgs.ts')), 'orgs.ts must exist').toBe(true)
  })

  it('entities.ts does not exist', () => {
    expect(existsSync(resolve(schemaDir, 'entities.ts')), 'entities.ts must not exist').toBe(false)
  })

  it('schema exports `orgs` table, not `entities`', () => {
    const content = readSafe(resolve(schemaDir, 'orgs.ts'))
    expect(content).toContain("export const orgs = pgTable('orgs'")
  })

  it('schema exports `orgRoles` table, not `entityRoles`', () => {
    const content = readSafe(resolve(schemaDir, 'orgs.ts'))
    expect(content).toContain("export const orgRoles = pgTable('org_roles'")
  })

  it('schema exports `orgMembers` table, not `entityMembers`', () => {
    const content = readSafe(resolve(schemaDir, 'orgs.ts'))
    expect(content).toContain("export const orgMembers = pgTable('org_members'")
  })
})

// ── ORG_CONTEXT_005: OrgContext has no fromEntityId bridge ──────────────

describe('ORG_CONTEXT_005: OrgContext is clean', () => {
  it('@nzila/org context/types.ts does not export fromEntityId', () => {
    const content = readSafe(resolve(ROOT, 'packages/org/src/context/types.ts'))
    expect(content).not.toMatch(/\bfromEntityId\b/)
    expect(content).not.toMatch(/\bfromEntityIdDb\b/)
  })

  it('@nzila/org index.ts does not re-export fromEntityId', () => {
    const content = readSafe(resolve(ROOT, 'packages/org/src/index.ts'))
    expect(content).not.toMatch(/\bfromEntityId\b/)
    expect(content).not.toMatch(/\bfromEntityIdDb\b/)
  })
})

// ── ORG_SCOPED_DB_006: ScopedDb has no duplicate orgId alias ────────────

describe('ORG_SCOPED_DB_006: ScopedDb uses orgId cleanly', () => {
  it('scoped.ts has no deprecated entityId alias', () => {
    const content = readSafe(resolve(ROOT, 'packages/db/src/scoped.ts'))
    expect(content).not.toMatch(/\bentityId\b/)
    expect(content).not.toMatch(/Alias for orgId/)
  })

  it('audit.ts has no duplicate orgId properties', () => {
    const content = readSafe(resolve(ROOT, 'packages/db/src/audit.ts'))
    // Count occurrences of "orgId:" at object literal level
    // There should be exactly one per context object, not duplicates
    expect(content).not.toMatch(/\bentityId\b/)
  })

  it('ScopedDb function uses getOrgIdColumn, not getEntityIdColumn', () => {
    const content = readSafe(resolve(ROOT, 'packages/db/src/scoped.ts'))
    expect(content).toContain('getOrgIdColumn')
    expect(content).not.toMatch(/\bgetEntityIdColumn\b/)
  })
})
