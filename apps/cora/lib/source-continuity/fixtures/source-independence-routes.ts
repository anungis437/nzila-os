import type { RightsSnapshot, SafeJsonValue, SemanticMapping } from '../contracts'
import { createSourceCapture } from '../capture'
import { assembleContinuityCapsule, type ContinuityCapsule } from '../capsule'
import { computeSemanticMappingDigest, mapSourceCapture } from '../semantic-mapping'
import type { SourceRouteEvidence } from '../source-independence'
import {
  ADAPT_SYNTHETIC_ORG_ID,
  ADAPT_SYNTHETIC_PURPOSE,
  ADAPT_SYNTHETIC_RECIPIENT_ID,
  ADAPT_SYNTHETIC_TIME,
  buildSyntheticAdaptRights,
  SYNTHETIC_ADAPT_DOCUMENT,
} from '../adapters/adapt/fixture'
import { ingestSyntheticAdaptDocument } from '../adapters/adapt/ingest'
import { HECTARES_TO_ACRES } from '../adapters/adapt/mapping'

export const INDEPENDENCE_SCENARIO_ID = 'synthetic-source-truth-001'
export const INDEPENDENCE_FIELD_ANCHOR = `${INDEPENDENCE_SCENARIO_ID}:field-001`
export const INDEPENDENCE_FARM_ANCHOR = `${INDEPENDENCE_SCENARIO_ID}:farm-001`
export const INDEPENDENCE_TIME = ADAPT_SYNTHETIC_TIME

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

function buildNativeRoute(rights: RightsSnapshot, mappingVersion = '1.0.0'): SourceRouteEvidence {
  const providerId = 'synthetic-native-strategic-provider'
  const fields: SemanticMapping['fields'] = [
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
    required: true,
    declaredLosses: [],
  }))
  const mappingDefinition: Omit<SemanticMapping, 'definitionSha256'> = {
    mappingId: 'synthetic-independence-native-mapping',
    version: mappingVersion,
    authorityId: 'synthetic-cora-mapping-authority',
    sourceProviderId: providerId,
    sourceSchemaVersion: 'synthetic-native-ag-v1',
    fields,
    limitations: ['Synthetic native route only'],
  }
  const mapping: SemanticMapping = {
    ...mappingDefinition,
    definitionSha256: computeSemanticMappingDigest(mappingDefinition),
  }
  const capture = createSourceCapture(
    {
      captureId: 'synthetic-independence-native-capture',
      orgId: ADAPT_SYNTHETIC_ORG_ID,
      operatorId: 'synthetic-independence-operator',
      sourceRef: {
        providerId,
        objectType: 'AGRICULTURAL_SOURCE_BUNDLE',
        objectId: 'native-record-001',
        sourceVersion: 'native-v1',
      },
      sourceAuthority: {
        authorityId: 'synthetic-native-source-authority',
        authorityType: 'SOURCE_PROVIDER',
      },
      acquisitionRoute: {
        channel: 'NATIVE_STRATEGIC_CONNECTOR',
        transport: 'API',
        acquisitionProviderId: 'synthetic-native-adapter',
      },
      sourceSchemaVersion: 'synthetic-native-ag-v1',
      sourceObservedAt: operationObservedAt,
      capturedAt: INDEPENDENCE_TIME,
      freshness: 'NOT_VERIFIED',
      purpose: ADAPT_SYNTHETIC_PURPOSE,
      recipientId: ADAPT_SYNTHETIC_RECIPIENT_ID,
      rights,
      payload: {
        farmId: 'native-farm-11',
        fieldId: 'native-field-21',
        farmAnchor: INDEPENDENCE_FARM_ANCHOR,
        fieldAnchor: INDEPENDENCE_FIELD_ANCHOR,
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
          edgeId: 'synthetic-independence-native-provenance',
          fromRef: `${providerId}:AGRICULTURAL_SOURCE_BUNDLE:native-record-001`,
          toRef: 'synthetic-native-adapter',
          relation: 'ACQUIRED_VIA',
          sourceProviderId: providerId,
          acquisitionChannel: 'NATIVE_STRATEGIC_CONNECTOR',
          occurredAt: INDEPENDENCE_TIME,
        },
      ],
      limitations: ['Synthetic native encoding of a shared test-only source truth'],
    },
    ADAPT_SYNTHETIC_ORG_ID,
    INDEPENDENCE_TIME,
  )
  const mappingResult = mapSourceCapture(capture, mapping, INDEPENDENCE_TIME)
  return {
    routeId: 'native',
    capture,
    mapping,
    mappingResult,
    claims: {
      identity: {
        state: 'PRESENT',
        value: INDEPENDENCE_FIELD_ANCHOR,
        evidenceRef: 'synthetic-test-crosswalk:field',
        confidence: 1,
      },
      relationship: {
        state: 'PRESENT',
        value: `${INDEPENDENCE_FARM_ANCHOR}->${INDEPENDENCE_FIELD_ANCHOR}`,
        evidenceRef: 'synthetic-test-crosswalk:farm-field',
        confidence: 1,
      },
      spatial: {
        state: 'PRESENT',
        value: 'synthetic-normalized-geometry:field-001',
        evidenceRef: 'synthetic-native-normalized-geometry',
        confidence: 1,
      },
      temporal: {
        state: 'PRESENT',
        value: operationEffectiveAt,
        evidenceRef: 'synthetic-native-effective-time',
        confidence: 1,
      },
      unit: {
        state: 'PRESENT',
        value: 'kg/ha',
        unit: 'kg/ha',
        evidenceRef: 'synthetic-native-measurement-unit',
        confidence: 1,
      },
      measurement: {
        state: 'PRESENT',
        value: 12,
        unit: 'kg/ha',
        evidenceRef: 'synthetic-native-measurement',
        confidence: 1,
      },
      operational: {
        state: 'PRESENT',
        value: 'SEEDING',
        evidenceRef: 'synthetic-native-operation-type',
        confidence: 1,
      },
    } satisfies SourceRouteEvidence['claims'],
  }
}

function buildStandardFileRoute(
  rights: RightsSnapshot,
  options: { unknownProvider?: boolean } = {},
) {
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
    operatorId: 'synthetic-independence-operator',
    purpose: ADAPT_SYNTHETIC_PURPOSE,
    recipientId: ADAPT_SYNTHETIC_RECIPIENT_ID,
    capturedAt: INDEPENDENCE_TIME,
    rights,
  })
  return {
    routeId: 'standard-file',
    capture: result.capture,
    mapping: result.mapping,
    mappingResult: result.mappingResult,
    capsule: result.capsule,
    claims: {
      identity: {
        state: 'PRESENT',
        value: INDEPENDENCE_FIELD_ANCHOR,
        evidenceRef: 'synthetic-test-crosswalk:field',
        confidence: 1,
      },
      relationship: {
        state: 'PRESENT',
        value: `${INDEPENDENCE_FARM_ANCHOR}->${INDEPENDENCE_FIELD_ANCHOR}`,
        evidenceRef: 'synthetic-test-crosswalk:farm-field',
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

export function buildSyntheticIndependenceRoutes(
  options: {
    nativeRights?: RightsSnapshot
    standardFileRights?: RightsSnapshot
    unknownStandardFileProvider?: boolean
    nativeMappingVersion?: string
  } = {},
): [SourceRouteEvidence, SourceRouteEvidence] {
  const nativeRights = options.nativeRights ?? buildSyntheticAdaptRights()
  const standardFileRights = options.standardFileRights ?? buildSyntheticAdaptRights()
  const native = buildNativeRoute(nativeRights, options.nativeMappingVersion)
  const standardFile = buildStandardFileRoute(standardFileRights, {
    unknownProvider: options.unknownStandardFileProvider,
  })

  return [native, standardFile]
}

export function createNativeIndependenceCapsule(route: SourceRouteEvidence): ContinuityCapsule {
  return assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: 'synthetic-independence-native-capsule',
      orgId: ADAPT_SYNTHETIC_ORG_ID,
      purpose: ADAPT_SYNTHETIC_PURPOSE,
      createdAt: INDEPENDENCE_TIME,
      subjectRef: route.capture.sourceRef,
      captures: [route.capture],
      mappings: [route.mapping],
      mappingResults: [route.mappingResult],
      limitations: ['Synthetic native source-independence test fixture only'],
    },
    ADAPT_SYNTHETIC_ORG_ID,
  )
}

export function createStandardFileIndependenceCapsule(
  route: SourceRouteEvidence,
): ContinuityCapsule {
  return assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: 'synthetic-independence-standard-file-capsule',
      orgId: ADAPT_SYNTHETIC_ORG_ID,
      purpose: ADAPT_SYNTHETIC_PURPOSE,
      createdAt: INDEPENDENCE_TIME,
      subjectRef: route.capture.sourceRef,
      captures: [route.capture],
      mappings: [route.mapping],
      mappingResults: [route.mappingResult],
      limitations: ['Synthetic ADAPT standard-file source-independence fixture only'],
    },
    ADAPT_SYNTHETIC_ORG_ID,
  )
}
