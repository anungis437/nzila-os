import { describe, expect, it } from 'vitest'
import {
  identityResolutionSchema,
  rightsSnapshotSchema,
  sourceCaptureDraftSchema,
  type IdentityResolution,
} from './contracts'
import { buildSyntheticRouteFixture } from './fixtures/synthetic-routes'
import { validateIdentityResolution } from './identity-resolution'

describe('provider-neutral source continuity contracts', () => {
  it('keeps the source provider independent from acquisition channel and transport', () => {
    const { capture } = buildSyntheticRouteFixture('AGGREGATED_CONNECTOR')
    expect(capture.sourceRef.providerId).toBe('synthetic-certification-source')
    expect(capture.acquisitionRoute.channel).toBe('AGGREGATED_CONNECTOR')
    expect(capture.acquisitionRoute.transport).toBe('AGGREGATOR_API')
    expect(capture.acquisitionRoute.intermediaryId).toBe('synthetic-intermediary-001')
  })

  it('rejects credential-like fields in nested payloads', () => {
    const { capture } = buildSyntheticRouteFixture('OPERATOR_IMPORT')
    const { integritySha256: _integritySha256, ...draft } = capture
    expect(
      sourceCaptureDraftSchema.safeParse({
        ...draft,
        payload: { nested: { refreshToken: 'not-allowed' } },
      }).success,
    ).toBe(false)
  })

  it('requires unambiguous identity evidence before reporting MATCHED', () => {
    const matched = {
      resolutionId: 'resolution-001',
      orgId: 'synthetic-org-001',
      outcome: 'MATCHED',
      candidates: [
        {
          providerId: 'synthetic-source',
          objectType: 'OPERATOR',
          objectId: 'operator-1',
          authorityId: 'issuer-1',
        },
      ],
      canonicalIdentityId: 'cora-operator-1',
      bindingEvidenceRef: 'operator-confirmation-001',
      methodRef: 'synthetic-explicit-binding-v1',
      resolvedAt: '2026-02-10T12:00:00.000Z',
      limitations: ['Synthetic identity binding'],
    }
    expect(identityResolutionSchema.safeParse(matched).success).toBe(true)
    expect(
      identityResolutionSchema.safeParse({
        ...matched,
        candidates: [...matched.candidates, { ...matched.candidates[0], objectId: 'operator-2' }],
      }).success,
    ).toBe(false)

    const conflict = {
      ...matched,
      outcome: 'CONFLICT',
      candidates: [...matched.candidates, { ...matched.candidates[0], objectId: 'operator-2' }],
      canonicalIdentityId: undefined,
    }
    expect(identityResolutionSchema.safeParse(conflict).success).toBe(true)
    expect(
      identityResolutionSchema.safeParse({
        ...conflict,
        candidates: [conflict.candidates[0]],
      }).success,
    ).toBe(false)
  })

  it('gates identity resolution on rights and the trusted organization', () => {
    const fixture = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const resolution: IdentityResolution = {
      resolutionId: 'resolution-002',
      orgId: fixture.capture.orgId,
      outcome: 'UNMATCHED',
      candidates: [
        {
          providerId: fixture.capture.sourceRef.providerId,
          objectType: 'OPERATOR',
          objectId: 'synthetic-operator-001',
          authorityId: fixture.capture.sourceAuthority.authorityId,
        },
      ],
      methodRef: 'explicit-reference-only-v1',
      resolvedAt: fixture.capture.capturedAt,
      limitations: ['Candidate is not a confirmed canonical identity'],
    }

    expect(() =>
      validateIdentityResolution(
        resolution,
        { ...fixture.capture.rights, transientProcessing: 'UNKNOWN' },
        fixture.capture.orgId,
        fixture.capture.purpose,
        fixture.capture.recipientId,
        fixture.capture.capturedAt,
      ),
    ).toThrow(/TRANSIENTPROCESSING_UNKNOWN/)
    expect(() =>
      validateIdentityResolution(
        resolution,
        fixture.capture.rights,
        'other-org',
        fixture.capture.purpose,
        fixture.capture.recipientId,
        fixture.capture.capturedAt,
      ),
    ).toThrow(/trusted Cora organization/)
  })

  it('requires an explicit verification timestamp before capture freshness is CURRENT', () => {
    const { integritySha256: _digest, ...draft } = buildSyntheticRouteFixture(
      'NATIVE_STRATEGIC_CONNECTOR',
    ).capture
    expect(
      sourceCaptureDraftSchema.safeParse({
        ...draft,
        freshness: 'CURRENT',
      }).success,
    ).toBe(false)
    expect(
      sourceCaptureDraftSchema.safeParse({
        ...draft,
        freshness: 'CURRENT',
        currentlyVerifiedAt: draft.capturedAt,
      }).success,
    ).toBe(true)
  })

  it('requires a complete rights vector while preserving UNKNOWN as unknown', () => {
    const rights = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR').capture.rights
    const { sourceAccess: _sourceAccess, ...missingRight } = rights
    expect(rightsSnapshotSchema.safeParse(missingRight).success).toBe(false)
    expect(rightsSnapshotSchema.parse({ ...rights, sourceAccess: 'UNKNOWN' }).sourceAccess).toBe(
      'UNKNOWN',
    )
  })

  it('rejects malformed provenance and mapping-version references', () => {
    const { integritySha256: _digest, ...draft } = buildSyntheticRouteFixture(
      'NATIVE_STRATEGIC_CONNECTOR',
    ).capture
    expect(
      sourceCaptureDraftSchema.safeParse({
        ...draft,
        provenance: [{ relation: 'ASSERTED_BY' }],
      }).success,
    ).toBe(false)
    expect(
      sourceCaptureDraftSchema.safeParse({
        ...draft,
        mappingRefs: [{ mappingId: '', version: '1.0.0' }],
      }).success,
    ).toBe(false)
  })
})
