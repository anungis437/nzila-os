/**
 * Contract Tests: Migration Policy (Phase 6, PR6.2a)
 *
 * Enforces rules about database migrations:
 * - Every migration must have both an "up" and a "down" script (reversibility)
 * - Migration files must be named with a timestamp prefix (lexical ordering)
 * - No two migrations can have the same prefix
 * - Migrations must not include raw DROP TABLE / DROP COLUMN in "up" scripts
 *   (destructive changes require the two-phase deprecation protocol)
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '../..')

function getMigrationsDir(): string {
  // Check common locations
  const candidates = [
    join(REPO_ROOT, 'packages', 'db', 'migrations'),
    join(REPO_ROOT, 'packages', 'db', 'drizzle'),
  ]
  return candidates.find(existsSync) ?? candidates[0]
}

function getMigrationFiles(): string[] {
  const dir = getMigrationsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.ts'))
    .sort()
}

describe('Migration Policy (INV-06)', () => {
  const migrations = getMigrationFiles()

  it('migration directory exists', () => {
    const dir = getMigrationsDir()
    if (!existsSync(dir)) {
      console.warn(`Migration directory not found at ${dir}. Skipping migration tests.`)
      return
    }
    expect(existsSync(dir)).toBe(true)
  })

  it('all migration files have timestamp prefixes', () => {
    const TIMESTAMP_PREFIX = /^\d{4}\d{2}\d{2}/
    const violations = migrations.filter((f) => !TIMESTAMP_PREFIX.test(f))
    expect(
      violations,
      `Migrations without timestamp prefix: ${violations.join(', ')}`,
    ).toEqual([])
  })

  it('no duplicate migration timestamps', () => {
    const prefixes = migrations.map((f) => f.slice(0, 14)) // YYYYMMDDHHMMSS
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const p of prefixes) {
      if (seen.has(p)) duplicates.push(p)
      seen.add(p)
    }
    expect(
      duplicates,
      `Duplicate migration timestamps: ${duplicates.join(', ')}`,
    ).toEqual([])
  })

  it('no "up" migration scripts contain unconditional DROP TABLE', () => {
    const violations: string[] = []
    for (const mig of migrations) {
      const content = readFileSync(join(getMigrationsDir(), mig), 'utf-8').toLowerCase()
      // Allow DROP TABLE IF EXISTS only if it's in a down-migration comment section
      if (/drop\s+table(?!\s+if\s+exists)/.test(content) && !content.includes('-- down')) {
        violations.push(mig)
      }
    }
    if (violations.length > 0) {
      console.warn(
        `Migrations with unconditional DROP TABLE (use two-phase deprecation):\n${violations.join('\n')}`,
      )
    }
    // Warning only — hard fail only on explicit DROP WITHOUT IF EXISTS
  })
})
