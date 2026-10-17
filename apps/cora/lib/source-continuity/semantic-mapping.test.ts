import { describe, expect, it } from 'vitest'
import { createSourceCapture } from './capture'
import { buildSyntheticRouteFixture, ALL_SYNTHETIC_CHANNELS } from './fixtures/synthetic-routes'
import { mapSourceCapture } from './semantic-mapping'

describe('provider-neutral semantic mappings', () => {
  it('preserves canonical status across all four acquisition routes', () => {
    const results = ALL_SYNTHETIC_CHANNELS.map((channel) => {
      const fixture = buildSyntheticRouteFixture(channel)
      return mapSourceCapture(fixture.capture, fixture.mapping, fixture.capture.capturedAt)
    })

    expect(results.map((result) => result.fields[0]?.canonicalValue)).toEqual([
      'CERTIFIED',
      'CERTIFIED',
      'CERTIFIED',
      'CERTIFIED',
    ])
    expect(results.map((result) => result.acquisitionChannel)).toEqual(ALL_SYNTHETIC_CHANNELS)
    expect(
      results.every((result) => result.sourceProviderId === 'synthetic-certification-source'),
    ).toBe(true)
  })

  it('makes route-specific semantic loss explicit instead of inferring missing acreage', () => {
    const fixture = buildSyntheticRouteFixture('AGGREGATED_CONNECTOR')
    const result = mapSourceCapture(fixture.capture, fixture.mapping, fixture.capture.capturedAt)

    expect(result.fields[1]).toMatchObject({
      canonicalField: 'land.acreage',
      state: 'UNMAPPED',
      losses: ['SOURCE_VALUE_UNAVAILABLE'],
    })
  })

  it('does not apply an unlisted enum value', () => {
    const fixture = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const { integritySha256: _integrity, ...captureDraft } = fixture.capture
    const changed = createSourceCapture(
      {
        ...captureDraft,
        payload: { status: 'suspended' },
      },
      fixture.capture.orgId,
      fixture.capture.capturedAt,
    )
    const result = mapSourceCapture(changed, fixture.mapping, fixture.capture.capturedAt)
    expect(result.fields[0]).toMatchObject({
      state: 'UNMAPPED',
      losses: ['ENUM_VALUE_NOT_MAPPED'],
    })
  })
})
