import { describe, expect, it } from 'vitest'
import { createSourceCapture, verifySourceCaptureIntegrity } from './capture'
import { buildSyntheticRouteFixture, SYNTHETIC_TIME } from './fixtures/synthetic-routes'
import { canonicalizeJson } from './integrity'

describe('source capture and integrity', () => {
  it('preserves source, acquisition, observation, and Cora capture timestamps separately', () => {
    const { capture } = buildSyntheticRouteFixture('STANDARD_FILE_CONNECTOR')
    expect(capture.sourceObservedAt).toBe('2026-02-10T11:55:00.000Z')
    expect(capture.capturedAt).toBe(SYNTHETIC_TIME)
    expect(capture.currentlyVerifiedAt).toBeUndefined()
    expect(capture.freshness).toBe('NOT_VERIFIED')
    expect(verifySourceCaptureIntegrity(capture)).toBe(true)
  })

  it('rejects organization mismatch and detects capture tampering', () => {
    const { capture } = buildSyntheticRouteFixture('OPERATOR_IMPORT')
    const { integritySha256: _integritySha256, ...draft } = capture
    expect(() =>
      createSourceCapture({ ...draft, orgId: 'wrong-org' }, 'synthetic-org-001', SYNTHETIC_TIME),
    ).toThrow('Capture organization does not match trusted Cora organization')
    expect(
      verifySourceCaptureIntegrity({
        ...capture,
        orgId: 'wrong-org',
      }),
    ).toBe(false)
  })

  it('canonicalizes object key order deterministically while preserving array order', () => {
    expect(canonicalizeJson({ z: [2, 1], a: { y: true, x: null } })).toBe(
      '{"a":{"x":null,"y":true},"z":[2,1]}',
    )
  })
})
