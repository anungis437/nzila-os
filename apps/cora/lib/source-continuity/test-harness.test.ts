import { describe, expect, it } from 'vitest'
import { ALL_SYNTHETIC_CHANNELS, buildSyntheticRouteFixture } from './fixtures/synthetic-routes'
import { evaluateSyntheticRouteConformance } from './test-harness'

describe('provider-neutral route conformance harness', () => {
  it('reports equivalent required meaning, route-specific loss, and the proof ceiling', () => {
    const fixtures = ALL_SYNTHETIC_CHANNELS.map(buildSyntheticRouteFixture)
    const report = evaluateSyntheticRouteConformance(
      fixtures,
      ['certification.status'],
      fixtures[0]!.capture.capturedAt,
    )

    expect(report.canonicalMeaningEquivalent).toBe(true)
    expect(report.routesAreSyntheticOnly).toBe(true)
    expect(report.providerIndependenceProven).toBe(false)
    expect(report.cases.find((route) => route.channel === 'AGGREGATED_CONNECTOR')?.losses).toEqual([
      {
        canonicalField: 'land.acreage',
        reasons: ['SOURCE_VALUE_UNAVAILABLE'],
      },
    ])
    expect(new Set(report.cases.map((route) => route.channel)).size).toBe(4)
  })

  it('does not claim required meaning equivalence when a route loses a required field', () => {
    const fixtures = ALL_SYNTHETIC_CHANNELS.map(buildSyntheticRouteFixture)
    const report = evaluateSyntheticRouteConformance(
      fixtures,
      ['land.acreage'],
      fixtures[0]!.capture.capturedAt,
    )
    expect(report.canonicalMeaningEquivalent).toBe(false)
  })

  it('requires distinct routes rather than multiple fixtures from one channel', () => {
    const native = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    expect(() =>
      evaluateSyntheticRouteConformance(
        [native, native],
        ['certification.status'],
        native.capture.capturedAt,
      ),
    ).toThrow('Route conformance requires distinct acquisition channels')
  })
})
