import type { AcquisitionChannel, SafeJsonValue } from './contracts'
import type { SyntheticRouteFixture } from './fixtures/synthetic-routes'
import { canonicalizeJson } from './integrity'
import { mapSourceCapture } from './semantic-mapping'

export interface RouteConformanceCase {
  channel: AcquisitionChannel
  sourceProviderId: string
  sourceAuthorityId: string
  intermediaryId?: string
  canonicalValues: Record<string, SafeJsonValue>
  losses: { canonicalField: string; reasons: string[] }[]
}

export interface RouteConformanceReport {
  cases: RouteConformanceCase[]
  requiredFields: string[]
  canonicalMeaningEquivalent: boolean
  routesAreSyntheticOnly: true
  providerIndependenceState: 'NOT_TESTED'
  providerIndependenceProven: false
  limitations: string[]
}

export function evaluateSyntheticRouteConformance(
  fixtures: SyntheticRouteFixture[],
  requiredFields: string[],
  evaluatedAt: string,
): RouteConformanceReport {
  if (fixtures.length < 2) {
    throw new Error('Route conformance requires at least two distinct routes')
  }

  const channels = fixtures.map((fixture) => fixture.channel)
  if (new Set(channels).size !== channels.length) {
    throw new Error('Route conformance requires distinct acquisition channels')
  }

  const cases = fixtures.map(({ capture, mapping }) => {
    const result = mapSourceCapture(capture, mapping, evaluatedAt)
    const canonicalValues: Record<string, SafeJsonValue> = {}
    const losses: RouteConformanceCase['losses'] = []

    for (const field of result.fields) {
      if (field.state === 'MAPPED' && field.canonicalValue !== undefined) {
        canonicalValues[field.canonicalField] = field.canonicalValue
      } else {
        losses.push({
          canonicalField: field.canonicalField,
          reasons: [...field.losses],
        })
      }
    }

    return {
      channel: result.acquisitionChannel,
      sourceProviderId: result.sourceProviderId,
      sourceAuthorityId: capture.sourceAuthority.authorityId,
      ...(capture.acquisitionRoute.intermediaryId
        ? { intermediaryId: capture.acquisitionRoute.intermediaryId }
        : {}),
      canonicalValues,
      losses,
    }
  })

  const canonicalMeaningEquivalent = requiredFields.every((field) => {
    const firstValue = cases[0]?.canonicalValues[field]
    return (
      firstValue !== undefined &&
      cases.every((route) => {
        const value = route.canonicalValues[field]
        return value !== undefined && canonicalizeJson(value) === canonicalizeJson(firstValue)
      })
    )
  })

  return {
    cases,
    requiredFields: [...requiredFields],
    canonicalMeaningEquivalent,
    routesAreSyntheticOnly: true,
    providerIndependenceState: 'NOT_TESTED',
    providerIndependenceProven: false,
    limitations: [
      'Synthetic routes do not establish provider or intermediary rights',
      'Shared source authority means this report is not proof of independent source provenance',
      'Canonical equivalence applies only to the explicitly required fields',
    ],
  }
}
