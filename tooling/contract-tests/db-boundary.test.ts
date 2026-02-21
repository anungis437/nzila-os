/**
 * Contract Test — DB Boundary Enforcement
 *
 * Structural invariant: Application code (apps/*) must never
 * directly access the raw database client. All queries must flow
 * through createScopedDb(entityId) for Org isolation.
 *
 * Enforcement layers validated:
 *   1. No rawDb imports in apps/*
 *   2. No direct drizzle() instantiation in apps/*
 *   3. No direct import of @nzila/db/raw in apps/*
 *   4. entityId filtering present in query patterns (scoped DAL)
 *   5. ESLint no-shadow-db rule wired into every app
 *
 * @invariant INV-06: No raw DB access in application layer
 * @invariant INV-07: Org isolation via Scoped DAL
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkSync(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.mjs']): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.turbo' || entry.name === 'dist') continue
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function getAppDirs(): string[] {
  if (!existsSync(APPS_DIR)) return []
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(APPS_DIR, d.name))
}

// Exemptions: services that have their own DB client for structural reasons.
// These are documented and scheduled for migration to scopedDb.
const EXEMPT_PATHS = [
  // Orchestrator API is a standalone non-Next.js service with its own DB client.
  // Migration planned — see docs/migration/ENFORCEMENT_UPGRADE.md
  'apps/orchestrator-api/',
  // Console app has legacy unscoped db imports across ~30 routes.
  // Migration to createScopedDb(entityId) tracked in docs/migration/ENFORCEMENT_UPGRADE.md
  'apps/console/',
  // Partners app has legacy unscoped db import in partner-auth.
  // Migration to createScopedDb(entityId) tracked in docs/migration/ENFORCEMENT_UPGRADE.md
  'apps/partners/',
]

function isExempt(filePath: string): boolean {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/')
  return EXEMPT_PATHS.some((p) => rel.startsWith(p))
}

// ── INV-06: No raw DB imports in apps/* ─────────────────────────────────────

describe('INV-06 — No raw DB access in application layer', () => {
  const appFiles = getAppDirs().flatMap((dir) => walkSync(dir))

  it('no app file imports @nzila/db/raw', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf-8')
      if (
        content.includes('@nzila/db/raw') ||
        content.includes("from '@nzila/db/raw'") ||
        content.includes('from "@nzila/db/raw"')
      ) {
        violations.push(relative(ROOT, file))
      }
    }
    expect(
      violations,
      `Raw DB access forbidden in app code. Violations:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('no app file imports rawDb from @nzila/db', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf-8')
      // Match: import { rawDb } from '@nzila/db' or destructuring
      if (/\brawDb\b/.test(content) && /@nzila\/db/.test(content)) {
        violations.push(relative(ROOT, file))
      }
    }
    expect(
      violations,
      `rawDb import forbidden in app code. Use createScopedDb(entityId).\nViolations:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('no app file directly instantiates drizzle()', () => {
    const violations: string[] = []
    const drizzleImportPattern = /import\s+.*\bdrizzle\b.*from\s+['"]drizzle-orm\/(postgres-js|node-postgres|neon-http)['"]/
    for (const file of appFiles) {
      if (isExempt(file)) continue
      const content = readFileSync(file, 'utf-8')
      if (drizzleImportPattern.test(content)) {
        violations.push(relative(ROOT, file))
      }
    }
    expect(
      violations,
      `Direct drizzle() instantiation forbidden in app code.\nViolations:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('no app file imports raw database drivers (postgres, pg)', () => {
    const violations: string[] = []
    const driverPattern = /import\s+.*from\s+['"](postgres|pg|@neondatabase\/serverless)['"]/
    for (const file of appFiles) {
      if (isExempt(file)) continue
      const content = readFileSync(file, 'utf-8')
      if (driverPattern.test(content)) {
        violations.push(relative(ROOT, file))
      }
    }
    expect(
      violations,
      `Direct database driver imports forbidden in app code.\nViolations:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('no app file imports unscoped db from @nzila/db barrel', () => {
    const violations: string[] = []
    // Catches: import { db } from '@nzila/db' and import { db, ... } from '@nzila/db'
    const unscopedDbPattern = /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]@nzila\/db['"]/
    for (const file of appFiles) {
      if (isExempt(file)) continue
      const content = readFileSync(file, 'utf-8')
      if (unscopedDbPattern.test(content)) {
        violations.push(relative(ROOT, file))
      }
    }
    expect(
      violations,
      `Unscoped db import from @nzila/db barrel is forbidden in app code. ` +
        `Use createScopedDb(entityId) from @nzila/db/scoped.\nViolations:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('no app file imports from @nzila/db/client directly', () => {
    const violations: string[] = []
    for (const file of appFiles) {
      if (isExempt(file)) continue
      const content = readFileSync(file, 'utf-8')
      if (
        content.includes("from '@nzila/db/client'") ||
        content.includes('from "@nzila/db/client"')
      ) {
        violations.push(relative(ROOT, file))
      }
    }
    expect(
      violations,
      `Direct @nzila/db/client import forbidden in app code.\nViolations:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── INV-07: Org isolation via Scoped DAL ─────────────────────────────────────

describe('INV-07 — Org isolation enforced via Scoped DAL', () => {
  it('createScopedDb exists and is exported from @nzila/db/scoped', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    expect(existsSync(scopedPath), '@nzila/db/scoped module must exist').toBe(true)

    const content = readFileSync(scopedPath, 'utf-8')
    expect(content).toContain('export function createScopedDb')
    expect(content).toContain('orgId')
  })

  it('createScopedDb throws on missing orgId', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')
    // Must validate orgId and throw
    expect(content).toMatch(/throw\s+new\s+ScopedDbError/)
    expect(content).toContain('requires a non-empty orgId')
  })

  it('createScopedDb validates entity_id column on tables', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')
    expect(content).toContain('getEntityIdColumn')
    expect(content).toContain('does not have an entity_id column')
  })

  it('rawDb is exported from @nzila/db/raw with internal-only JSDoc', () => {
    const rawPath = join(ROOT, 'packages', 'db', 'src', 'raw.ts')
    expect(existsSync(rawPath), '@nzila/db/raw module must exist').toBe(true)

    const content = readFileSync(rawPath, 'utf-8')
    expect(content).toContain('INTERNAL ONLY')
    expect(content).toContain('Do not import outside')
    expect(content).toContain('export const rawDb')
  })

  it('ScopedDb auto-injects orgId on insert operations', () => {
    const scopedPath = join(ROOT, 'packages', 'db', 'src', 'scoped.ts')
    const content = readFileSync(scopedPath, 'utf-8')
    // The insert method must spread orgId into inserted values
    expect(content).toMatch(/entityId:\s*orgId/)
  })

  it('createAuditedScopedDb exists for write-enabled audited access', () => {
    const auditPath = join(ROOT, 'packages', 'db', 'src', 'audit.ts')
    expect(existsSync(auditPath), '@nzila/db/audit module must exist').toBe(true)
    const content = readFileSync(auditPath, 'utf-8')
    expect(content).toContain('export function createAuditedScopedDb')
    expect(content).toContain('orgId')
    expect(content).toContain('actorId')
  })

  it('Org-scoped table registry is exported from @nzila/db', () => {
    const regPath = join(ROOT, 'packages', 'db', 'src', 'org-registry.ts')
    expect(existsSync(regPath), 'org-registry.ts must exist').toBe(true)
    const content = readFileSync(regPath, 'utf-8')
    expect(content).toContain('export const ORG_SCOPED_TABLES')
    expect(content).toContain('export const NON_ORG_SCOPED_TABLES')
  })

  it('@nzila/db package.json exports scoped and raw modules', () => {
    const pkgPath = join(ROOT, 'packages', 'db', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.exports['./scoped']).toBeTruthy()
    expect(pkg.exports['./raw']).toBeTruthy()
    expect(pkg.exports['./eslint-no-shadow-db']).toBeTruthy()
  })
})

// ── ESLint no-shadow-db wired into all apps ─────────────────────────────────

describe('INV-06 — ESLint no-shadow-db enforcement', () => {
  const appDirs = getAppDirs()

  it('every app with an eslint.config.mjs includes no-shadow-db', () => {
    const missing: string[] = []
    for (const appDir of appDirs) {
      const eslintConfig = join(appDir, 'eslint.config.mjs')
      if (!existsSync(eslintConfig)) continue // app without eslint config (e.g. API-only)
      const content = readFileSync(eslintConfig, 'utf-8')
      if (!content.includes('no-shadow-db') && !content.includes('noShadowDb')) {
        missing.push(relative(ROOT, appDir))
      }
    }
    expect(
      missing,
      `Apps missing no-shadow-db ESLint rule:\n${missing.join('\n')}`,
    ).toEqual([])
  })

  it('no-shadow-db ESLint config file exists', () => {
    const rulePath = join(ROOT, 'packages', 'db', 'eslint-no-shadow-db.mjs')
    expect(existsSync(rulePath), 'eslint-no-shadow-db.mjs must exist').toBe(true)

    const content = readFileSync(rulePath, 'utf-8')
    expect(content).toContain('@nzila/db/raw')
    expect(content).toContain('createScopedDb')
  })
})
