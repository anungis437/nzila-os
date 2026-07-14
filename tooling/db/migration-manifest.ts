/**
 * Migration immutability manifest.
 *
 * Records a SHA-256 for every root `migrations/*.sql` file so that a
 * previously-committed (released) migration cannot be silently edited. A
 * released migration may only change with an explicit, documented override
 * entry — this is what stops the "same migration version, two different
 * schemas" drift class.
 *
 * Usage:
 *   pnpm tsx tooling/db/migration-manifest.ts write    # regenerate the manifest
 *   pnpm tsx tooling/db/migration-manifest.ts verify   # fail on any drift
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dirname ?? __dirname, '..', '..')
const MIGRATIONS_DIR = join(REPO_ROOT, 'migrations')
const MANIFEST_FILE = join(MIGRATIONS_DIR, 'migration-manifest.json')

export type MigrationOverride = {
  reason: string
  evidence: string
  approvedBy: string
}

export type MigrationManifestEntry = {
  file: string
  sha256: string
  /** Present only when a released migration was deliberately amended. */
  override?: MigrationOverride
}

export type MigrationManifest = {
  description: string
  lockedThrough: string
  migrations: MigrationManifestEntry[]
}

/** Root SQL migration files (numbered, top-level). Excludes migrations/platform/. */
export function rootMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
}

/** SHA-256 of the file content with normalized (LF) line endings for determinism. */
export function migrationHash(file: string): string {
  const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(content).digest('hex')
}

export function loadManifest(): MigrationManifest {
  if (!existsSync(MANIFEST_FILE)) {
    throw new Error(`migration manifest missing at ${MANIFEST_FILE}`)
  }
  return JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as MigrationManifest
}

export type ManifestDrift = {
  missingFromManifest: string[]
  missingFromDisk: string[]
  modified: { file: string; expected: string; actual: string; hasOverride: boolean }[]
}

/** Compare the on-disk migrations against the committed manifest. */
export function computeManifestDrift(manifest: MigrationManifest): ManifestDrift {
  const onDisk = rootMigrationFiles()
  const byFile = new Map(manifest.migrations.map((m) => [m.file, m]))
  const diskSet = new Set(onDisk)

  const missingFromManifest = onDisk.filter((f) => !byFile.has(f))
  const missingFromDisk = manifest.migrations.map((m) => m.file).filter((f) => !diskSet.has(f))
  const modified: ManifestDrift['modified'] = []
  for (const f of onDisk) {
    const entry = byFile.get(f)
    if (!entry) continue
    const actual = migrationHash(f)
    if (actual !== entry.sha256) {
      modified.push({ file: f, expected: entry.sha256, actual, hasOverride: Boolean(entry.override) })
    }
  }
  return { missingFromManifest, missingFromDisk, modified }
}

function buildManifest(previous?: MigrationManifest): MigrationManifest {
  const prevByFile = new Map((previous?.migrations ?? []).map((m) => [m.file, m]))
  const files = rootMigrationFiles()
  return {
    description:
      'SHA-256 lock for released root migrations. A released migration may only ' +
      'change with an explicit `override` entry documenting why (see 0040).',
    lockedThrough: files[files.length - 1] ?? '',
    migrations: files.map((file) => {
      const prev = prevByFile.get(file)
      const entry: MigrationManifestEntry = { file, sha256: migrationHash(file) }
      if (prev?.override) entry.override = prev.override
      return entry
    }),
  }
}

function write(): void {
  const previous = existsSync(MANIFEST_FILE) ? loadManifest() : undefined
  const manifest = buildManifest(previous)
  writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`✅ Wrote migration manifest for ${manifest.migrations.length} migrations (locked through ${manifest.lockedThrough})`)
}

function verify(): void {
  const manifest = loadManifest()
  const drift = computeManifestDrift(manifest)
  const unauthorized = drift.modified.filter((m) => !m.hasOverride)
  const problems: string[] = []
  if (drift.missingFromManifest.length) {
    problems.push(`Untracked migrations (run \`migration-manifest write\`): ${drift.missingFromManifest.join(', ')}`)
  }
  if (drift.missingFromDisk.length) {
    problems.push(`Manifest references missing files: ${drift.missingFromDisk.join(', ')}`)
  }
  for (const m of unauthorized) {
    problems.push(
      `Released migration changed without an approved override: ${m.file}\n  expected ${m.expected}\n  actual   ${m.actual}`,
    )
  }
  if (problems.length) {
    console.error('❌ Migration immutability check FAILED:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  const overridden = drift.modified.filter((m) => m.hasOverride).map((m) => m.file)
  if (overridden.length) {
    console.log(`⚠️  Migrations changed WITH documented override: ${overridden.join(', ')}`)
  }
  console.log(`✅ Migration immutability verified for ${manifest.migrations.length} migrations`)
}

// Guard CLI dispatch so importing this module (e.g. from a test) has no side effect.
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const cmd = process.argv[2]
  if (cmd === 'write') write()
  else if (cmd === 'verify') verify()
  else {
    console.error('usage: migration-manifest.ts <write|verify>')
    process.exit(1)
  }
}
