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
} from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = join(__dirname, '../..')
const SCHEMA_DIR = join(REPO_ROOT, 'packages', 'db', 'src', 'schema')
const SNAPSHOT_FILE = join(REPO_ROOT, 'tooling', 'db', 'schema-snapshot.json')

interface SchemaSnapshot {
  capturedAt: string
  schemaDir: string
  files: Record<string, { hash: string; size: number }>
  compositeHash: string
}

function hashFile(filePath: string): string {
  const content = readFileSync(filePath)
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

function captureSnapshot(): SchemaSnapshot {
  const files: Record<string, { hash: string; size: number }> = {}
  const schemaFiles = getSchemaFiles()

  for (const f of schemaFiles) {
    const rel = relative(REPO_ROOT, f)
    const content = readFileSync(f)
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
    schemaDir: relative(REPO_ROOT, SCHEMA_DIR),
    files,
    compositeHash,
  }
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

  const added = Object.keys(current.files).filter((f) => !persisted.files[f])
  const removed = Object.keys(persisted.files).filter((f) => !current.files[f])
  const modified = Object.keys(current.files).filter(
    (f) => persisted.files[f] && persisted.files[f].hash !== current.files[f].hash,
  )

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
if (command === 'write') {
  writeSnapshot()
} else if (command === 'verify') {
  verifySnapshot()
} else {
  console.error('Usage: schema-snapshot.ts <write|verify>')
  process.exit(1)
}
