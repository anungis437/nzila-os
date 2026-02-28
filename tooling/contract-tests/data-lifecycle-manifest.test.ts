/**
 * Contract tests — Data Lifecycle Manifest Required
 *
 * Enforces that:
 *   1. packages/data-lifecycle exists with proper package config.
 *   2. Manifest engine generates manifests for all apps.
 *   3. Manifests include retention, deletion, and residency policies.
 *   4. platform-proof exports a data lifecycle proof section.
 *   5. Data lifecycle is wired into the root vitest config.
 *
 * @invariant DATA_LIFECYCLE_MANIFEST_REQUIRED_003
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

/** Known apps that must have manifests */
const REQUIRED_APPS = [
  'abr',
  'nacp-exams',
  'console',
  'union-eyes',
  'web',
  'orchestrator-api',
  'cfo',
  'partners',
  'shop-quoter',
  'trade',
  'zonga',
  'pondu',
  'cora',
]

describe('Data Lifecycle — Manifest Required', () => {
  // ── Package exists ────────────────────────────────────────────────────
  it('DATA_LIFECYCLE_MANIFEST_REQUIRED_003: packages/data-lifecycle package exists', () => {
    const pkg = readContent('packages/data-lifecycle/package.json')
    expect(pkg).toBeTruthy()

    const parsed = JSON.parse(pkg)
    expect(parsed.name).toBe('@nzila/data-lifecycle')
  })

  // ── Manifest engine exports ───────────────────────────────────────────
  it('DATA_LIFECYCLE_MANIFEST_REQUIRED_003: manifest engine exports required functions', () => {
    const manifest = readContent('packages/data-lifecycle/src/manifest.ts')
    expect(manifest).toBeTruthy()

    expect(
      manifest.includes('generateAppManifest'),
      'manifest.ts must export generateAppManifest function',
    ).toBe(true)

    expect(
      manifest.includes('generateAllManifests'),
      'manifest.ts must export generateAllManifests function',
    ).toBe(true)

    expect(
      manifest.includes('validateManifest'),
      'manifest.ts must export validateManifest function',
    ).toBe(true)
  })

  // ── All apps covered ─────────────────────────────────────────────────
  it('DATA_LIFECYCLE_MANIFEST_REQUIRED_003: manifests cover all required apps', () => {
    const manifest = readContent('packages/data-lifecycle/src/manifest.ts')
    expect(manifest).toBeTruthy()

    for (const app of REQUIRED_APPS) {
      expect(
        manifest.includes(`'${app}'`) || manifest.includes(`"${app}"`),
        `manifest.ts must define a manifest for app: ${app}`,
      ).toBe(true)
    }
  })

  // ── Manifest types include required fields ────────────────────────────
  it('DATA_LIFECYCLE_MANIFEST_REQUIRED_003: manifest types include retention, deletion, residency', () => {
    const manifest = readContent('packages/data-lifecycle/src/manifest.ts')
    expect(manifest).toBeTruthy()

    expect(manifest.includes('RetentionSchedule'), 'manifest must define RetentionSchedule type').toBe(true)
    expect(manifest.includes('DeletionPolicy'), 'manifest must define DeletionPolicy type').toBe(true)
    expect(manifest.includes('ResidencyOption'), 'manifest must define ResidencyOption type').toBe(true)
    expect(manifest.includes('BackupPosture'), 'manifest must define BackupPosture type').toBe(true)
  })

  // ── Proof section in platform-proof ───────────────────────────────────
  it('DATA_LIFECYCLE_MANIFEST_REQUIRED_003: platform-proof exports data lifecycle proof section', () => {
    const proofIndex = readContent('packages/platform-proof/src/index.ts')
    expect(proofIndex).toBeTruthy()

    expect(
      proofIndex.includes('data-lifecycle-proof'),
      'platform-proof index must re-export from data-lifecycle-proof',
    ).toBe(true)

    const dlProof = readContent('packages/platform-proof/src/data-lifecycle-proof.ts')
    expect(dlProof).toBeTruthy()

    expect(
      dlProof.includes('generateDataLifecycleProofSection'),
      'data-lifecycle-proof.ts must export generateDataLifecycleProofSection',
    ).toBe(true)

    expect(
      dlProof.includes('DataLifecycleProofSection'),
      'data-lifecycle-proof.ts must export DataLifecycleProofSection type',
    ).toBe(true)
  })

  // ── Root test config ──────────────────────────────────────────────────
  it('DATA_LIFECYCLE_MANIFEST_REQUIRED_003: data-lifecycle wired into root vitest config', () => {
    const vitestConfig = readContent('vitest.config.ts')
    expect(vitestConfig).toBeTruthy()

    expect(
      vitestConfig.includes('data-lifecycle'),
      'Root vitest.config.ts must include packages/data-lifecycle in its test projects',
    ).toBe(true)
  })
})
