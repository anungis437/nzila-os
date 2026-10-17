import { describe, expect, it } from 'vitest'
import { assembleContinuityCapsule } from './capsule'
import { reconcileDeletionObligations } from './deletion'
import { sha256Canonical } from './integrity'
import {
  buildSyntheticRouteFixture,
  SYNTHETIC_ORG_ID,
  SYNTHETIC_PURPOSE,
  SYNTHETIC_TIME,
} from './fixtures/synthetic-routes'

function capsuleWithRights(deletion: 'ALLOWED' | 'UNKNOWN') {
  const fixture = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
  const { integritySha256: _integrity, ...draft } = fixture.capture
  const capture = {
    ...draft,
    rights: { ...draft.rights, deletion },
  }
  return assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: 'synthetic-capsule-delete',
      orgId: SYNTHETIC_ORG_ID,
      purpose: SYNTHETIC_PURPOSE,
      createdAt: SYNTHETIC_TIME,
      subjectRef: {
        providerId: capture.sourceRef.providerId,
        objectType: 'OPERATOR',
        objectId: 'synthetic-operator-001',
      },
      captures: [
        {
          ...capture,
          integritySha256: sha256Canonical(capture),
        },
      ],
      mappings: [fixture.mapping],
      limitations: ['Synthetic fixture only'],
    },
    SYNTHETIC_ORG_ID,
  )
}

describe('synthetic deletion obligation reconciliation', () => {
  it('reports outstanding replicas and never claims physical deletion', () => {
    const report = reconcileDeletionObligations(
      capsuleWithRights('ALLOWED'),
      ['primary', 'backup'],
      ['primary'],
      SYNTHETIC_TIME,
    )
    expect(report.status).toBe('OBLIGATIONS_REMAIN')
    expect(report.pendingReplicaIds).toEqual(['backup'])
    expect(report.physicalDeletion).toBe('NOT_VERIFIED')
  })

  it('fails closed when the deletion right is unknown', () => {
    expect(() =>
      reconcileDeletionObligations(capsuleWithRights('UNKNOWN'), ['primary'], [], SYNTHETIC_TIME),
    ).toThrow(/DELETION_UNKNOWN/)
  })

  it('does not treat an empty target list as a completed deletion scope', () => {
    const report = reconcileDeletionObligations(
      capsuleWithRights('ALLOWED'),
      [],
      [],
      SYNTHETIC_TIME,
    )
    expect(report.status).toBe('NO_REPLICA_SCOPE_DECLARED')
    expect(report.physicalDeletion).toBe('NOT_VERIFIED')
  })
})
