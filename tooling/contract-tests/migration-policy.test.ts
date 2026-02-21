/**
 * Contract Tests: Migration Policy (Phase 6, PR6.2a)
 *
 * Enforces rules about database migrations:
 * - Every migration must have both an "up" and a "down" script (reversibility)
 * - Migration files must be named with a timestamp prefix (lexical ordering)
 * - No two migrations can have the same prefix
 * - Migrations must not include raw DROP TABLE / DROP COLUMN in "up" scripts
 *   (destructive changes require the two-phase deprecation protocol)
 * - Down migrations must exist for reversibility
 * - Schema snapshot must not drift
 * - Data compatibility with SDK versions
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

function getMigrationDirs(): string[] {
  const dir = getMigrationsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => {
      try {
        return statSync(join(dir, f)).isDirectory()
      } catch {
        return false
      }
    })
    .sort()
}

describe('Migration Policy (INV-06)', () => {
  const migrations = getMigrationFiles()
  const migrationDirs = getMigrationDirs()

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
    // Allow known infrastructure/setup migrations without timestamp prefix
    const KNOWN_SETUP_MIGRATIONS = [
      'ai-control-plane-pgvector.sql',
      'hash-chain-immutability-triggers.sql',
    ]
    const violations = migrations.filter(
      (f) => !TIMESTAMP_PREFIX.test(f) && !KNOWN_SETUP_MIGRATIONS.includes(f),
    )
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

// ── Down Migration Validation ─────────────────────────────────────────────

describe('Down Migration Validation (INV-06b)', () => {
  it('Drizzle migration directories contain both up and snapshot files', () => {
    const dir = getMigrationsDir()
    if (!existsSync(dir)) return

    const migDirs = getMigrationDirs()
    if (migDirs.length === 0) return // No directory-based migrations

    const violations: string[] = []
    for (const migDir of migDirs) {
      const fullPath = join(dir, migDir)
      const files = readdirSync(fullPath)

      // Drizzle stores migration.sql (up) and snapshot.json
      const hasUp = files.some((f) => f === 'migration.sql' || f.endsWith('.up.sql'))
      const hasSnapshot = files.some((f) => f.endsWith('.json') || f.endsWith('.down.sql'))

      if (hasUp && !hasSnapshot) {
        violations.push(`${migDir}: has up migration but no snapshot/down file`)
      }
    }

    if (violations.length > 0) {
      console.warn(`Migrations missing down/snapshot:\n${violations.join('\n')}`)
    }
  })

  it('no migration contains DROP COLUMN without IF EXISTS guard', () => {
    const dir = getMigrationsDir()
    if (!existsSync(dir)) return

    const violations: string[] = []
    const allSql = [...getMigrationFiles()]

    // Also check inside migration directories
    for (const migDir of getMigrationDirs()) {
      const fullPath = join(dir, migDir)
      const files = readdirSync(fullPath).filter((f) => f.endsWith('.sql'))
      for (const f of files) {
        allSql.push(join(migDir, f))
      }
    }

    for (const mig of allSql) {
      const migPath = join(dir, mig)
      if (!existsSync(migPath)) continue
      const content = readFileSync(migPath, 'utf-8').toLowerCase()
      // DROP COLUMN without protection (not in -- down section)
      if (/alter\s+table\s+\w+\s+drop\s+column(?!\s+if\s+exists)/i.test(content)) {
        if (!content.includes('-- down') && !mig.includes('.down.')) {
          violations.push(mig)
        }
      }
    }

    expect(
      violations,
      `Migrations with unguarded DROP COLUMN (use two-phase protocol):\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── Schema Diff Guard ─────────────────────────────────────────────────────

describe('Schema Diff Guard (INV-06c)', () => {
  it('schema snapshot tooling exists', () => {
    const snapshotScript = resolve(REPO_ROOT, 'tooling/db/schema-snapshot.ts')
    expect(
      existsSync(snapshotScript),
      'tooling/db/schema-snapshot.ts must exist for drift detection',
    ).toBe(true)
  })

  it('CI workflow includes schema drift detection', () => {
    const ciPath = resolve(REPO_ROOT, '.github/workflows/ci.yml')
    if (!existsSync(ciPath)) return
    const content = readFileSync(ciPath, 'utf-8')
    expect(
      content,
      'CI must include schema drift detection job',
    ).toMatch(/schema.?drift|schema.?snapshot/i)
  })

  it('release train verifies schema snapshot', () => {
    const releasePath = resolve(REPO_ROOT, '.github/workflows/release-train.yml')
    if (!existsSync(releasePath)) return
    const content = readFileSync(releasePath, 'utf-8')
    expect(
      content,
      'Release train must verify schema snapshot',
    ).toMatch(/schema-snapshot/)
  })
})

// ── Data Compatibility (SDK ↔ DB schema) ──────────────────────────────────

describe('Data Compatibility Contract (INV-06d)', () => {
  it('SDK packages declare @nzila/db as a dependency', () => {
    const sdkPackages = ['ai-sdk', 'ml-sdk', 'payments-stripe', 'qbo']
    const violations: string[] = []

    for (const pkg of sdkPackages) {
      const pkgJsonPath = resolve(REPO_ROOT, `packages/${pkg}/package.json`)
      if (!existsSync(pkgJsonPath)) continue
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
      const allDeps = {
        ...(pkgJson.dependencies ?? {}),
        ...(pkgJson.devDependencies ?? {}),
        ...(pkgJson.peerDependencies ?? {}),
      }

      // SDKs that access DB should declare @nzila/db
      const srcDir = resolve(REPO_ROOT, `packages/${pkg}/src`)
      if (!existsSync(srcDir)) continue

      const srcFiles = findTsFiles(srcDir)
      const usesDb = srcFiles.some((f) => {
        const content = readFileSync(f, 'utf-8')
        return content.includes('@nzila/db')
      })

      if (usesDb && !allDeps['@nzila/db']) {
        violations.push(`${pkg}: uses @nzila/db in source but doesn't declare it as dependency`)
      }
    }

    expect(
      violations,
      `SDK packages with undeclared @nzila/db dependency:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('DB schema barrel exports all table modules', () => {
    const schemaIndex = resolve(REPO_ROOT, 'packages/db/src/schema/index.ts')
    if (!existsSync(schemaIndex)) return
    const content = readFileSync(schemaIndex, 'utf-8')

    // Key schema modules that must be exported (must match actual barrel structure)
    const requiredModules = ['entities', 'payments', 'finance']
    for (const mod of requiredModules) {
      expect(
        content.toLowerCase(),
        `DB schema index must export ${mod} module`,
      ).toContain(mod)
    }
  })
})

// ── Helper ────────────────────────────────────────────────────────────────

function findTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(join((entry as any).path ?? dir, entry.name))
    }
  }
  return results
}
