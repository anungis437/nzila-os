import { describe, expect, it } from 'vitest'
import { buildSyntheticAdaptRights } from './adapters/adapt/fixture'
import { buildSyntheticFieldViewRights } from './adapters/fieldview/fixture'
import {
  buildSyntheticMultiProviderRoutes,
  MULTI_PROVIDER_TIME,
} from './fixtures/multi-provider-routes'
import { evaluateSyntheticMultiProviderProof, serializeProofSummary } from './multi-provider-proof'

const requiredDimensions = [
  'identity',
  'relationship',
  'unit',
  'measurement',
  'operational',
] as const

function evaluate(overrides?: Parameters<typeof buildSyntheticMultiProviderRoutes>[0]) {
  return evaluateSyntheticMultiProviderProof({
    routes: buildSyntheticMultiProviderRoutes(overrides),
    requiredDimensions: [...requiredDimensions],
    evaluatedAt: MULTI_PROVIDER_TIME,
  })
}

describe('synthetic multi-provider proof', () => {
  it('proves the bounded multi-route slice without contaminating the canonical model', () => {
    const report = evaluate()

    expect(report.providerNeutrality.state).toBe(
      'PROVIDER_NEUTRALITY_SYNTHETICALLY_PROVEN_FOR_BOUNDED_SLICE',
    )
    expect(report.providerNeutrality.canonicalMeaningEquivalentAcrossAllRoutes).toBe(true)
    expect(report.providerNeutrality.canonicalModelContaminated).toBe(false)
    expect(report.routeSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routeId: 'deere-shaped',
          lossless: expect.any(Number),
        }),
        expect.objectContaining({
          routeId: 'fieldview-shaped',
          lossless: expect.any(Number),
        }),
        expect.objectContaining({
          routeId: 'adapt-standard-file',
          unresolved: expect.any(Number),
        }),
      ]),
    )
    expect(
      report.canonicalPressure.find(
        (assessment) =>
          assessment.routeId === 'fieldview-shaped' &&
          assessment.canonicalField === 'sourceExtensions.activity.lastModifiedTime',
      ),
    ).toMatchObject({
      classification: 'SOURCE_EXTENSION_ONLY',
    })
  })

  it('keeps route-specific limitations visible even when canonical meaning is equivalent', () => {
    const report = evaluate()
    const fieldViewToAdapt = report.pairwiseReports.find(
      (pair) =>
        pair.routes.includes('fieldview-shaped') && pair.routes.includes('adapt-standard-file'),
    )

    expect(
      fieldViewToAdapt?.dimensions.find((dimension) => dimension.dimension === 'spatial')?.status,
    ).toBe('PARTIAL')
    expect(
      fieldViewToAdapt?.dimensions.find((dimension) => dimension.dimension === 'temporal')?.status,
    ).toBe('PARTIAL')
    expect(report.providerNeutrality.canonicalMeaningEquivalentAcrossAllRoutes).toBe(true)
  })

  it('fails closed when one route loses protected rights', () => {
    const report = evaluate({
      fieldViewRights: buildSyntheticFieldViewRights({
        export: 'DENIED',
        rehydration: 'DENIED',
      }),
    })

    expect(report.providerNeutrality.state).toBe('PROVIDER_NEUTRALITY_SYNTHETICALLY_SUPPORTED')
    expect(
      report.rightsFailClosedResults.find((result) => result.routeId === 'fieldview-shaped'),
    ).toMatchObject({
      allProtectedActionsAllowed: false,
      blockedActions: expect.arrayContaining(['EXPORT', 'REHYDRATE']),
    })
    expect(report.limitations.join(' ')).toMatch(/rights do not transfer/i)
  })

  it('surfaces conflicting canonical claims as a provider-neutrality failure', () => {
    const [deere, fieldView, adapt] = buildSyntheticMultiProviderRoutes()
    const report = evaluateSyntheticMultiProviderProof({
      routes: [
        deere,
        fieldView,
        {
          ...adapt,
          claims: {
            ...adapt.claims,
            measurement: {
              state: 'PRESENT',
              value: 18,
              unit: 'kg/ha',
              evidenceRef: 'synthetic-adapt-conflicting-measurement',
              confidence: 0.7,
            },
          },
        },
      ],
      requiredDimensions: [...requiredDimensions],
      evaluatedAt: MULTI_PROVIDER_TIME,
    })

    expect(report.providerNeutrality.state).toBe('PROVIDER_NEUTRALITY_FAILED')
    expect(report.pairwiseReports.some((pair) => pair.conflicts.length > 0)).toBe(true)
  })

  it('serializes a compact proof summary without leaking route payloads', () => {
    const report = evaluate({
      adaptRights: buildSyntheticAdaptRights({
        transformation: 'ALLOWED',
      }),
    })
    const summary = serializeProofSummary(report)

    expect(summary).toMatchObject({
      providerNeutrality: expect.objectContaining({
        state: 'PROVIDER_NEUTRALITY_SYNTHETICALLY_PROVEN_FOR_BOUNDED_SLICE',
      }),
      routes: expect.arrayContaining([
        expect.objectContaining({ routeId: 'deere-shaped' }),
        expect.objectContaining({ routeId: 'fieldview-shaped' }),
        expect.objectContaining({ routeId: 'adapt-standard-file' }),
      ]),
    })
    expect(JSON.stringify(summary)).not.toMatch(/coordinates|guid|documentId/i)
  })
})
