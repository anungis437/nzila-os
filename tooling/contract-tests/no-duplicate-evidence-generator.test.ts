/**
 * PR0.1b — Contract test: no duplicate evidence generator logic
 *
 * Enforces: tooling/scripts/generate-evidence-index.ts is a THIN WRAPPER only.
 * All business logic (schema types, upload pipeline, EvidencePackIndex building)
 * must live exclusively in packages/os-core/src/evidence/generate-evidence-index.ts.
 *
 * Gate: CI fails if these patterns are found in the tooling wrapper.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WRAPPER_PATH = resolve(__dirname, '../../tooling/scripts/generate-evidence-index.ts')
const CANONICAL_PATH = resolve(
  __dirname,
  '../../packages/os-core/src/evidence/generate-evidence-index.ts',
)

function readSource(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('no-duplicate-evidence-generator (PR0.1b)', () => {
  const wrapper = readSource(WRAPPER_PATH)
  const canonical = readSource(CANONICAL_PATH)

  // ── Wrapper must NOT contain schema/type definitions ────────────────────

  it('wrapper must not define EvidencePackIndex interface', () => {
    expect(wrapper).not.toMatch(/interface\s+EvidencePackIndex\b/)
  })

  it('wrapper must not define ControlFamily type locally', () => {
    // Type IMPORTS are allowed; local type DEFINITIONS are not.
    expect(wrapper).not.toMatch(/^type\s+ControlFamily\s*=/m)
  })

  it('wrapper must not define EventType type locally', () => {
    expect(wrapper).not.toMatch(/^type\s+EventType\s*=/m)
  })

  it('wrapper must not define RetentionClass type locally', () => {
    expect(wrapper).not.toMatch(/^type\s+RetentionClass\s*=/m)
  })

  it('wrapper must not contain computeSha256 implementation', () => {
    expect(wrapper).not.toMatch(/function\s+computeSha256\b/)
    expect(wrapper).not.toMatch(/createHash\(['"]sha256['"]\)/)
  })

  // ── Wrapper must NOT contain upload pipeline ────────────────────────────

  it('wrapper must not contain runUpload function', () => {
    expect(wrapper).not.toMatch(/function\s+runUpload\b/)
    expect(wrapper).not.toMatch(/async\s+function\s+runUpload\b/)
  })

  it('wrapper must not contain UploadContext interface', () => {
    expect(wrapper).not.toMatch(/interface\s+UploadContext\b/)
  })

  it('wrapper must not directly import @nzila/blob for upload', () => {
    // Direct static imports of @nzila/blob are forbidden in the wrapper.
    // Dynamic re-delegation to os-core is the only allowed path.
    expect(wrapper).not.toMatch(/^import.*@nzila\/blob/m)
  })

  it('wrapper must not directly import @nzila/db for schema writes', () => {
    expect(wrapper).not.toMatch(/^import.*@nzila\/db/m)
  })

  it('wrapper must not build EvidencePackIndex directly', () => {
    // No direct construction of the old schema shape
    expect(wrapper).not.toMatch(/schema_version:\s*['"]1\.0\.0['"]/)
    expect(wrapper).not.toMatch(/pack_id:\s*packId/)
    expect(wrapper).not.toMatch(/control_family:\s*controlFamily/)
  })

  it('wrapper must not use VALID_CONTROL_FAMILIES set', () => {
    expect(wrapper).not.toMatch(/VALID_CONTROL_FAMILIES/)
  })

  it('wrapper must not use VALID_EVENT_TYPES set', () => {
    expect(wrapper).not.toMatch(/VALID_EVENT_TYPES/)
  })

  // ── Wrapper MUST delegate to os-core ────────────────────────────────────

  it('wrapper must import types from @nzila/os-core/evidence/types', () => {
    expect(wrapper).toMatch(/@nzila\/os-core\/evidence\/types/)
  })

  it('wrapper must delegate upload to processEvidencePack from os-core', () => {
    expect(wrapper).toMatch(/processEvidencePack/)
    expect(wrapper).toMatch(/@nzila\/os-core\/evidence\/generate-evidence-index/)
  })

  // ── Canonical implementation must have business logic ──────────────────

  it('os-core canonical must export processEvidencePack', () => {
    expect(canonical).toMatch(/export\s+async\s+function\s+processEvidencePack\b/)
  })

  it('os-core canonical must export buildLocalEvidencePackIndex', () => {
    expect(canonical).toMatch(/export\s+function\s+buildLocalEvidencePackIndex\b/)
  })

  it('os-core canonical must contain Blob upload logic', () => {
    expect(canonical).toMatch(/uploadBuffer/)
  })

  it('os-core canonical must contain DB insert for evidence_packs', () => {
    expect(canonical).toMatch(/evidencePacks/)
  })
})
