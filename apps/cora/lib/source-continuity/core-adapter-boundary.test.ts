import { describe, expect, it } from 'vitest'
import { ALL_SYNTHETIC_CHANNELS, buildSyntheticRouteFixture } from './fixtures/synthetic-routes'
import { mapSourceCapture } from './semantic-mapping'

describe('provider-neutral kernel adapter boundary', () => {
  it('continues mapping native synthetic captures without an adapter dependency', () => {
    const native = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const result = mapSourceCapture(native.capture, native.mapping, native.capture.capturedAt)

    expect(result.acquisitionChannel).toBe('NATIVE_STRATEGIC_CONNECTOR')
    expect(result.fields[0]?.canonicalValue).toBe('CERTIFIED')
    expect(ALL_SYNTHETIC_CHANNELS).not.toContain('UNKNOWN')
  })
})
