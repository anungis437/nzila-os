import { describe, expect, it } from 'vitest'
import { createSourceCapture } from '../../capture'
import { exportContinuityCapsule } from '../../export'
import { computeSemanticMappingDigest } from '../../semantic-mapping'
import { rehydrateContinuityCapsule } from '../../rehydrate'
import { evaluateSyntheticRouteConformance } from '../../test-harness'
import type { SemanticMapping } from '../../contracts'
import {
  ADAPT_SYNTHETIC_ORG_ID,
  ADAPT_SYNTHETIC_PURPOSE,
  ADAPT_SYNTHETIC_RECIPIENT_ID,
  ADAPT_SYNTHETIC_TIME,
  buildSyntheticAdaptRights,
  SYNTHETIC_ADAPT_DOCUMENT,
} from './fixture'
import { ingestSyntheticAdaptDocument } from './ingest'
import { ADAPT_FIXTURE_SCHEMA_PREFIX, HECTARES_TO_ACRES } from './mapping'

function context(rights = buildSyntheticAdaptRights()) {
  return {
    orgId: ADAPT_SYNTHETIC_ORG_ID,
    operatorId: 'synthetic-adapt-operator',
    purpose: ADAPT_SYNTHETIC_PURPOSE,
    recipientId: ADAPT_SYNTHETIC_RECIPIENT_ID,
    capturedAt: ADAPT_SYNTHETIC_TIME,
    rights,
  }
}

function buildNativeLandRoute() {
  const nativeProviderId = 'synthetic-native-land-provider'
  const mappingDefinition = {
    mappingId: 'synthetic-native-land-mapping',
    version: '1.0.0',
    authorityId: 'synthetic-native-mapping-authority',
    sourceProviderId: nativeProviderId,
    sourceSchemaVersion: 'synthetic-native-land-v1',
    fields: [
      {
        sourcePath: 'farmLocalId',
        canonicalField: 'land.farm.sourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'fieldLocalId',
        canonicalField: 'land.field.sourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'farmLocalId',
        canonicalField: 'land.field.farmSourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'fieldLocalId',
        canonicalField: 'land.boundary.fieldSourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'areaAcres',
        canonicalField: 'land.field.area',
        operation: 'IDENTITY' as const,
        sourceUnit: 'acre',
        canonicalUnit: 'acre',
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'operationType',
        canonicalField: 'agriculture.operation.type',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'measurement',
        canonicalField: 'agriculture.operation.measurement.value',
        operation: 'IDENTITY' as const,
        sourceUnit: 'kg/ha',
        canonicalUnit: 'kg/ha',
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'measurementUnit',
        canonicalField: 'agriculture.operation.measurement.unit',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
    ],
    limitations: ['Synthetic native route only'],
  }
  const mapping: SemanticMapping = {
    ...mappingDefinition,
    definitionSha256: computeSemanticMappingDigest(mappingDefinition),
  }
  const sourceRef = {
    providerId: nativeProviderId,
    objectType: 'LAND_OPERATION_BUNDLE',
    objectId: 'synthetic-native-bundle-001',
  }
  const capture = createSourceCapture(
    {
      captureId: 'synthetic-native-land-capture',
      orgId: ADAPT_SYNTHETIC_ORG_ID,
      operatorId: 'synthetic-adapt-operator',
      sourceRef,
      sourceAuthority: {
        authorityId: 'synthetic-native-provider',
        authorityType: 'SOURCE_PROVIDER',
      },
      acquisitionRoute: {
        channel: 'NATIVE_STRATEGIC_CONNECTOR',
        transport: 'API',
        acquisitionProviderId: 'synthetic-native-land-adapter',
      },
      sourceSchemaVersion: 'synthetic-native-land-v1',
      capturedAt: ADAPT_SYNTHETIC_TIME,
      freshness: 'NOT_VERIFIED',
      purpose: ADAPT_SYNTHETIC_PURPOSE,
      recipientId: ADAPT_SYNTHETIC_RECIPIENT_ID,
      rights: buildSyntheticAdaptRights(),
      payload: {
        farmLocalId: 11,
        fieldLocalId: 21,
        areaAcres: 100 * HECTARES_TO_ACRES,
        operationType: 'SEEDING',
        measurement: 12,
        measurementUnit: 'kg/ha',
      },
      mappingRefs: [{ mappingId: mapping.mappingId, version: mapping.version }],
      provenance: [
        {
          edgeId: 'synthetic-native-land-provenance',
          fromRef:
            'synthetic-native-land-provider:LAND_OPERATION_BUNDLE:synthetic-native-bundle-001',
          toRef: 'synthetic-native-land-adapter',
          relation: 'ACQUIRED_VIA',
          sourceProviderId: nativeProviderId,
          acquisitionChannel: 'NATIVE_STRATEGIC_CONNECTOR',
          occurredAt: ADAPT_SYNTHETIC_TIME,
        },
      ],
      limitations: ['Synthetic data only'],
    },
    ADAPT_SYNTHETIC_ORG_ID,
    ADAPT_SYNTHETIC_TIME,
  )

  return {
    channel: 'NATIVE_STRATEGIC_CONNECTOR' as const,
    capture,
    mapping,
  }
}

describe('synthetic ADAPT standard-file adapter', () => {
  it('maps the bounded synthetic land and operation concepts and preserves the source', () => {
    const result = ingestSyntheticAdaptDocument(SYNTHETIC_ADAPT_DOCUMENT, context())

    expect(result.capture.acquisitionRoute.channel).toBe('STANDARD_FILE_CONNECTOR')
    expect(result.capture.acquisitionRoute.transport).toBe('FILE')
    expect(result.capture.sourceRef.providerId).toBe('UNKNOWN')
    expect(result.capture.sourceAuthority.authorityId).toBe('UNKNOWN')
    expect(result.capture.payload).toEqual(SYNTHETIC_ADAPT_DOCUMENT)
    expect(result.canonicalValues['land.farm.sourceLocalReferenceId']).toBe(11)
    expect(result.canonicalValues['land.field.sourceLocalReferenceId']).toBe(21)
    expect(result.canonicalValues['agriculture.operation.type']).toBe('SEEDING')
    expect(result.canonicalValues['agriculture.operation.measurement.value']).toBe(12)
    expect(result.canonicalValues['agriculture.operation.measurement.unit']).toBe('kg/ha')
    expect(
      result.mappingResult.fields.map(({ canonicalField }) => canonicalField).join(' '),
    ).not.toMatch(/ADAPT|CompoundIdentifier|OperationData|NumericRepresentationValue/)
    expect(result.canonicalValues).not.toHaveProperty('canonicalIdentityId')
  })

  it('retains original and converted area values with versioned evidence', () => {
    const result = ingestSyntheticAdaptDocument(SYNTHETIC_ADAPT_DOCUMENT, context())
    const area = result.mappingResult.fields.find(
      (field) => field.canonicalField === 'land.field.area',
    )

    expect(area).toMatchObject({
      sourceValue: 100,
      canonicalValue: 100 * HECTARES_TO_ACRES,
      sourceUnit: 'ha',
      canonicalUnit: 'acre',
      state: 'MAPPED',
      transformationEvidence: {
        transformationId: 'hectare-to-acre',
        version: '1.0.0',
        sourceValue: 100,
        sourceUnit: 'ha',
        transformedValue: 100 * HECTARES_TO_ACRES,
        canonicalUnit: 'acre',
      },
    })
  })

  it('preserves the input measurement unit and does not invent a missing area unit', () => {
    const { area: _area, ...fieldWithoutArea } = SYNTHETIC_ADAPT_DOCUMENT.field
    const document = {
      ...SYNTHETIC_ADAPT_DOCUMENT,
      field: fieldWithoutArea,
      operation: {
        ...SYNTHETIC_ADAPT_DOCUMENT.operation,
        measurement: { value: 12, unit: 'source-unit-unknown-to-cora' },
      },
    }
    const result = ingestSyntheticAdaptDocument(document, context())
    const area = result.mappingResult.fields.find(
      (field) => field.canonicalField === 'land.field.area',
    )
    const measurement = result.mappingResult.fields.find(
      (field) => field.canonicalField === 'agriculture.operation.measurement.value',
    )

    expect(area).toMatchObject({ state: 'UNMAPPED' })
    expect(area).not.toHaveProperty('sourceUnit')
    expect(area).not.toHaveProperty('canonicalUnit')
    expect(measurement).toMatchObject({
      sourceValue: 12,
      canonicalValue: 12,
      sourceUnit: 'source-unit-unknown-to-cora',
      canonicalUnit: 'source-unit-unknown-to-cora',
    })
  })

  it('keeps missing and conflicting land relationships unresolved', () => {
    const { farmId: _farmId, ...fieldWithoutFarmId } = SYNTHETIC_ADAPT_DOCUMENT.field
    const { referenceId: _farmReferenceId, ...farmIdentifierWithoutReference } =
      SYNTHETIC_ADAPT_DOCUMENT.farm.id
    const missing = {
      ...SYNTHETIC_ADAPT_DOCUMENT,
      field: fieldWithoutFarmId,
    }
    const missingSourceIdentity = {
      ...SYNTHETIC_ADAPT_DOCUMENT,
      farm: {
        ...SYNTHETIC_ADAPT_DOCUMENT.farm,
        id: farmIdentifierWithoutReference,
      },
    }
    const conflict = {
      ...SYNTHETIC_ADAPT_DOCUMENT,
      boundary: { ...SYNTHETIC_ADAPT_DOCUMENT.boundary, fieldId: 999 },
    }
    const missingResult = ingestSyntheticAdaptDocument(missing, context())
    const missingSourceIdentityResult = ingestSyntheticAdaptDocument(
      missingSourceIdentity,
      context(),
    )
    const conflictResult = ingestSyntheticAdaptDocument(conflict, context())

    expect(
      missingSourceIdentityResult.mappingResult.fields.find(
        (field) => field.sourcePath === 'farm.id.referenceId',
      ),
    ).toMatchObject({
      state: 'UNMAPPED',
      losses: expect.arrayContaining(['SOURCE_VALUE_UNAVAILABLE', 'SOURCE_IDENTITY_UNRESOLVED']),
    })
    expect(missingSourceIdentityResult.canonicalValues).not.toHaveProperty(
      'land.farm.sourceLocalReferenceId',
    )
    expect(
      missingResult.mappingResult.fields.find((field) => field.sourcePath === 'field.farmId'),
    ).toMatchObject({
      state: 'UNMAPPED',
      losses: expect.arrayContaining(['SOURCE_VALUE_UNAVAILABLE', 'SOURCE_IDENTITY_UNRESOLVED']),
    })
    expect(
      conflictResult.mappingResult.fields.find((field) => field.sourcePath === 'boundary.fieldId'),
    ).toMatchObject({ state: 'UNMAPPED', sourceValue: 999 })
    expect(conflictResult.canonicalValues).not.toHaveProperty(
      'land.boundary.fieldSourceLocalReferenceId',
    )
  })

  it('preserves timestamp data without assigning an unsupported temporal role', () => {
    const result = ingestSyntheticAdaptDocument(SYNTHETIC_ADAPT_DOCUMENT, context())
    const time = result.mappingResult.fields.find(
      (field) => field.sourcePath === 'operation.timeScope.timeStamp1',
    )

    expect(time).toMatchObject({
      sourceValue: '2026-04-15T10:30:00.000Z',
      state: 'UNMAPPED',
      losses: ['TEMPORAL_ROLE_UNSPECIFIED'],
    })
    expect(result.capture.payload).toEqual(SYNTHETIC_ADAPT_DOCUMENT)
  })

  it('records semantic loss while retaining the unnormalized source geometry', () => {
    const result = ingestSyntheticAdaptDocument(SYNTHETIC_ADAPT_DOCUMENT, context())
    const geometry = result.mappingResult.fields.find(
      (field) => field.sourcePath === 'boundary.spatialData',
    )

    expect(geometry).toMatchObject({
      state: 'UNMAPPED',
      losses: ['SEMANTIC_LOSS_SPATIAL_NORMALIZATION_NOT_IMPLEMENTED'],
    })
    expect(result.capture.payload).toEqual(SYNTHETIC_ADAPT_DOCUMENT)
    expect(result.mappingResult.evidence).toContainEqual(
      expect.objectContaining({ kind: 'SEMANTIC_LOSS', sourcePath: 'boundary.spatialData' }),
    )
  })

  it('round-trips mapping evidence for offline rehydration only under allowed rights', () => {
    const result = ingestSyntheticAdaptDocument(SYNTHETIC_ADAPT_DOCUMENT, context())
    const exported = exportContinuityCapsule(
      result.capsule,
      ADAPT_SYNTHETIC_RECIPIENT_ID,
      ADAPT_SYNTHETIC_PURPOSE,
      ADAPT_SYNTHETIC_TIME,
    )
    const rehydrated = rehydrateContinuityCapsule(
      exported,
      ADAPT_SYNTHETIC_ORG_ID,
      ADAPT_SYNTHETIC_RECIPIENT_ID,
      ADAPT_SYNTHETIC_TIME,
    )

    expect(rehydrated.sourceCurrentness).toBe('NOT_VERIFIED')
    expect(rehydrated.sourceProviderAvailable).toBe(false)
    expect(rehydrated.capsule.mappingResults?.[0]?.fields).toEqual(result.mappingResult.fields)
    expect(rehydrated.capsule.captures[0]?.payload).toEqual(SYNTHETIC_ADAPT_DOCUMENT)
  })

  it('fails closed when persistence or transformation is unknown or denied', () => {
    expect(() =>
      ingestSyntheticAdaptDocument(
        SYNTHETIC_ADAPT_DOCUMENT,
        context(buildSyntheticAdaptRights({ persistence: 'UNKNOWN' })),
      ),
    ).toThrow(/persistence is not authorized/i)
    expect(() =>
      ingestSyntheticAdaptDocument(
        SYNTHETIC_ADAPT_DOCUMENT,
        context(buildSyntheticAdaptRights({ transformation: 'DENIED' })),
      ),
    ).toThrow(/mapping is not authorized/i)
  })

  it('fails closed when export or rehydration rights are denied', () => {
    const exportDenied = ingestSyntheticAdaptDocument(
      SYNTHETIC_ADAPT_DOCUMENT,
      context(buildSyntheticAdaptRights({ export: 'DENIED' })),
    )
    expect(() =>
      exportContinuityCapsule(
        exportDenied.capsule,
        ADAPT_SYNTHETIC_RECIPIENT_ID,
        ADAPT_SYNTHETIC_PURPOSE,
        ADAPT_SYNTHETIC_TIME,
      ),
    ).toThrow(/export is not authorized/i)

    const rehydrationDenied = ingestSyntheticAdaptDocument(
      SYNTHETIC_ADAPT_DOCUMENT,
      context(buildSyntheticAdaptRights({ rehydration: 'DENIED' })),
    )
    const serialized = exportContinuityCapsule(
      rehydrationDenied.capsule,
      ADAPT_SYNTHETIC_RECIPIENT_ID,
      ADAPT_SYNTHETIC_PURPOSE,
      ADAPT_SYNTHETIC_TIME,
    )
    expect(() =>
      rehydrateContinuityCapsule(
        serialized,
        ADAPT_SYNTHETIC_ORG_ID,
        ADAPT_SYNTHETIC_RECIPIENT_ID,
        ADAPT_SYNTHETIC_TIME,
      ),
    ).toThrow(/rehydration is not authorized/i)
  })

  it('compares supported canonical meaning across native and standard-file routes only', () => {
    const adapt = ingestSyntheticAdaptDocument(SYNTHETIC_ADAPT_DOCUMENT, context())
    const report = evaluateSyntheticRouteConformance(
      [
        buildNativeLandRoute(),
        {
          channel: adapt.capture.acquisitionRoute.channel,
          capture: adapt.capture,
          mapping: adapt.mapping,
        },
      ],
      [
        'land.farm.sourceLocalReferenceId',
        'land.field.sourceLocalReferenceId',
        'land.field.area',
        'agriculture.operation.type',
        'agriculture.operation.measurement.value',
        'agriculture.operation.measurement.unit',
      ],
      ADAPT_SYNTHETIC_TIME,
    )

    expect(report.canonicalMeaningEquivalent).toBe(true)
    expect(report.routesAreSyntheticOnly).toBe(true)
    expect(report.providerIndependenceProven).toBe(false)
    expect(report.cases.map((route) => route.channel)).toEqual([
      'NATIVE_STRATEGIC_CONNECTOR',
      'STANDARD_FILE_CONNECTOR',
    ])
    expect(report.cases.map((route) => route.sourceProviderId)).toEqual([
      'synthetic-native-land-provider',
      'UNKNOWN',
    ])
  })

  it('uses the bounded fixture contract rather than asserting an official file serialization', () => {
    const result = ingestSyntheticAdaptDocument(SYNTHETIC_ADAPT_DOCUMENT, context())

    expect(result.capture.sourceSchemaVersion).toBe(ADAPT_FIXTURE_SCHEMA_PREFIX)
    expect(result.mapping.sourceSchemaVersion).toBe(ADAPT_FIXTURE_SCHEMA_PREFIX)
    expect(result.mapping.limitations).toContain(
      'The Cora fixture envelope is not an official ADAPT serialization format',
    )
  })
})
