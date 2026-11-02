import { describe, expect, it } from 'vitest'
import { evidenceArtifactSchema } from './types'

const artifact = { artifactId: 'artifact-1', artifactType: 'audit', sha256: 'a'.repeat(64), sizeBytes: 10, mimeType: 'application/json', blobPath: 'evidence/a.json', collectedAt: '2026-11-02T10:00:00.000Z', metadata: { source: 'test' } }

describe('Zod 4 evidence artifact boundary', () => {
  it('preserves string-valued metadata and digest requirements', () => {
    expect(evidenceArtifactSchema.parse(artifact).metadata).toEqual({ source: 'test' })
  })
  it('rejects malformed digests and non-string metadata', () => {
    expect(evidenceArtifactSchema.safeParse({ ...artifact, sha256: 'not-a-hash' }).success).toBe(false)
    expect(evidenceArtifactSchema.safeParse({ ...artifact, metadata: { source: 1 } }).success).toBe(false)
  })
})
