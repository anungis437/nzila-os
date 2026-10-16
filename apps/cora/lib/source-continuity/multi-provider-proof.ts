import { evaluateContinuityFidelity, type ContinuityFidelityResult } from './continuity-fidelity'
import type { ContinuityCapsule } from './capsule'
import {
  evaluateSourceIndependence,
  type FidelityDimension,
  type SourceRouteEvidence,
  type SourceIndependenceReport,
} from './source-independence'
import type { SafeJsonValue } from './contracts'
import { createSyntheticMultiProviderCapsule } from './fixtures/multi-provider-routes'

export const CANONICAL_PRESSURE_STATES = [
  'ALREADY_SUPPORTED_CANONICALLY',
  'SOURCE_EXTENSION_ONLY',
  'DOMAIN_JUSTIFIED_CANONICAL_EXTENSION',
  'PROVIDER_SPECIFIC_AND_REJECTED',
  'UNRESOLVED',
] as const

export const PROVIDER_NEUTRALITY_STATES = [
  'PROVIDER_NEUTRALITY_NOT_PROVEN',
  'PROVIDER_NEUTRALITY_SYNTHETICALLY_SUPPORTED',
  'PROVIDER_NEUTRALITY_SYNTHETICALLY_PROVEN_FOR_BOUNDED_SLICE',
  'PROVIDER_NEUTRALITY_FAILED',
] as const

export type CanonicalPressureState = (typeof CANONICAL_PRESSURE_STATES)[number]
export type ProviderNeutralityState = (typeof PROVIDER_NEUTRALITY_STATES)[number]

export interface CanonicalPressureAssessment {
  routeId: string
  sourcePath: string
  canonicalField: string
  classification: CanonicalPressureState
  reason: string
}

export interface RouteSemanticSummary {
  routeId: string
  providerId: string
  acquisitionChannel: SourceRouteEvidence['capture']['acquisitionRoute']['channel']
  lossless: number
  lossy: number
  unresolved: number
  sourceAuthorityKnown: boolean
  sourceExtensions: string[]
}

export interface MultiProviderProofReport {
  routes: string[]
  evaluatedAt: string
  pairwiseReports: SourceIndependenceReport[]
  requiredDimensions: FidelityDimension[]
  canonicalPressure: CanonicalPressureAssessment[]
  routeSummaries: RouteSemanticSummary[]
  continuityFidelityByRoute: Record<string, ContinuityFidelityResult>
  rightsFailClosedResults: {
    routeId: string
    allProtectedActionsAllowed: boolean
    blockedActions: string[]
  }[]
  providerNeutrality: {
    state: ProviderNeutralityState
    canonicalModelContaminated: boolean
    canonicalMeaningEquivalentAcrossAllRoutes: boolean
    routeSpecificProvenanceRetained: boolean
    explanation: string
  }
  capsule: ContinuityCapsule
  limitations: string[]
}

function routeSummary(route: SourceRouteEvidence): RouteSemanticSummary {
  const lossless = route.mappingResult.fields.filter(
    (field) => field.state === 'MAPPED' && field.losses.length === 0,
  ).length
  const lossy = route.mappingResult.fields.filter(
    (field) => (field.state === 'MAPPED' && field.losses.length > 0) || field.state === 'UNMAPPED',
  ).length
  const unresolved = route.mappingResult.fields.filter((field) => field.state === 'MISSING').length
  const sourceExtensions = route.mappingResult.evidence
    .filter((evidence) => evidence.kind !== 'IDENTITY_INTERPRETATION')
    .map((evidence) => evidence.evidenceRef)

  return {
    routeId: route.routeId,
    providerId: route.capture.sourceRef.providerId,
    acquisitionChannel: route.capture.acquisitionRoute.channel,
    lossless,
    lossy,
    unresolved,
    sourceAuthorityKnown:
      route.capture.sourceRef.providerId !== 'UNKNOWN' &&
      route.capture.sourceAuthority.authorityId !== 'UNKNOWN',
    sourceExtensions,
  }
}

function continuityFidelityForRoute(route: SourceRouteEvidence): ContinuityFidelityResult {
  const effectiveAtField = route.mappingResult.fields.find(
    (field) => field.canonicalField === 'agriculture.operation.effectiveAt',
  )

  return evaluateContinuityFidelity([
    {
      dimension: 'semanticCompleteness',
      state: route.mappingResult.fields.some((field) => field.state === 'UNMAPPED')
        ? 'PARTIAL'
        : 'ESTABLISHED',
      evidenceRefs: [`${route.routeId}:semantic-fields`],
      reasons: route.mappingResult.fields
        .filter((field) => field.state === 'UNMAPPED')
        .map((field) => `${field.canonicalField} remained unmapped`),
    },
    {
      dimension: 'provenanceCompleteness',
      state: route.capture.provenance.length > 0 ? 'ESTABLISHED' : 'UNRESOLVED',
      evidenceRefs: route.capture.provenance.length > 0 ? [`${route.routeId}:provenance`] : [],
      reasons: route.capture.provenance.length > 0 ? [] : ['Route has no provenance edges'],
    },
    {
      dimension: 'identityCompleteness',
      state: route.claims.identity?.state === 'PRESENT' ? 'ESTABLISHED' : 'UNRESOLVED',
      evidenceRefs:
        route.claims.identity?.state === 'PRESENT' ? [route.claims.identity.evidenceRef] : [],
      reasons:
        route.claims.identity?.state === 'PRESENT'
          ? []
          : ['Route does not establish bounded field identity'],
    },
    {
      dimension: 'relationshipCompleteness',
      state: route.claims.relationship?.state === 'PRESENT' ? 'ESTABLISHED' : 'UNRESOLVED',
      evidenceRefs:
        route.claims.relationship?.state === 'PRESENT'
          ? [route.claims.relationship.evidenceRef]
          : [],
      reasons:
        route.claims.relationship?.state === 'PRESENT'
          ? []
          : ['Route does not establish bounded farm-field relationship'],
    },
    {
      dimension: 'temporalCompleteness',
      state: effectiveAtField?.state === 'MAPPED' ? 'ESTABLISHED' : 'PARTIAL',
      evidenceRefs: effectiveAtField ? [`${route.routeId}:effective-time`] : [],
      reasons:
        effectiveAtField?.state === 'MAPPED'
          ? []
          : ['Temporal role remains partial or unresolved on this route'],
    },
    {
      dimension: 'permissionCompleteness',
      state: route.capture.rights.persistence === 'ALLOWED' ? 'ESTABLISHED' : 'PARTIAL',
      evidenceRefs: [`${route.routeId}:rights`],
      reasons:
        route.capture.rights.persistence === 'ALLOWED'
          ? []
          : ['Persistence right is not fully allowed on this route'],
    },
    {
      dimension: 'sourceFreshnessCompleteness',
      state: route.capture.freshness === 'NOT_VERIFIED' ? 'PARTIAL' : 'ESTABLISHED',
      evidenceRefs: [`${route.routeId}:freshness:${route.capture.freshness}`],
      reasons:
        route.capture.freshness === 'NOT_VERIFIED'
          ? ['Synthetic route does not prove source currentness']
          : [],
    },
    {
      dimension: 'rehydrationCompleteness',
      state: route.capture.rights.rehydration === 'ALLOWED' ? 'ESTABLISHED' : 'PARTIAL',
      evidenceRefs: [`${route.routeId}:rehydration-right`],
      reasons:
        route.capture.rights.rehydration === 'ALLOWED'
          ? []
          : ['Route cannot be rehydrated under the supplied rights vector'],
    },
  ])
}

function canonicalPressureForRoute(route: SourceRouteEvidence): CanonicalPressureAssessment[] {
  const assessments: CanonicalPressureAssessment[] = route.mappingResult.fields.map((field) => ({
    routeId: route.routeId,
    sourcePath: field.sourcePath,
    canonicalField: field.canonicalField,
    classification:
      field.canonicalField === 'land.boundary.geometry' &&
      route.routeId === 'adapt-standard-file' &&
      field.state !== 'MAPPED'
        ? 'UNRESOLVED'
        : field.canonicalField === 'agriculture.operation.observedAt' &&
            route.routeId === 'adapt-standard-file'
          ? 'UNRESOLVED'
          : field.canonicalField === 'land.field.area' ||
              field.canonicalField.startsWith('agriculture.operation.') ||
              field.canonicalField.startsWith('land.field.') ||
              field.canonicalField.startsWith('land.boundary.')
            ? 'ALREADY_SUPPORTED_CANONICALLY'
            : 'PROVIDER_SPECIFIC_AND_REJECTED',
    reason:
      field.canonicalField === 'land.boundary.geometry' &&
      route.routeId === 'adapt-standard-file' &&
      field.state !== 'MAPPED'
        ? 'ADAPT geometry is preserved on the source route but not normalized into canonical spatial proof.'
        : field.canonicalField === 'agriculture.operation.observedAt' &&
            route.routeId === 'adapt-standard-file'
          ? 'ADAPT time semantics do not prove whether the timestamp is observed, effective, or modified time.'
          : 'Canonical field already exists in the provider-neutral kernel and does not require a provider-specific extension.',
  }))

  if (route.routeId === 'fieldview-shaped') {
    assessments.push({
      routeId: route.routeId,
      sourcePath: 'activity.lastModifiedTime',
      canonicalField: 'sourceExtensions.activity.lastModifiedTime',
      classification: 'SOURCE_EXTENSION_ONLY',
      reason:
        'FieldView lastModifiedTime is preserved as route-scoped evidence and intentionally kept outside canonical truth claims.',
    })
  }

  return assessments
}

function uniqueLimitations(values: string[]): string[] {
  return [...new Set(values)]
}

export function evaluateSyntheticMultiProviderProof(input: {
  routes: [SourceRouteEvidence, SourceRouteEvidence, SourceRouteEvidence]
  requiredDimensions: FidelityDimension[]
  evaluatedAt: string
}): MultiProviderProofReport {
  const { routes, requiredDimensions, evaluatedAt } = input
  const [deere, fieldView, adapt] = routes
  const pairwiseReports = [
    evaluateSourceIndependence({ left: deere, right: fieldView, requiredDimensions, evaluatedAt }),
    evaluateSourceIndependence({ left: deere, right: adapt, requiredDimensions, evaluatedAt }),
    evaluateSourceIndependence({ left: fieldView, right: adapt, requiredDimensions, evaluatedAt }),
  ]
  const routeSummaries = routes.map(routeSummary)
  const continuityFidelityByRoute = Object.fromEntries(
    routes.map((route) => [route.routeId, continuityFidelityForRoute(route)]),
  ) as Record<string, ContinuityFidelityResult>
  const canonicalPressure = routes.flatMap(canonicalPressureForRoute)
  const rightsFailClosedResults = pairwiseReports
    .flatMap((report) =>
      report.rightsByRoute.map((routeResult) => ({
        routeId: routeResult.routeId,
        allProtectedActionsAllowed: Object.values(routeResult.actionResults).every(
          (decision) => decision.allowed,
        ),
        blockedActions: Object.entries(routeResult.actionResults)
          .filter(([, decision]) => !decision.allowed)
          .map(([action]) => action),
      })),
    )
    .filter(
      (value, index, list) =>
        list.findIndex((candidate) => candidate.routeId === value.routeId) === index,
    )

  const canonicalMeaningEquivalentAcrossAllRoutes = pairwiseReports.every(
    (report) => report.canonicalMeaningEquivalent,
  )
  const routeSpecificProvenanceRetained = routes.every((route) =>
    route.capture.provenance.some(
      (edge) =>
        edge.sourceProviderId === route.capture.sourceRef.providerId &&
        edge.acquisitionChannel === route.capture.acquisitionRoute.channel,
    ),
  )
  const canonicalModelContaminated = canonicalPressure.some(
    (assessment) => assessment.classification === 'DOMAIN_JUSTIFIED_CANONICAL_EXTENSION',
  )
  const hasConflict = pairwiseReports.some((report) => report.conflicts.length > 0)
  const anyBlockedRights = rightsFailClosedResults.some(
    (result) => !result.allProtectedActionsAllowed,
  )

  const providerNeutralityState: ProviderNeutralityState = hasConflict
    ? 'PROVIDER_NEUTRALITY_FAILED'
    : canonicalMeaningEquivalentAcrossAllRoutes &&
        routeSpecificProvenanceRetained &&
        !canonicalModelContaminated &&
        !anyBlockedRights
      ? 'PROVIDER_NEUTRALITY_SYNTHETICALLY_PROVEN_FOR_BOUNDED_SLICE'
      : canonicalMeaningEquivalentAcrossAllRoutes
        ? 'PROVIDER_NEUTRALITY_SYNTHETICALLY_SUPPORTED'
        : 'PROVIDER_NEUTRALITY_NOT_PROVEN'

  return {
    routes: routes.map((route) => route.routeId),
    evaluatedAt,
    pairwiseReports,
    requiredDimensions,
    canonicalPressure,
    routeSummaries,
    continuityFidelityByRoute,
    rightsFailClosedResults,
    providerNeutrality: {
      state: providerNeutralityState,
      canonicalModelContaminated,
      canonicalMeaningEquivalentAcrossAllRoutes,
      routeSpecificProvenanceRetained,
      explanation:
        providerNeutralityState === 'PROVIDER_NEUTRALITY_SYNTHETICALLY_PROVEN_FOR_BOUNDED_SLICE'
          ? 'All three synthetic routes converge on the bounded canonical slice while preserving route-specific provenance and rights.'
          : providerNeutralityState === 'PROVIDER_NEUTRALITY_SYNTHETICALLY_SUPPORTED'
            ? 'Canonical equivalence is supported, but at least one non-conflict limitation remains (for example route-specific rights or unresolved source attribution).'
            : providerNeutralityState === 'PROVIDER_NEUTRALITY_FAILED'
              ? 'At least one pairwise route comparison contains a direct canonical conflict that requires external resolution.'
              : 'Pairwise canonical equivalence is not established across the bounded slice.',
    },
    capsule: createSyntheticMultiProviderCapsule(routes),
    limitations: uniqueLimitations([
      'Synthetic-only bounded proof; no live provider rights or runtime currentness is established.',
      ...pairwiseReports.flatMap((report) => report.limitations),
      ...Object.values(continuityFidelityByRoute).flatMap((result) => result.limitations),
      ...(!routeSpecificProvenanceRetained
        ? ['At least one route lacks complete route-specific provenance evidence.']
        : []),
      ...(canonicalModelContaminated
        ? ['Canonical model required a domain extension; provider neutrality must be re-reviewed.']
        : []),
    ]),
  }
}

export function serializeProofSummary(report: MultiProviderProofReport): SafeJsonValue {
  return {
    providerNeutrality: report.providerNeutrality,
    routes: report.routeSummaries.map((summary) => ({
      routeId: summary.routeId,
      providerId: summary.providerId,
      acquisitionChannel: summary.acquisitionChannel,
      lossless: summary.lossless,
      lossy: summary.lossy,
      unresolved: summary.unresolved,
    })),
    pairwiseStates: report.pairwiseReports.map((pair) => ({
      routes: pair.routes,
      state: pair.state,
      canonicalMeaningEquivalent: pair.canonicalMeaningEquivalent,
      conflicts: pair.conflicts.length,
    })),
  }
}
