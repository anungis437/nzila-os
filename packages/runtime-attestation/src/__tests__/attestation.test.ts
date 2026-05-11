import { describe, it, expect } from 'vitest'

import {
  ATTESTATION_SCHEMA_VERSION,
  ContentHashMismatchError,
  GovernanceEvidenceLedger,
  LedgerMutationRejectedError,
  computeContentHash,
  validateAttestation,
  validateManifest,
  type LedgerRecord,
  type RuntimeAttestation,
} from '../index'

const validAttestation: RuntimeAttestation = {
  id: 'att-001',
  schemaVersion: ATTESTATION_SCHEMA_VERSION,
  class: 'deployment',
  releaseId: 'UE-2026-05-09-001',
  environment: 'ue-pilot-2026q2',
  subject: { kind: 'release', id: 'UE-2026-05-09-001' },
  verdict: 'verified',
  rationale: 'all deployment legitimacy checks passed',
  citedEvidence: [
    { id: 'evd-001', contentHash: 'sha256-abcdefg123', description: 'manifest hash check' },
  ],
  issuedBy: 'release-governance-pipeline',
  issuedAt: '2026-05-09T12:00:00.000Z',
  window: { start: '2026-05-09T11:00:00.000Z', end: '2026-05-09T12:00:00.000Z' },
}

describe('content hash', () => {
  it('is stable across key ordering', () => {
    const a = computeContentHash({ x: 1, y: 2 })
    const b = computeContentHash({ y: 2, x: 1 })
    expect(a).toBe(b)
  })

  it('differs for different payloads', () => {
    expect(computeContentHash({ x: 1 })).not.toBe(computeContentHash({ x: 2 }))
  })

  it('produces a sha256-prefixed hex digest', () => {
    expect(computeContentHash({ a: 1 })).toMatch(/^sha256-[0-9a-f]{64}$/)
  })
})

describe('attestation validation', () => {
  it('accepts a well-formed attestation', () => {
    expect(() => validateAttestation(validAttestation)).not.toThrow()
  })

  it('rejects unbound attestations (missing releaseId)', () => {
    expect(() => validateAttestation({ ...validAttestation, releaseId: '' })).toThrow()
  })

  it('rejects attestations without cited evidence', () => {
    expect(() => validateAttestation({ ...validAttestation, citedEvidence: [] })).toThrow()
  })
})

describe('manifest validation', () => {
  it('rejects manifests whose attestations span releases', () => {
    expect(() =>
      validateManifest({
        id: 'mf-1',
        schemaVersion: ATTESTATION_SCHEMA_VERSION,
        releaseId: 'UE-2026-05-09-001',
        environment: 'ue-pilot-2026q2',
        attestations: [
          { ...validAttestation, releaseId: 'OTHER-RELEASE' },
        ],
        issuedAt: '2026-05-09T12:00:00.000Z',
      }),
    ).toThrow()
  })
})

describe('GovernanceEvidenceLedger', () => {
  function makeRecord(id: string, payload: Record<string, unknown>): LedgerRecord {
    return {
      id,
      contentHash: computeContentHash(payload),
      type: 'attestation.deployment',
      subject: { kind: 'release', id: 'UE-2026-05-09-001' },
      scope: { product: 'union-eyes', environment: 'ue-pilot-2026q2' },
      releaseId: 'UE-2026-05-09-001',
      payload,
      retentionClass: 'standard',
      accessClass: 'governance-forum',
      writtenAt: '2026-05-09T12:00:00.000Z',
    }
  }

  it('appends a well-formed record', () => {
    const ledger = new GovernanceEvidenceLedger()
    const rec = makeRecord('rec-1', { foo: 'bar' })
    expect(() => ledger.append(rec)).not.toThrow()
    expect(ledger.size()).toBe(1)
  })

  it('rejects mutation of an existing id', () => {
    const ledger = new GovernanceEvidenceLedger()
    ledger.append(makeRecord('rec-1', { foo: 'bar' }))
    expect(() => ledger.append(makeRecord('rec-1', { foo: 'baz' }))).toThrow(
      LedgerMutationRejectedError,
    )
  })

  it('rejects records with mismatched content hash', () => {
    const ledger = new GovernanceEvidenceLedger()
    const rec = makeRecord('rec-1', { foo: 'bar' })
    expect(() =>
      ledger.append({ ...rec, contentHash: 'sha256-bogus0000' }),
    ).toThrow(ContentHashMismatchError)
  })

  it('records supersession links bidirectionally', () => {
    const ledger = new GovernanceEvidenceLedger()
    const a = makeRecord('rec-1', { v: 1 })
    ledger.append(a)
    const b = makeRecord('rec-2', { v: 2 })
    ledger.supersede('rec-1', b)
    expect(ledger.get('rec-1')?.supersededBy).toBe('rec-2')
    expect(ledger.get('rec-2')?.supersedes).toBe('rec-1')
  })
})
