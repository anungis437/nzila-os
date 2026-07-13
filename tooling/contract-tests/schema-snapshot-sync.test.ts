import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  captureSnapshot,
  computeDrift,
  SCHEMA_DIR,
  SNAPSHOT_FILE,
  type SchemaSnapshot,
} from '../db/schema-snapshot'

/**
 * Durable guard for the repository's Schema Drift Detection baseline.
 *
 * The committed snapshot at tooling/db/schema-snapshot.json is the content-
 * addressed fingerprint of the authoritative Drizzle schema. These tests fail
 * closed if (a) the committed snapshot ever drifts from the schema again, or
 * (b) the snapshot generator becomes non-deterministic — either of which would
 * make the CI Schema Drift Detection check meaningless.
 */
describe('schema snapshot baseline', () => {
  it('generation is deterministic (verification-relevant content is byte-identical)', () => {
    const a = captureSnapshot()
    const b = captureSnapshot()
    // `capturedAt` is informational metadata and is intentionally excluded — it
    // is never compared by drift detection. Everything drift detection reads
    // (per-file hashes + composite hash) must be identical run-to-run.
    expect(JSON.stringify(a.files)).toBe(JSON.stringify(b.files))
    expect(a.compositeHash).toBe(b.compositeHash)
    expect(a.schemaDir).toBe(b.schemaDir)
  })

  it('the committed snapshot is in sync with the authoritative Drizzle schema', () => {
    const persisted: SchemaSnapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'))
    const current = captureSnapshot()
    const drift = computeDrift(persisted, current)
    expect(drift).toEqual({ added: [], removed: [], modified: [] })
    // Composite hash of the committed snapshot must match a fresh capture.
    expect(persisted.compositeHash).toBe(current.compositeHash)
  })

  it('verify passes immediately after a fresh capture', () => {
    const current = captureSnapshot()
    // Comparing a capture to itself must never report drift.
    expect(computeDrift(current, current)).toEqual({ added: [], removed: [], modified: [] })
  })

  it('a deliberate schema mutation is detected as drift', () => {
    const current = captureSnapshot()
    const target = 'packages/db/src/schema/platform.ts'
    expect(current.files[target]).toBeDefined()
    // Simulate a persisted baseline whose platform.ts hash predates a schema edit.
    const stale: SchemaSnapshot = {
      ...current,
      files: {
        ...current.files,
        [target]: { hash: 'deadbeef'.repeat(8), size: current.files[target].size },
      },
    }
    const drift = computeDrift(stale, current)
    expect(drift.modified).toContain(target)
    expect(drift.added).toEqual([])
    expect(drift.removed).toEqual([])
  })

  it('a removed / added schema file is detected as drift', () => {
    const current = captureSnapshot()
    const target = 'packages/db/src/schema/platform.ts'
    // Persisted baseline that is missing platform.ts → current has it ADDED.
    const missing = current.files[target]
    const withoutTarget = { ...current.files }
    delete withoutTarget[target]
    const persistedMissing: SchemaSnapshot = { ...current, files: withoutTarget }
    expect(computeDrift(persistedMissing, current).added).toContain(target)

    // Persisted baseline that has an extra file → current has it REMOVED.
    const persistedExtra: SchemaSnapshot = {
      ...current,
      files: { ...current.files, 'packages/db/src/schema/__ghost__.ts': missing },
    }
    expect(computeDrift(persistedExtra, current).removed).toContain(
      'packages/db/src/schema/__ghost__.ts',
    )
  })

  it('the snapshot represents the platform idempotency reservation-lease schema', () => {
    const current = captureSnapshot()
    const target = 'packages/db/src/schema/platform.ts'
    expect(current.files[target]).toBeDefined()
    // The authoritative Drizzle source carries the fencing/lease column that the
    // committed migration (0031_idempotency_reservation_lease) adds.
    const platformSchema = readFileSync(join(SCHEMA_DIR, 'platform.ts'), 'utf-8')
    expect(platformSchema).toContain('reservation_owner')
    // And the committed snapshot's recorded hash matches that current source.
    const persisted: SchemaSnapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'))
    expect(persisted.files[target].hash).toBe(current.files[target].hash)
  })
})
