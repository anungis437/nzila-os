import { z } from 'zod'
import { safeJsonValueSchema, type SourceCapture, type SafeJsonValue } from './contracts'
import type { SemanticMapping } from './contracts'
import { verifySourceCaptureIntegrity } from './capture'
import { verifySemanticMapping, type SemanticMappingResult } from './semantic-mapping'
import { evaluateRights, type RightsAction } from './rights'
import { canonicalizeJson } from './integrity'

export const FIDELITY_DIMENSIONS = [
  'identity',
  'provenance',
  'relationship',
  'spatial',
  'temporal',
  'unit',
  'measurement',
  'operational',
  'rights',
  'sourceAuthority',
] as const

export const fidelityStatusSchema = z.enum([
  'EQUIVALENT',
  'PARTIAL',
  'UNRESOLVED',
  'CONFLICT',
  'NOT_PRESENT',
])

export const fidelityClaimSchema = z
  .object({
    state: z.enum(['PRESENT', 'NOT_PRESENT', 'UNRESOLVED']),
    value: safeJsonValueSchema.optional(),
    unit: z.string().min(1).optional(),
    evidenceRef: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((claim, context) => {
    if (claim.state === 'PRESENT' && claim.value === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'PRESENT fidelity claims require an explicit value',
      })
    }
    if (claim.state !== 'PRESENT' && claim.value !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Only PRESENT fidelity claims may include a value',
      })
    }
  })

export type FidelityDimension = (typeof FIDELITY_DIMENSIONS)[number]
export type FidelityStatus = z.infer<typeof fidelityStatusSchema>
export type FidelityClaim = z.infer<typeof fidelityClaimSchema>

export interface SourceRouteEvidence {
  routeId: string
  capture: SourceCapture
  mapping: SemanticMapping
  mappingResult: SemanticMappingResult
  claims: Partial<Record<FidelityDimension, FidelityClaim>>
}

export interface FidelityDimensionResult {
  dimension: FidelityDimension
  status: FidelityStatus
  left: FidelityClaim
  right: FidelityClaim
  explanation: string
}

export interface RightsRouteResult {
  routeId: string
  captureId: string
  actionResults: Record<string, { allowed: boolean; reasons: string[] }>
}

export interface SourceConflict {
  dimension: FidelityDimension
  requiredResolutionAuthority: string
  claims: [
    {
      routeId: string
      captureId: string
      providerId: string
      acquisitionChannel: SourceCapture['acquisitionRoute']['channel']
      observedAt: string | null
      mappingId: string
      mappingVersion: string
      value: SafeJsonValue
      unit: string | null
      confidence: number
      evidenceRef: string
    },
    {
      routeId: string
      captureId: string
      providerId: string
      acquisitionChannel: SourceCapture['acquisitionRoute']['channel']
      observedAt: string | null
      mappingId: string
      mappingVersion: string
      value: SafeJsonValue
      unit: string | null
      confidence: number
      evidenceRef: string
    },
  ]
}

export interface SourceIndependenceReport {
  routes: [string, string]
  dimensions: FidelityDimensionResult[]
  rightsByRoute: RightsRouteResult[]
  conflicts: SourceConflict[]
  requiredDimensions: FidelityDimension[]
  state: 'NOT_TESTED' | 'PARTIAL' | 'PROVEN_FOR_BOUNDED_SYNTHETIC_SLICE' | 'FAILED'
  syntheticOnly: true
  canonicalMeaningEquivalent: boolean
  limitations: string[]
}

const proofActions: RightsAction[] = ['PERSIST', 'TRANSFORM', 'EXPORT', 'REHYDRATE']

function compareClaims(
  dimension: FidelityDimension,
  left: FidelityClaim | undefined,
  right: FidelityClaim | undefined,
): FidelityDimensionResult {
  const absent: FidelityClaim = {
    state: 'UNRESOLVED',
    evidenceRef: 'NO_EXPLICIT_EVIDENCE',
    confidence: 0,
  }
  const leftClaim = left ?? absent
  const rightClaim = right ?? absent

  if (leftClaim.state === 'NOT_PRESENT' && rightClaim.state === 'NOT_PRESENT') {
    return {
      dimension,
      status: 'NOT_PRESENT',
      left: leftClaim,
      right: rightClaim,
      explanation: 'Neither route asserts this dimension.',
    }
  }

  if (leftClaim.state === 'PRESENT' && rightClaim.state === 'PRESENT') {
    const sameValue =
      canonicalizeJson(leftClaim.value) === canonicalizeJson(rightClaim.value) &&
      leftClaim.unit === rightClaim.unit
    return {
      dimension,
      status: sameValue ? 'EQUIVALENT' : 'CONFLICT',
      left: leftClaim,
      right: rightClaim,
      explanation: sameValue
        ? 'Both routes provide equivalent canonical claims with matching units.'
        : 'Routes provide materially different canonical claims; neither route is preferred.',
    }
  }

  if (leftClaim.state === 'UNRESOLVED' && rightClaim.state === 'UNRESOLVED') {
    return {
      dimension,
      status: 'UNRESOLVED',
      left: leftClaim,
      right: rightClaim,
      explanation: 'Both routes lack sufficient evidence to resolve this dimension.',
    }
  }

  return {
    dimension,
    status: 'PARTIAL',
    left: leftClaim,
    right: rightClaim,
    explanation: 'Evidence is present on only one route or is unresolved on the other.',
  }
}

function assertRouteEvidence(route: SourceRouteEvidence): void {
  if (!verifySourceCaptureIntegrity(route.capture)) {
    throw new Error(`Route ${route.routeId} has invalid capture integrity`)
  }
  if (!verifySemanticMapping(route.mapping)) {
    throw new Error(`Route ${route.routeId} has invalid mapping integrity`)
  }
  if (
    route.mappingResult.captureId !== route.capture.captureId ||
    route.mappingResult.mappingId !== route.mapping.mappingId ||
    route.mappingResult.mappingVersion !== route.mapping.version ||
    route.mappingResult.sourceProviderId !== route.capture.sourceRef.providerId ||
    route.mappingResult.acquisitionChannel !== route.capture.acquisitionRoute.channel
  ) {
    throw new Error(`Route ${route.routeId} mapping evidence does not match capture provenance`)
  }
  for (const claim of Object.values(route.claims)) {
    if (claim) fidelityClaimSchema.parse(claim)
  }
}

function buildRightsResult(route: SourceRouteEvidence, evaluatedAt: string): RightsRouteResult {
  const actionResults = Object.fromEntries(
    proofActions.map((action) => [
      action,
      evaluateRights(route.capture.rights, action, {
        purpose: route.capture.purpose,
        recipientId: route.capture.recipientId,
        at: evaluatedAt,
      }),
    ]),
  )
  return {
    routeId: route.routeId,
    captureId: route.capture.captureId,
    actionResults,
  }
}

function metadataClaim(value: SafeJsonValue, evidenceRef: string): FidelityClaim {
  return { state: 'PRESENT', value, evidenceRef, confidence: 1 }
}

function compareMetadataDimensions(
  left: SourceRouteEvidence,
  right: SourceRouteEvidence,
  leftRights: RightsRouteResult,
  rightRights: RightsRouteResult,
): FidelityDimensionResult[] {
  const routeAttribution = (route: SourceRouteEvidence): SafeJsonValue => ({
    providerId: route.capture.sourceRef.providerId,
    authorityId: route.capture.sourceAuthority.authorityId,
    channel: route.capture.acquisitionRoute.channel,
    transport: route.capture.acquisitionRoute.transport,
    mappingId: route.mapping.mappingId,
    mappingVersion: route.mapping.version,
  })
  const rightsValue = (route: RightsRouteResult): SafeJsonValue =>
    Object.fromEntries(
      Object.entries(route.actionResults).map(([action, decision]) => [action, decision.allowed]),
    )
  const sourceAuthorityClaim = (route: SourceRouteEvidence): FidelityClaim => {
    const complete =
      route.capture.sourceRef.providerId !== 'UNKNOWN' &&
      route.capture.sourceAuthority.authorityId !== 'UNKNOWN'
    return complete
      ? metadataClaim(
          `${route.capture.sourceRef.providerId}:${route.capture.sourceAuthority.authorityId}`,
          `${route.routeId}:source-attribution`,
        )
      : {
          state: 'UNRESOLVED',
          evidenceRef: `${route.routeId}:unknown-source-attribution`,
          confidence: 0,
        }
  }
  const leftAttribution = metadataClaim(routeAttribution(left), `${left.routeId}:provenance`)
  const rightAttribution = metadataClaim(routeAttribution(right), `${right.routeId}:provenance`)
  const provenanceIntact = [left, right].every(
    (route) =>
      route.capture.provenance.length > 0 &&
      route.capture.provenance.some(
        (edge) =>
          edge.sourceProviderId === route.capture.sourceRef.providerId &&
          edge.acquisitionChannel === route.capture.acquisitionRoute.channel,
      ),
  )
  const provenance = compareClaims('provenance', leftAttribution, rightAttribution)
  const rightsComplete = [
    ...Object.values(leftRights.actionResults),
    ...Object.values(rightRights.actionResults),
  ].every((decision) => decision.allowed)
  const rights = compareClaims(
    'rights',
    metadataClaim(rightsValue(leftRights), `${left.routeId}:rights-snapshot`),
    metadataClaim(rightsValue(rightRights), `${right.routeId}:rights-snapshot`),
  )
  const leftAuthority = sourceAuthorityClaim(left)
  const rightAuthority = sourceAuthorityClaim(right)
  const authorityComplete = leftAuthority.state === 'PRESENT' && rightAuthority.state === 'PRESENT'
  const authority: FidelityDimensionResult = {
    dimension: 'sourceAuthority',
    status: authorityComplete ? 'EQUIVALENT' : 'PARTIAL',
    left: leftAuthority,
    right: rightAuthority,
    explanation: authorityComplete
      ? 'Each route retains its own explicit source-provider and source-authority attribution.'
      : 'At least one route has unknown source-provider or source-authority attribution.',
  }

  return [
    {
      ...provenance,
      status: provenanceIntact ? 'EQUIVALENT' : 'PARTIAL',
      explanation: provenanceIntact
        ? 'Each route preserves its own provider, authority, acquisition, and mapping provenance.'
        : 'At least one route lacks complete source-to-route provenance.',
    },
    {
      ...rights,
      status: rightsComplete ? 'EQUIVALENT' : 'PARTIAL',
      explanation: rightsComplete
        ? 'Each route independently permits all protected proof actions.'
        : 'Rights are evaluated per capture; a denied or unknown action on either route remains blocked.',
    },
    authority,
  ]
}

function buildSourceConflict(
  dimension: FidelityDimensionResult,
  leftRoute: SourceRouteEvidence,
  rightRoute: SourceRouteEvidence,
): SourceConflict {
  const toClaim = (
    route: SourceRouteEvidence,
    claim: FidelityClaim,
  ): SourceConflict['claims'][number] => {
    if (claim.state !== 'PRESENT' || claim.value === undefined) {
      throw new Error('Conflicts can only be created from two explicit present claims')
    }
    return {
      routeId: route.routeId,
      captureId: route.capture.captureId,
      providerId: route.capture.sourceRef.providerId,
      acquisitionChannel: route.capture.acquisitionRoute.channel,
      observedAt: route.capture.sourceObservedAt ?? null,
      mappingId: route.mapping.mappingId,
      mappingVersion: route.mapping.version,
      value: claim.value,
      unit: claim.unit ?? null,
      confidence: claim.confidence,
      evidenceRef: claim.evidenceRef,
    }
  }

  return {
    dimension: dimension.dimension,
    requiredResolutionAuthority: 'SOURCE_AUTHORITY_OR_OPERATOR_WITH_DOCUMENTED_BINDING',
    claims: [toClaim(leftRoute, dimension.left), toClaim(rightRoute, dimension.right)],
  }
}

export function evaluateSourceIndependence(input: {
  left: SourceRouteEvidence
  right: SourceRouteEvidence
  requiredDimensions: FidelityDimension[]
  evaluatedAt: string
}): SourceIndependenceReport {
  const { left, right, requiredDimensions, evaluatedAt } = input
  if (left.routeId === right.routeId) {
    throw new Error('Source independence requires distinct acquisition routes')
  }
  assertRouteEvidence(left)
  assertRouteEvidence(right)

  const rightsByRoute = [
    buildRightsResult(left, evaluatedAt),
    buildRightsResult(right, evaluatedAt),
  ]
  const metadataDimensions = compareMetadataDimensions(
    left,
    right,
    rightsByRoute[0]!,
    rightsByRoute[1]!,
  )
  const dimensions = FIDELITY_DIMENSIONS.map((dimension) =>
    ['provenance', 'rights', 'sourceAuthority'].includes(dimension)
      ? metadataDimensions.find((result) => result.dimension === dimension)!
      : compareClaims(dimension, left.claims[dimension], right.claims[dimension]),
  )
  const provenanceComplete = [left, right].every(
    ({ capture, mapping, mappingResult }) =>
      capture.provenance.some(
        (edge) =>
          edge.sourceProviderId === capture.sourceRef.providerId &&
          edge.acquisitionChannel === capture.acquisitionRoute.channel,
      ) &&
      mappingResult.sourceProviderId === capture.sourceRef.providerId &&
      mapping.sourceProviderId === capture.sourceRef.providerId,
  )
  const attributionComplete = [left, right].every(
    ({ capture }) =>
      capture.sourceRef.providerId !== 'UNKNOWN' &&
      capture.sourceAuthority.authorityId !== 'UNKNOWN',
  )
  const rightsComplete = rightsByRoute.every((route) =>
    Object.values(route.actionResults).every((result) => result.allowed),
  )
  const requiredResults = dimensions.filter((result) =>
    requiredDimensions.includes(result.dimension),
  )
  const canonicalMeaningEquivalent =
    requiredResults.length === requiredDimensions.length &&
    requiredResults.every((result) => result.status === 'EQUIVALENT')
  const conflicts = dimensions
    .filter((result) => result.status === 'CONFLICT')
    .map((result) => buildSourceConflict(result, left, right))
  const state =
    conflicts.length > 0
      ? 'FAILED'
      : canonicalMeaningEquivalent && provenanceComplete && rightsComplete
        ? 'PROVEN_FOR_BOUNDED_SYNTHETIC_SLICE'
        : 'PARTIAL'

  return {
    routes: [left.routeId, right.routeId],
    dimensions,
    rightsByRoute,
    conflicts,
    requiredDimensions: [...requiredDimensions],
    state,
    syntheticOnly: true,
    canonicalMeaningEquivalent,
    limitations: [
      'Synthetic route fixtures do not establish lawful provider rights or live-provider independence',
      'A bounded proof applies only to the explicitly required dimensions',
      ...(!attributionComplete
        ? [
            'At least one route has unknown provider or source authority; attribution confidence is constrained',
          ]
        : []),
      ...(!rightsComplete
        ? [
            'At least one protected action is denied or unresolved for a source capture; rights do not transfer across routes',
          ]
        : []),
      ...(!provenanceComplete
        ? ['Route-specific provider, mapping, or acquisition provenance is incomplete']
        : []),
      ...(conflicts.length > 0
        ? ['Conflicting claims require source authority or documented operator resolution']
        : []),
    ],
  }
}
