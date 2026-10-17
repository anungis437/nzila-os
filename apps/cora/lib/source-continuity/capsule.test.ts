import { describe, expect, it } from 'vitest'
import { assembleContinuityCapsule } from './capsule'
import { exportContinuityCapsule } from './export'
import {
  buildSyntheticRouteFixture,
  SYNTHETIC_ORG_ID,
  SYNTHETIC_PURPOSE,
  SYNTHETIC_TIME,
} from './fixtures/synthetic-routes'
import { rehydrateContinuityCapsule } from './rehydrate'
import { sha256Canonical } from './integrity'

function makeCapsule(overrides: Record<string, unknown> = {}) {
  const fixture = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
  return assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: 'synthetic-capsule-001',
      orgId: SYNTHETIC_ORG_ID,
      purpose: SYNTHETIC_PURPOSE,
      createdAt: SYNTHETIC_TIME,
      subjectRef: {
        providerId: fixture.capture.sourceRef.providerId,
        objectType: 'OPERATOR',
        objectId: 'synthetic-operator-001',
      },
      captures: [fixture.capture],
      mappings: [fixture.mapping],
      limitations: ['Synthetic fixture only'],
      ...overrides,
    },
    SYNTHETIC_ORG_ID,
  )
}

describe('continuity capsule', () => {
  it('assembles and exports a deterministic, self-contained synthetic capsule', () => {
    const first = makeCapsule()
    const second = makeCapsule()
    expect(first.integrity.sha256).toBe(second.integrity.sha256)
    expect(
      exportContinuityCapsule(
        first,
        'synthetic-institution-alpha',
        SYNTHETIC_PURPOSE,
        SYNTHETIC_TIME,
      ),
    ).toContain('"format":"CORA_CONTINUITY_CAPSULE"')
  })

  it('blocks persistence when the relevant right is unknown', () => {
    const fixture = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const { integritySha256: _digest, ...captureDraft } = fixture.capture
    const rights = { ...captureDraft.rights, persistence: 'UNKNOWN' as const }
    const capture = {
      ...captureDraft,
      rights,
      integritySha256: sha256Canonical({ ...captureDraft, rights }),
    }
    expect(() =>
      makeCapsule({
        captures: [capture],
      }),
    ).toThrow(/PERSISTENCE_UNKNOWN/)
  })

  it('fails closed for export to a recipient outside the recorded authorization', () => {
    expect(() =>
      exportContinuityCapsule(
        makeCapsule(),
        'unapproved-institution',
        SYNTHETIC_PURPOSE,
        SYNTHETIC_TIME,
      ),
    ).toThrow(/RECIPIENT_NOT_AUTHORIZED/)
  })

  it('rehydrates offline without claiming that the source remains current', () => {
    const capsule = makeCapsule()
    const serialized = exportContinuityCapsule(
      capsule,
      'synthetic-institution-alpha',
      SYNTHETIC_PURPOSE,
      SYNTHETIC_TIME,
    )
    const result = rehydrateContinuityCapsule(
      serialized,
      SYNTHETIC_ORG_ID,
      'synthetic-institution-alpha',
      SYNTHETIC_TIME,
    )
    expect(result.state).toBe('REHYDRATED_VERIFIED')
    expect(result.sourceProviderAvailable).toBe(false)
    expect(result.sourceCurrentness).toBe('NOT_VERIFIED')
    expect(result.capsule.captures[0]?.freshness).toBe('NOT_VERIFIED')
  })

  it('detects tampering, malformed export, and tenant mismatch', () => {
    const serialized = exportContinuityCapsule(
      makeCapsule(),
      'synthetic-institution-alpha',
      SYNTHETIC_PURPOSE,
      SYNTHETIC_TIME,
    )
    expect(() =>
      rehydrateContinuityCapsule(
        serialized.replace('synthetic-source-v1', 'tampered-source-v1'),
        SYNTHETIC_ORG_ID,
        'synthetic-institution-alpha',
        SYNTHETIC_TIME,
      ),
    ).toThrow(/integrity verification failed/)
    expect(() =>
      rehydrateContinuityCapsule(
        '{bad json',
        SYNTHETIC_ORG_ID,
        'synthetic-institution-alpha',
        SYNTHETIC_TIME,
      ),
    ).toThrow('Capsule export is not valid JSON')
    expect(() =>
      rehydrateContinuityCapsule(
        serialized,
        'different-org',
        'synthetic-institution-alpha',
        SYNTHETIC_TIME,
      ),
    ).toThrow('Capsule organization does not match trusted Cora organization')
  })
})
