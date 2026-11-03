import { describe, expect, it } from 'vitest'
import { packSignatureSchema, procurementManifestSchema } from './types'
import { safeValidateSection, validateSection } from './schemas/section.schema'
describe('Zod 4 procurement evidence boundaries', () => {
  it('validates section envelopes and rejects invalid statuses and timestamps', () => {
    const section = { section: 'security', status: 'ok', collectedAt: '2026-11-02T12:00:00Z', source: 'collector', data: { result: 'pass' } }
    expect(validateSection(section)).toEqual(section)
    expect(safeValidateSection({ ...section, collectedAt: '2026-11-02' }).success).toBe(false)
    expect(safeValidateSection({ ...section, status: 'verified_without_evidence' }).success).toBe(false)
  })
  it('requires a record of string checksums and required signature fields', () => {
    const manifest = { version: '1', sectionCount: 1, artifactCount: 1, generatedAt: '2026-11-02T12:00:00Z', checksums: { 'evidence.json': 'sha256:abc' } }
    expect(procurementManifestSchema.parse(manifest).checksums['evidence.json']).toBe('sha256:abc')
    expect(procurementManifestSchema.safeParse({ ...manifest, checksums: { 'evidence.json': 42 } }).success).toBe(false)
    expect(procurementManifestSchema.safeParse({ ...manifest, checksums: ['sha256:abc'] }).success).toBe(false)
    const signature = { algorithm: 'Ed25519', digest: 'abc', signedAt: '2026-11-02T12:00:00Z', signedBy: 'signer', keyId: 'key-1' }
    expect(packSignatureSchema.safeParse(signature).success).toBe(true)
    expect(packSignatureSchema.safeParse({ ...signature, keyId: 3 }).success).toBe(false)
  })
})
