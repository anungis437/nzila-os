/**
 * Contract Test — Migration Immutability
 *
 * Released root migrations must not silently change. A change to an already-
 * recorded migration is only allowed with an explicit, documented `override`
 * entry in migrations/migration-manifest.json. This closes the "same migration
 * version, two different schemas" drift class.
 *
 * @invariant MIG-IMMUT-1: every root migration is tracked by the manifest
 * @invariant MIG-IMMUT-2: a released migration's hash cannot change without an override
 */
import { describe, it, expect } from 'vitest'
import {
  loadManifest,
  computeManifestDrift,
  rootMigrationFiles,
  migrationHash,
} from '../db/migration-manifest'

describe('migration immutability manifest', () => {
  it('tracks every root migration on disk', () => {
    const manifest = loadManifest()
    const tracked = new Set(manifest.migrations.map((m) => m.file))
    for (const f of rootMigrationFiles()) {
      expect(tracked.has(f)).toBe(true)
    }
  })

  it('has no unauthorized drift (every changed migration carries an override)', () => {
    const manifest = loadManifest()
    const drift = computeManifestDrift(manifest)
    expect(drift.missingFromManifest).toEqual([])
    expect(drift.missingFromDisk).toEqual([])
    const unauthorized = drift.modified.filter((m) => !m.hasOverride)
    expect(unauthorized).toEqual([])
  })

  it('records the amended 0040 with a documented override and matching hash', () => {
    const manifest = loadManifest()
    const entry = manifest.migrations.find((m) => m.file.startsWith('0040_'))
    expect(entry).toBeTruthy()
    expect(entry?.override?.reason).toMatch(/un-applyable|never applied/i)
    expect(entry?.override?.evidence).toBeTruthy()
    // The recorded hash must match the current file (the override does not waive the hash lock).
    expect(entry?.sha256).toBe(migrationHash(entry!.file))
  })

  it('detects an unauthorized edit to a locked migration (drift logic proof)', () => {
    const manifest = loadManifest()
    // Simulate an edit to a locked, override-free migration by corrupting its
    // recorded hash, then prove the drift detector flags it as unauthorized.
    const target = manifest.migrations.find((m) => !m.override)
    expect(target).toBeTruthy()
    const tampered = {
      ...manifest,
      migrations: manifest.migrations.map((m) =>
        m.file === target!.file ? { ...m, sha256: '0'.repeat(64) } : m,
      ),
    }
    const drift = computeManifestDrift(tampered)
    const flagged = drift.modified.find((m) => m.file === target!.file)
    expect(flagged).toBeTruthy()
    expect(flagged?.hasOverride).toBe(false)
  })
})
