/**
 * DB Schema Snapshot Tool (Phase 6, PR6.2b)
 *
 * Captures the current state of all Drizzle schema files as a
 * content-addressed snapshot for drift detection.
 *
 * Usage:
 *   pnpm tsx tooling/db/schema-snapshot.ts write   # write current snapshot
 *   pnpm tsx tooling/db/schema-snapshot.ts verify  # verify no drift
 */
import { createHash } from 'node:crypto'
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  realpathSync,
} from 'node:fs'
import { join, relative, resolve } from 'node:path'

// `import.meta.dirname` under vitest/vite; `__dirname` under tsx (CommonJS root).
const MODULE_DIR = import.meta.dirname ?? __dirname
const REPO_ROOT = realpathSync(join(MODULE_DIR, '../..'))
export const SCHEMA_DIR = join(REPO_ROOT, 'packages', 'db', 'src', 'schema')
export const SNAPSHOT_FILE = join(REPO_ROOT, 'tooling', 'db', 'schema-snapshot.json')

export interface SchemaSnapshot {
  capturedAt: string
  schemaDir: string
  files: Record<string, { hash: string; size: number }>
  compositeHash: string
}

function hashFile(filePath: string): string {
  const resolved = resolve(filePath)
  if (!resolved.startsWith(SCHEMA_DIR)) {
    throw new Error(`Path traversal blocked: ${filePath}`)
  }
  const content = readFileSync(resolved)
  return createHash('sha256').update(content).digest('hex')
}

function getSchemaFiles(): string[] {
  const results: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else if (entry.endsWith('.ts') || entry.endsWith('.sql')) {
        results.push(full)
      }
    }
  }
  walk(SCHEMA_DIR)
  return results.sort()
}

export function captureSnapshot(): SchemaSnapshot {
  const files: Record<string, { hash: string; size: number }> = {}
  const schemaFiles = getSchemaFiles()

  for (const f of schemaFiles) {
    const rel = relative(REPO_ROOT, f).replace(/\\/g, '/')
    // Normalize line endings to LF for cross-platform consistency
    const content = readFileSync(f, 'utf-8').replace(/\r\n/g, '\n')
    files[rel] = {
      hash: createHash('sha256').update(content).digest('hex'),
      size: content.length,
    }
  }

  const compositeHash = createHash('sha256')
    .update(JSON.stringify(Object.entries(files).sort()))
    .digest('hex')

  return {
    capturedAt: new Date().toISOString(),
    schemaDir: relative(REPO_ROOT, SCHEMA_DIR).replace(/\\/g, '/'),
    files,
    compositeHash,
  }
}

export interface SchemaDrift {
  added: string[]
  removed: string[]
  modified: string[]
}

/** Pure drift comparison between a persisted snapshot and a fresh capture. */
export function computeDrift(persisted: SchemaSnapshot, current: SchemaSnapshot): SchemaDrift {
  const added = Object.keys(current.files).filter((f) => !persisted.files[f])
  const removed = Object.keys(persisted.files).filter((f) => !current.files[f])
  const modified = Object.keys(current.files).filter(
    (f) => persisted.files[f] && persisted.files[f].hash !== current.files[f].hash,
  )
  return { added, removed, modified }
}

function writeSnapshot(): void {
  const snapshot = captureSnapshot()
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`✅ Schema snapshot written to ${SNAPSHOT_FILE}`)
  console.log(`   Composite hash: ${snapshot.compositeHash}`)
  console.log(`   Files snapshotted: ${Object.keys(snapshot.files).length}`)
}

function verifySnapshot(): void {
  if (!existsSync(SNAPSHOT_FILE)) {
    console.error(`❌ Schema snapshot not found at ${SNAPSHOT_FILE}`)
    console.error('   Run: pnpm tsx tooling/db/schema-snapshot.ts write')
    process.exit(1)
  }

  const persisted: SchemaSnapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'))
  const current = captureSnapshot()

  const { added, removed, modified } = computeDrift(persisted, current)
  const hasDrift = added.length > 0 || removed.length > 0 || modified.length > 0

  if (hasDrift) {
    console.error('\n❌ Schema drift detected!\n')
    if (added.length) console.error('  Added:\n' + added.map((f) => `    + ${f}`).join('\n'))
    if (removed.length) console.error('  Removed:\n' + removed.map((f) => `    - ${f}`).join('\n'))
    if (modified.length)
      console.error('  Modified:\n' + modified.map((f) => `    ~ ${f}`).join('\n'))
    console.error(
      '\nIf this is intentional, run: pnpm tsx tooling/db/schema-snapshot.ts write\n',
    )
    process.exit(1)
  } else {
    console.log('✅ Schema snapshot verified — no drift detected')
    console.log(`   Composite hash: ${current.compositeHash}`)
  }
}

const command = process.argv[2]

// Only run the CLI when invoked directly (tsx). When imported by a test the
// `require.main === module` guard is false, so no side effects / process.exit.
const invokedDirectly =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module

if (invokedDirectly) {
  if (command === 'write') {
    writeSnapshot()
  } else if (command === 'verify') {
    verifySnapshot()
  } else {
    console.error('Usage: schema-snapshot.ts <write|verify>')
    process.exit(1)
  }
}
