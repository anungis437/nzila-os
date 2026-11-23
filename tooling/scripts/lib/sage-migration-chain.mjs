/**
 * SAGE root migration chain helpers (0032 → latest `*_sage_*.sql`).
 *
 * Shared by B-005 preflight / qualification receipt tooling.
 * Does not apply migrations and does not claim staging proof.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = join(HERE, '..', '..', '..')
export const MIGRATIONS_DIR = join(REPO_ROOT, 'migrations')
export const MANIFEST_PATH = join(MIGRATIONS_DIR, 'migration-manifest.json')

/** Lexical order of SAGE-named root migrations from 0032 upward. */
export function listSageMigrationFiles(migrationsDir = MIGRATIONS_DIR) {
  return readdirSync(migrationsDir)
    .filter((f) => /^00(3[2-9]|4\d|5\d)_sage_.*\.sql$/.test(f))
    .sort()
}

export function sha256Normalized(content) {
  return createHash('sha256').update(String(content).replace(/\r\n/g, '\n')).digest('hex')
}

export function hashMigrationFile(file, migrationsDir = MIGRATIONS_DIR) {
  const content = readFileSync(join(migrationsDir, file), 'utf8')
  return sha256Normalized(content)
}

/**
 * Required institutional migrations for B-005 (mandate / capacity / adoption).
 * Earlier SAGE phases 0032–0044 remain in the full chain.
 */
export const B005_REQUIRED_TAIL = Object.freeze([
  '0050_sage_institutional_mandate_authority.sql',
  '0051_sage_institutional_capacity_recusal.sql',
  '0052_sage_accountability_adoption.sql',
])

export function loadMigrationManifest(manifestPath = MANIFEST_PATH) {
  if (!existsSync(manifestPath)) {
    throw new Error(`SAGE_MIGRATION_CHAIN: MANIFEST_MISSING (${manifestPath})`)
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

/**
 * Verify every on-disk SAGE migration is present in the immutability manifest
 * with a matching SHA-256, and that B-005 required tail files exist.
 */
export function verifySageMigrationChain({
  migrationsDir = MIGRATIONS_DIR,
  manifestPath = MANIFEST_PATH,
  requiredTail = B005_REQUIRED_TAIL,
} = {}) {
  const files = listSageMigrationFiles(migrationsDir)
  const manifest = loadMigrationManifest(manifestPath)
  const byFile = new Map((manifest.migrations ?? []).map((m) => [m.file, m]))
  const problems = []
  const entries = []

  for (const file of files) {
    const actual = hashMigrationFile(file, migrationsDir)
    const locked = byFile.get(file)
    const entry = {
      file,
      sha256: actual,
      manifestSha256: locked?.sha256 ?? null,
      locked: Boolean(locked),
      match: locked ? locked.sha256 === actual : false,
    }
    entries.push(entry)
    if (!locked) problems.push(`UNTRACKED:${file}`)
    else if (locked.sha256 !== actual) problems.push(`CHECKSUM_MISMATCH:${file}`)
  }

  for (const required of requiredTail) {
    if (!files.includes(required)) problems.push(`MISSING_REQUIRED:${required}`)
  }

  const lockedThrough = typeof manifest.lockedThrough === 'string' ? manifest.lockedThrough : null
  if (lockedThrough !== requiredTail[requiredTail.length - 1]) {
    // Soft advisory: lockedThrough should reach 0052 for B-005 readiness.
    if (!problems.some((p) => p.startsWith('MISSING_REQUIRED:0052'))) {
      /* still pass verify if files locked; record advisory in receipt */
    }
  }

  return {
    schemaVersion: 1,
    kind: 'SAGE_MIGRATION_CHAIN_VERIFY',
    observedAt: new Date().toISOString(),
    migrationsDir,
    fileCount: files.length,
    files,
    entries,
    requiredTail,
    lockedThrough,
    lockedThroughMeetsB005: lockedThrough === requiredTail[requiredTail.length - 1],
    problems,
    result: problems.length === 0 ? 'CHAIN_OK' : 'CHAIN_FAIL',
    b005Closure: 'NOT_PROVEN',
  }
}
