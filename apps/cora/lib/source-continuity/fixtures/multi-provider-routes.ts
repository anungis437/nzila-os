import type { RightsSnapshot, SafeJsonValue, SemanticMapping } from '../contracts'
import { createSourceCapture } from '../capture'
import { assembleContinuityCapsule, type ContinuityCapsule } from '../capsule'
import { computeSemanticMappingDigest, mapSourceCapture } from '../semantic-mapping'
import type { SourceRouteEvidence } from '../source-independence'
import {
  ADAPT_SYNTHETIC_ORG_ID,
  ADAPT_SYNTHETIC_TIME,
  buildSyntheticAdaptRights,
  SYNTHETIC_ADAPT_DOCUMENT,
} from '../adapters/adapt/fixture'
import { ingestSyntheticAdaptDocument } from '../adapters/adapt/ingest'
import { HECTARES_TO_ACRES } from '../adapters/adapt/mapping'
import {
  buildSyntheticFieldViewRights,
  SYNTHETIC_FIELDVIEW_DOCUMENT,
} from '../adapters/fieldview/fixture'
import { ingestSyntheticFieldViewDocument } from '../adapters/fieldview/ingest'

export const MULTI_PROVIDER_SCENARIO_ID = 'synthetic-multi-provider-001'
export const MULTI_PROVIDER_FIELD_ANCHOR = `${MULTI_PROVIDER_SCENARIO_ID}:field-001`
export const MULTI_PROVIDER_FARM_ANCHOR = `${MULTI_PROVIDER_SCENARIO_ID}:farm-001`
export const MULTI_PROVIDER_TIME = ADAPT_SYNTHETIC_TIME
export const MULTI_PROVIDER_PROOF_PURPOSE = 'synthetic-multi-provider-proof'
export const MULTI_PROVIDER_PROOF_RECIPIENT_ID = 'synthetic-multi-provider-proof-reader'

const operationEffectiveAt = '2026-04-15T10:30:00.000Z'
const operationObservedAt = '2026-04-15T10:31:00.000Z'
const normalizedGeometry: SafeJsonValue = {
  type: 'Polygon',
  crs: 'EPSG:4326',
  coordinates: [
    [
      [-93.0, 45.0],
      [-92.99, 45.0],
      [-92.99, 45.01],
      [-93.0, 45.01],
      [-93.0, 45.0],
    ],
  ],
}

function extendRightsForMultiProviderProof(rights: RightsSnapshot): RightsSnapshot {
  return {
    ...rights,
    permittedPurposes: [...new Set([...rights.permittedPurposes, MULTI_PROVIDER_PROOF_PURPOSE])],
    permittedRecipients: [
      ...new Set([...rights.permittedRecipients, MULTI_PROVIDER_PROOF_RECIPIENT_ID]),
    ],
  }
}

function buildDeereShapedRoute(
  rights: RightsSnapshot,
  mappingVersion = '1.0.0',
): SourceRouteEvidence {
  const proofRights = extendRightsForMultiProviderProof(rights)
  const providerId = 'synthetic-deere-reference-provider'
  const fields: SemanticMapping['fields'] = [
    ['clientId', 'land.client.sourceLocalReferenceId'],
    ['farmId', 'land.farm.sourceLocalReferenceId'],
    ['fieldId', 'land.field.sourceLocalReferenceId'],
    ['farmAnchor', 'land.field.farmSourceLocalReferenceId'],
    ['fieldAnchor', 'land.boundary.fieldSourceLocalReferenceId'],
    ['areaAcres', 'land.field.area'],
    ['operationType', 'agriculture.operation.type'],
    ['measurement', 'agriculture.operation.measurement.value'],
    ['measurementUnit', 'agriculture.operation.measurement.unit'],
    ['effectiveAt', 'agriculture.operation.effectiveAt'],
    ['observedAt', 'agriculture.operation.observedAt'],
    ['geometry', 'land.boundary.geometry'],
  ].map(([sourcePath, canonicalField]) => ({
    sourcePath: sourcePath!,
    canonicalField: canonicalField!,
    operation: 'IDENTITY',
    ...(canonicalField === 'land.field.area'
      ? { sourceUnit: 'acre', canonicalUnit: 'acre' }
      : canonicalField === 'agriculture.operation.measurement.value'
        ? { sourceUnit: 'kg/ha', canonicalUnit: 'kg/ha' }
        : {}),
    required: canonicalField !== 'land.client.sourceLocalReferenceId',
    declaredLosses: [],
  }))

  const mappingDefinition: Omit<SemanticMapping, 'definitionSha256'> = {
    mappingId: 'synthetic-deere-shaped-mapping',
    version: mappingVersion,
    authorityId: 'synthetic-cora-mapping-authority',
    sourceProviderId: providerId,
    sourceSchemaVersion: 'synthetic-deere-v1',
    fields,
    limitations: ['Synthetic Deere-shaped route only'],
  }
  const mapping: SemanticMapping = {
    ...mappingDefinition,
    definitionSha256: computeSemanticMappingDigest(mappingDefinition),
  }
  const capture = createSourceCapture(
    {
      captureId: 'synthetic-deere-shaped-capture',
      orgId: ADAPT_SYNTHETIC_ORG_ID,
      operatorId: 'synthetic-multi-provider-operator',
      sourceRef: {
        providerId,
        objectType: 'AGRICULTURAL_SOURCE_BUNDLE',
        objectId: 'deere-record-001',
        sourceVersion: 'synthetic-deere-v1',
      },
      sourceAuthority: {
        authorityId: 'synthetic-deere-source-authority',
        authorityType: 'SOURCE_PROVIDER',
      },
      acquisitionRoute: {
        channel: 'NATIVE_STRATEGIC_CONNECTOR',
        transport: 'API',
        acquisitionProviderId: 'synthetic-deere-adapter',
      },
      sourceSchemaVersion: 'synthetic-deere-v1',
      sourceObservedAt: operationObservedAt,
      capturedAt: MULTI_PROVIDER_TIME,
      freshness: 'NOT_VERIFIED',
      purpose: MULTI_PROVIDER_PROOF_PURPOSE,
      recipientId: MULTI_PROVIDER_PROOF_RECIPIENT_ID,
      rights: proofRights,
      payload: {
        clientId: 'deere-client-001',
        farmId: 'deere-farm-11',
        fieldId: 'deere-field-21',
        farmAnchor: MULTI_PROVIDER_FARM_ANCHOR,
        fieldAnchor: MULTI_PROVIDER_FIELD_ANCHOR,
        areaAcres: 100 * HECTARES_TO_ACRES,
        operationType: 'SEEDING',
        measurement: 12,
        measurementUnit: 'kg/ha',
        effectiveAt: operationEffectiveAt,
        observedAt: operationObservedAt,
        geometry: normalizedGeometry,
      },
      mappingRefs: [{ mappingId: mapping.mappingId, version: mapping.version }],
      provenance: [
        {
          edgeId: 'synthetic-deere-shaped-provenance',
          fromRef: `${providerId}:AGRICULTURAL_SOURCE_BUNDLE:deere-record-001`,
          toRef: 'synthetic-deere-adapter',
          relation: 'ACQUIRED_VIA',
          sourceProviderId: providerId,
          acquisitionChannel: 'NATIVE_STRATEGIC_CONNECTOR',
          occurredAt: MULTI_PROVIDER_TIME,
        },
      ],
      limitations: ['Synthetic Deere-shaped encoding of a shared bounded source truth'],
    },
    ADAPT_SYNTHETIC_ORG_ID,
    MULTI_PROVIDER_TIME,
  )
  const mappingResult = mapSourceCapture(capture, mapping, MULTI_PROVIDER_TIME)

  return {
    routeId: 'deere-shaped',
    capture,
    mapping,
    mappingResult,
    claims: {
      identity: {
        state: 'PRESENT',
        value: MULTI_PROVIDER_FIELD_ANCHOR,
        evidenceRef: 'synthetic-multi-provider-crosswalk:field',
        confidence: 1,
      },
      relationship: {
        state: 'PRESENT',
        value: `${MULTI_PROVIDER_FARM_ANCHOR}->${MULTI_PROVIDER_FIELD_ANCHOR}`,
        evidenceRef: 'synthetic-multi-provider-crosswalk:farm-field',
        confidence: 1,
      },
      spatial: {
        state: 'PRESENT',
        value: 'synthetic-normalized-geometry:field-001',
        evidenceRef: 'synthetic-deere-normalized-geometry',
        confidence: 1,
      },
      temporal: {
        state: 'PRESENT',
        value: operationEffectiveAt,
        evidenceRef: 'synthetic-deere-effective-time',
        confidence: 1,
      },
      unit: {
        state: 'PRESENT',
        value: 'kg/ha',
        unit: 'kg/ha',
        evidenceRef: 'synthetic-deere-measurement-unit',
        confidence: 1,
      },
      measurement: {
        state: 'PRESENT',
        value: 12,
        unit: 'kg/ha',
        evidenceRef: 'synthetic-deere-measurement',
        confidence: 1,
      },
      operational: {
        state: 'PRESENT',
        value: 'SEEDING',
        evidenceRef: 'synthetic-deere-operation-type',
        confidence: 1,
      },
    } satisfies SourceRouteEvidence['claims'],
  }
}

function buildAdaptStandardFileRoute(
  rights: RightsSnapshot,
  options: { unknownProvider?: boolean } = {},
): SourceRouteEvidence {
  const proofRights = extendRightsForMultiProviderProof(rights)
  const sourceOrigin = options.unknownProvider
    ? undefined
    : {
        providerId: 'synthetic-standard-file-upstream-provider',
        authorityId: 'synthetic-standard-file-source-authority',
      }
  const document = {
    ...SYNTHETIC_ADAPT_DOCUMENT,
    ...(sourceOrigin ? { sourceOrigin } : {}),
    field: {
      ...SYNTHETIC_ADAPT_DOCUMENT.field,
      id: { referenceId: 21 },
      farmId: 11,
    },
    boundary: {
      ...SYNTHETIC_ADAPT_DOCUMENT.boundary,
      spatialData: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-93.0, 45.0],
              [-92.99, 45.0],
              [-92.99, 45.01],
              [-93.0, 45.01],
              [-93.0, 45.0],
            ],
          ],
        ],
      },
    },
    operation: {
      ...SYNTHETIC_ADAPT_DOCUMENT.operation,
      measurement: { value: 12, unit: 'kg/ha' },
      timeScope: {
        dateContext: 'UNSPECIFIED',
        timeStamp1: operationEffectiveAt,
      },
    },
  }
  const result = ingestSyntheticAdaptDocument(document, {
    orgId: ADAPT_SYNTHETIC_ORG_ID,
    operatorId: 'synthetic-multi-provider-operator',
    purpose: MULTI_PROVIDER_PROOF_PURPOSE,
    recipientId: MULTI_PROVIDER_PROOF_RECIPIENT_ID,
    capturedAt: MULTI_PROVIDER_TIME,
    rights: proofRights,
  })

  return {
    routeId: 'adapt-standard-file',
    capture: result.capture,
    mapping: result.mapping,
    mappingResult: result.mappingResult,
    claims: {
      identity: {
        state: 'PRESENT',
        value: MULTI_PROVIDER_FIELD_ANCHOR,
        evidenceRef: 'synthetic-multi-provider-crosswalk:field',
        confidence: 1,
      },
      relationship: {
        state: 'PRESENT',
        value: `${MULTI_PROVIDER_FARM_ANCHOR}->${MULTI_PROVIDER_FIELD_ANCHOR}`,
        evidenceRef: 'synthetic-multi-provider-crosswalk:farm-field',
        confidence: 1,
      },
      spatial: {
        state: 'UNRESOLVED',
        evidenceRef: 'adapt-geometry-not-normalized',
        confidence: 0,
      },
      temporal: {
        state: 'UNRESOLVED',
        evidenceRef: 'adapt-time-scope-role-unspecified',
        confidence: 0,
      },
      unit: {
        state: 'PRESENT',
        value: 'kg/ha',
        unit: 'kg/ha',
        evidenceRef: 'adapt-measurement-unit',
        confidence: 1,
      },
      measurement: {
        state: 'PRESENT',
        value: 12,
        unit: 'kg/ha',
        evidenceRef: 'adapt-measurement',
        confidence: 1,
      },
      operational: {
        state: 'PRESENT',
        value: 'SEEDING',
        evidenceRef: 'adapt-operation-type',
        confidence: 1,
      },
    } satisfies SourceRouteEvidence['claims'],
  }
}

function buildFieldViewRoute(rights: RightsSnapshot): SourceRouteEvidence {
  const proofRights = extendRightsForMultiProviderProof(rights)
  const result = ingestSyntheticFieldViewDocument(SYNTHETIC_FIELDVIEW_DOCUMENT, {
    orgId: ADAPT_SYNTHETIC_ORG_ID,
    operatorId: 'synthetic-multi-provider-operator',
    purpose: MULTI_PROVIDER_PROOF_PURPOSE,
    recipientId: MULTI_PROVIDER_PROOF_RECIPIENT_ID,
    capturedAt: MULTI_PROVIDER_TIME,
    rights: proofRights,
  })
  return {
    routeId: 'fieldview-shaped',
    capture: result.capture,
    mapping: result.mapping,
    mappingResult: result.mappingResult,
    claims: {
      identity: {
        state: 'PRESENT',
        value: MULTI_PROVIDER_FIELD_ANCHOR,
        evidenceRef: 'synthetic-multi-provider-crosswalk:field',
        confidence: 1,
      },
      relationship: {
        state: 'PRESENT',
        value: `${MULTI_PROVIDER_FARM_ANCHOR}->${MULTI_PROVIDER_FIELD_ANCHOR}`,
        evidenceRef: 'synthetic-multi-provider-crosswalk:farm-field',
        confidence: 1,
      },
      spatial: {
        state: 'PRESENT',
        value: 'synthetic-normalized-geometry:field-001',
        evidenceRef: 'synthetic-fieldview-normalized-geometry',
        confidence: 1,
      },
      temporal: {
        state: 'PRESENT',
        value: operationEffectiveAt,
        evidenceRef: 'synthetic-fieldview-effective-time',
        confidence: 1,
      },
      unit: {
        state: 'PRESENT',
        value: 'kg/ha',
        unit: 'kg/ha',
        evidenceRef: 'synthetic-fieldview-measurement-unit',
        confidence: 1,
      },
      measurement: {
        state: 'PRESENT',
        value: 12,
        unit: 'kg/ha',
        evidenceRef: 'synthetic-fieldview-measurement',
        confidence: 1,
      },
      operational: {
        state: 'PRESENT',
        value: 'SEEDING',
        evidenceRef: 'synthetic-fieldview-operation-type',
        confidence: 1,
      },
    } satisfies SourceRouteEvidence['claims'],
  }
}

export function buildSyntheticMultiProviderRoutes(
  options: {
    deereRights?: RightsSnapshot
    fieldViewRights?: RightsSnapshot
    adaptRights?: RightsSnapshot
    unknownAdaptProvider?: boolean
    deereMappingVersion?: string
  } = {},
): [SourceRouteEvidence, SourceRouteEvidence, SourceRouteEvidence] {
  const deere = buildDeereShapedRoute(
    options.deereRights ?? buildSyntheticAdaptRights(),
    options.deereMappingVersion,
  )
  const fieldView = buildFieldViewRoute(options.fieldViewRights ?? buildSyntheticFieldViewRights())
  const adapt = buildAdaptStandardFileRoute(options.adaptRights ?? buildSyntheticAdaptRights(), {
    unknownProvider: options.unknownAdaptProvider,
  })

  return [deere, fieldView, adapt]
}

export function createSyntheticMultiProviderCapsule(
  routes: SourceRouteEvidence[],
): ContinuityCapsule {
  return assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: 'synthetic-multi-provider-capsule',
      orgId: ADAPT_SYNTHETIC_ORG_ID,
      purpose: MULTI_PROVIDER_PROOF_PURPOSE,
      createdAt: MULTI_PROVIDER_TIME,
      subjectRef: routes[0]?.capture.sourceRef ?? {
        providerId: 'UNKNOWN',
        objectType: 'MULTI_SOURCE_SCENARIO',
        objectId: MULTI_PROVIDER_SCENARIO_ID,
      },
      captures: routes.map((route) => route.capture),
      mappings: routes.map((route) => route.mapping),
      mappingResults: routes.map((route) => route.mappingResult),
      limitations: [
        'Synthetic multi-provider bundle only',
        'Capsule groups semantically equivalent captures without asserting live-provider rights',
        'Canonical subject binding remains scenario-scoped rather than provider-authoritative',
      ],
    },
    ADAPT_SYNTHETIC_ORG_ID,
  )
}
