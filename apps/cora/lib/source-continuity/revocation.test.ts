import { describe, expect, it } from 'vitest'
import { assembleContinuityCapsule } from './capsule'
import { exportContinuityCapsule } from './export'
import {
  buildSyntheticRouteFixture,
  SYNTHETIC_ORG_ID,
  SYNTHETIC_PURPOSE,
  SYNTHETIC_TIME,
} from './fixtures/synthetic-routes'
import { revokeCapsuleRights } from './revocation'
import { reconcileDeletionObligations } from './deletion'

function createCapsule() {
  const fixture = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
  return assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: 'synthetic-capsule-revocation',
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
    },
    SYNTHETIC_ORG_ID,
  )
}

describe('rights revocation propagation', () => {
  it('blocks new export after revocation while leaving authorized cleanup possible', () => {
    const revoked = revokeCapsuleRights(
      createCapsule(),
      SYNTHETIC_ORG_ID,
      'synthetic-operator-001',
      '2026-02-10T12:01:00.000Z',
    )
    expect(revoked.captures[0]?.rights.revokedAt).toBe('2026-02-10T12:01:00.000Z')
    expect(() =>
      exportContinuityCapsule(
        revoked,
        'synthetic-institution-alpha',
        SYNTHETIC_PURPOSE,
        '2026-02-10T12:02:00.000Z',
      ),
    ).toThrow(/RIGHTS_REVOKED/)
    expect(
      reconcileDeletionObligations(revoked, ['synthetic-cora-copy'], [], '2026-02-10T12:02:00.000Z')
        .status,
    ).toBe('OBLIGATIONS_REMAIN')
  })

  it('does not treat revocation as proof that replicas have been deleted', () => {
    const revoked = revokeCapsuleRights(
      createCapsule(),
      SYNTHETIC_ORG_ID,
      'synthetic-operator-001',
      '2026-02-10T12:01:00.000Z',
    )
    const report = reconcileDeletionObligations(
      revoked,
      ['synthetic-cora-copy'],
      ['synthetic-cora-copy'],
      '2026-02-10T12:02:00.000Z',
    )
    expect(report.status).toBe('ALL_DECLARED_OBLIGATIONS_ACKNOWLEDGED')
    expect(report.physicalDeletion).toBe('NOT_VERIFIED')
  })
})
