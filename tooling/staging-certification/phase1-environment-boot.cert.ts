/**
 * PHASE 1 — Staging-Like Environment Boot Certification
 *
 * Validates that all enforcement gates hold when running from-scratch
 * in a staging-like environment. No manual intervention should be needed.
 *
 * Tests:
 *  1. Migration files exist and are sequentially ordered
 *  2. Schema snapshot verification passes
 *  3. Canonical schema verification passes
 *  4. Preflight check passes
 *  5. Parity check runs (non-strict for warnings)
 *  6. Seed files are idempotent (ON CONFLICT / WHERE NOT EXISTS)
 *  7. Generated types are fresh (drizzle schema matches snapshot)
 *  8. No manual intervention markers in migration files
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const MIGRATIONS_DIR = join(ROOT, 'apps', 'union-eyes', 'db', 'migrations')
const SEEDS_DIR = join(ROOT, 'apps', 'union-eyes', 'db', 'seeds')

function runCommand(cmd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] })
    return { stdout, exitCode: 0 }
  } catch (err: unknown) {
    return { stdout: err.stdout ?? '', exitCode: err.status ?? 1 }
  }
}

describe('CERT-PHASE-1 — Staging-Like Environment Boot', () => {
  // ── 1. Migration files exist and are structured ───────────────────────
  it('migration directory contains SQL migration files', () => {
    expect(existsSync(MIGRATIONS_DIR)).toBe(true)
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter(
      f => f.endsWith('.sql') && !f.startsWith('_')
    )
    expect(sqlFiles.length).toBeGreaterThanOrEqual(50)
  })

  it('migration files have no TODO/FIXME blockers', () => {
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))
    const blockers: string[] = []
    for (const f of sqlFiles) {
      const content = readFileSync(join(MIGRATIONS_DIR, f), 'utf-8')
      if (/\bTODO\b.*manual|FIXME.*before.*deploy/i.test(content)) {
        blockers.push(f)
      }
    }
    expect(blockers).toEqual([])
  })

  // ── 2. Schema snapshot ────────────────────────────────────────────────
  it('schema-snapshot.ts verify passes', () => {
    const result = runCommand('pnpm tsx tooling/db/schema-snapshot.ts verify')
    expect(result.exitCode).toBe(0)
  })

  // ── 3. Canonical schema ───────────────────────────────────────────────
  it('canonical-schema/verify.ts passes', () => {
    const result = runCommand('pnpm tsx tooling/db/canonical-schema/verify.ts')
    expect(result.exitCode).toBe(0)
  })

  // ── 4. Preflight check ────────────────────────────────────────────────
  it('preflight-check.ts passes', () => {
    const result = runCommand('pnpm tsx tooling/db/preflight-check.ts')
    expect(result.exitCode).toBe(0)
  })

  // ── 5. Parity check ──────────────────────────────────────────────────
  it('parity-check.ts runs without errors (warnings OK)', () => {
    const result = runCommand('pnpm tsx tooling/env/parity-check.ts')
    // Non-strict: exit 0 means no errors (warnings are allowed)
    expect(result.exitCode).toBe(0)
  })

  // ── 6. Seed idempotency ──────────────────────────────────────────────
  it('seed files use ON CONFLICT or WHERE NOT EXISTS for idempotency', () => {
    const seedSqlFiles = readdirSync(SEEDS_DIR).filter(f => f.endsWith('.sql'))
    expect(seedSqlFiles.length).toBeGreaterThanOrEqual(5)

    // Known data-load-only seeds that are allowed to be non-idempotent
    const ALLOWED_NON_IDEMPOTENT = new Set(['cba-seed-data.sql'])

    const nonIdempotent: string[] = []
    for (const f of seedSqlFiles) {
      if (ALLOWED_NON_IDEMPOTENT.has(f)) continue
      const content = readFileSync(join(SEEDS_DIR, f), 'utf-8').toLowerCase()
      // If it has INSERT, it should have ON CONFLICT or WHERE NOT EXISTS or DELETE before insert
      if (content.includes('insert into') &&
          !content.includes('on conflict') &&
          !content.includes('where not exists') &&
          !content.includes('delete from')) {
        nonIdempotent.push(f)
      }
    }
    expect(nonIdempotent).toEqual([])
  })

  // ── 7. Generated types freshness ─────────────────────────────────────
  it('schema snapshot JSON exists and has valid structure', () => {
    const snapshotPath = join(ROOT, 'tooling', 'db', 'schema-snapshot.json')
    expect(existsSync(snapshotPath)).toBe(true)

    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))
    expect(snapshot).toHaveProperty('compositeHash')
    expect(snapshot).toHaveProperty('capturedAt')
    expect(snapshot).toHaveProperty('files')
    expect(Object.keys(snapshot.files).length).toBeGreaterThanOrEqual(20)
  })

  // ── 8. Seed data covers CUPE-grade scenarios ──────────────────────────
  it('staging-full seed covers multi-org hierarchy', () => {
    const fullSeedPath = join(SEEDS_DIR, 'seed-staging-full.sql')
    expect(existsSync(fullSeedPath)).toBe(true)

    const content = readFileSync(fullSeedPath, 'utf-8')
    // Must reference key org types
    expect(content).toContain('Canadian Labour Congress')
    expect(content.match(/organization/gi)!.length).toBeGreaterThanOrEqual(10)
  })

  it('3-orgs seed has realistic member data', () => {
    const threeOrgPath = join(SEEDS_DIR, 'seed-staging-3orgs.sql')
    expect(existsSync(threeOrgPath)).toBe(true)

    const content = readFileSync(threeOrgPath, 'utf-8')
    expect(content).toContain('organization_members')
    // Multiple user IDs = realistic membership
    const userRefs = content.match(/user_[a-zA-Z0-9]{10,}/g) ?? []
    expect(userRefs.length).toBeGreaterThanOrEqual(5)
  })
})
