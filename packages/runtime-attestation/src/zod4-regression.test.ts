import { describe, expect, it } from 'vitest'
import { runtimeAttestationSchema, attestationManifestSchema } from './attestation'
import { ledgerRecordSchema } from './ledger'

const attestation = {
  id: 'att-1', schemaVersion: '1.0.0', class: 'deployment', releaseId: 'release-1',
  environment: 'staging', subject: { kind: 'image', id: 'sha256:abc' },
  verdict: 'unverified', rationale: 'Requires independent runtime evidence',
  citedEvidence: [{ id: 'evidence-1', contentHash: '0123456789abcdef', description: 'Source' }],
  issuedBy: 'reviewer-1', issuedAt: '2026-11-02T00:00:00Z',
  window: { start: '2026-11-01T00:00:00Z', end: '2026-11-02T00:00:00Z' },
}

describe('Zod 4 runtime attestation boundary regression', () => {
  it('preserves a valid release-bound attestation', () => {
    expect(runtimeAttestationSchema.parse(attestation).releaseId).toBe('release-1')
  })
  it('rejects missing release authority and fabricated evidence', () => {
    expect(runtimeAttestationSchema.safeParse({ ...attestation, releaseId: '' }).success).toBe(false)
    expect(runtimeAttestationSchema.safeParse({ ...attestation, citedEvidence: [] }).success).toBe(false)
    expect(runtimeAttestationSchema.safeParse({ ...attestation, signature: { signer: 'x', algorithm: 'unknown', value: 'x', signedAt: '2026-11-02T00:00:00Z' } }).success).toBe(false)
  })
  it('rejects a manifest with a different environment', () => {
    expect(attestationManifestSchema.safeParse({ id: 'manifest-1', schemaVersion: '1.0.0', releaseId: 'release-1', environment: 'production', attestations: [attestation], issuedAt: '2026-11-02T00:00:00Z' }).success).toBe(false)
  })
  it('accepts ledger object payload and rejects an array payload', () => {
    const record = { id: 'ledger-1', contentHash: '0123456789abcdef', type: 'attestation', subject: { kind: 'image', id: 'image-1' }, scope: { environment: 'staging' }, payload: { nested: { verified: false } }, retentionClass: 'standard', accessClass: 'platform-only', writtenAt: '2026-11-02T00:00:00Z' }
    expect(ledgerRecordSchema.parse(record).payload).toEqual(record.payload)
    expect(ledgerRecordSchema.safeParse({ ...record, payload: [] }).success).toBe(false)
  })
})
