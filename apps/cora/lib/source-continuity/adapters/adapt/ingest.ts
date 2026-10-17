import { safeJsonValueSchema, type RightsSnapshot, type SafeJsonValue } from '../../contracts'
import { createSourceCapture } from '../../capture'
import { assembleContinuityCapsule, type ContinuityCapsule } from '../../capsule'
import {
  mapSourceCapture,
  type MappedField,
  type SemanticMappingResult,
} from '../../semantic-mapping'
import { ADAPT_FIXTURE_SCHEMA_PREFIX, buildAdaptMapping } from './mapping'
import { adaptSyntheticDocumentSchema, type AdaptSyntheticDocument } from './contracts'

export interface AdaptSyntheticIngestionContext {
  orgId: string
  operatorId: string
  purpose: string
  recipientId: string
  capturedAt: string
  rights: RightsSnapshot
}

export interface AdaptSyntheticIngestionResult {
  capture: ReturnType<typeof createSourceCapture>
  mapping: ReturnType<typeof buildAdaptMapping>
  mappingResult: SemanticMappingResult
  canonicalValues: Record<string, SafeJsonValue>
  capsule: ContinuityCapsule
}

function adaptIdField(
  fields: MappedField[],
  sourcePath: string,
  sourceId: number | undefined,
  relationshipMatches: boolean,
): void {
  const field = fields.find((item) => item.sourcePath === sourcePath)
  if (!field) throw new Error(`ADAPT mapping is missing expected field ${sourcePath}`)
  if (sourceId === undefined || !relationshipMatches) {
    delete field.canonicalValue
    field.state = 'UNMAPPED'
    field.losses = [...field.losses, 'SOURCE_IDENTITY_UNRESOLVED']
  }
}

function addUnmappedSourceField(
  fields: MappedField[],
  sourcePath: string,
  canonicalField: string,
  sourceValue: SafeJsonValue | undefined,
  loss: string,
): void {
  fields.push({
    sourcePath,
    canonicalField,
    ...(sourceValue !== undefined ? { sourceValue } : {}),
    state: sourceValue === undefined ? 'MISSING' : 'UNMAPPED',
    losses: [loss],
  })
}

function applyBoundedAdaptSemantics(
  result: SemanticMappingResult,
  document: AdaptSyntheticDocument,
): SemanticMappingResult {
  const fields = [...result.fields]
  const farmId = document.farm.id.referenceId
  const fieldId = document.field.id.referenceId

  adaptIdField(fields, 'farm.id.referenceId', farmId, farmId !== undefined)
  adaptIdField(fields, 'field.id.referenceId', fieldId, fieldId !== undefined)
  adaptIdField(
    fields,
    'field.farmId',
    document.field.farmId,
    farmId !== undefined && document.field.farmId === farmId,
  )
  adaptIdField(
    fields,
    'boundary.fieldId',
    document.boundary.fieldId,
    fieldId !== undefined && document.boundary.fieldId === fieldId,
  )

  const timeField = fields.find((item) => item.sourcePath === 'operation.timeScope.timeStamp1')
  if (timeField && timeField.state === 'MAPPED') {
    delete timeField.canonicalValue
    timeField.state = 'UNMAPPED'
    timeField.losses = [...timeField.losses, 'TEMPORAL_ROLE_UNSPECIFIED']
  }

  const spatialData = document.boundary.spatialData
  addUnmappedSourceField(
    fields,
    'boundary.spatialData',
    'land.boundary.geometry',
    spatialData,
    'SEMANTIC_LOSS_SPATIAL_NORMALIZATION_NOT_IMPLEMENTED',
  )

  return {
    ...result,
    fields,
    evidence: [
      {
        kind: 'IDENTITY_INTERPRETATION',
        evidenceRef: 'CORA_ADAPT_MAPPING_CONTRACT.md#identity',
        details: {
          sourceLocalReferencesAreNamespacedByCapture: true,
          fieldFarmRelationshipResolved: farmId !== undefined && document.field.farmId === farmId,
          boundaryFieldRelationshipResolved:
            fieldId !== undefined && document.boundary.fieldId === fieldId,
          noUniversalIdentityCreated: true,
        },
      },
      {
        kind: 'TEMPORAL_INTERPRETATION',
        sourcePath: 'operation.timeScope',
        evidenceRef: 'CORA_ADAPT_MAPPING_CONTRACT.md#temporal-interpretation',
        details: {
          dateContext: document.operation.timeScope?.dateContext ?? 'NOT_PROVIDED',
          timestamp1: document.operation.timeScope?.timeStamp1 ?? 'NOT_PROVIDED',
          state: 'UNRESOLVED',
          reason: 'The fixture mapping does not establish observation/effective/modified role',
        },
      },
      {
        kind: 'SEMANTIC_LOSS',
        sourcePath: 'boundary.spatialData',
        evidenceRef: 'CORA_ADAPT_MAPPING_CONTRACT.md#known-losses',
        details: {
          state: 'SEMANTIC_LOSS',
          reason: 'Source geometry is retained but no Cora spatial normalization is implemented',
        },
      },
    ],
  }
}

function getCanonicalValues(result: SemanticMappingResult): Record<string, SafeJsonValue> {
  return Object.fromEntries(
    result.fields.flatMap((field) =>
      field.state === 'MAPPED' && field.canonicalValue !== undefined
        ? [[field.canonicalField, field.canonicalValue]]
        : [],
    ),
  )
}

export function ingestSyntheticAdaptDocument(
  input: AdaptSyntheticDocument,
  context: AdaptSyntheticIngestionContext,
): AdaptSyntheticIngestionResult {
  const document = adaptSyntheticDocumentSchema.parse(input)
  const sourceProviderId = document.sourceOrigin?.providerId ?? 'UNKNOWN'
  const sourceAuthorityId = document.sourceOrigin?.authorityId ?? 'UNKNOWN'
  const areaUnit = document.field.area?.unit.code
  const mapping = buildAdaptMapping(sourceProviderId, areaUnit, document.operation.measurement.unit)
  const sourceRef = {
    providerId: sourceProviderId,
    objectType: 'ADAPT_DOCUMENT',
    objectId: document.dataSetId,
    sourceVersion: `ADAPT-ADM-${document.standardVersion}`,
  }
  const capture = createSourceCapture(
    {
      captureId: `synthetic-adapt-capture-${document.dataSetId}`,
      orgId: context.orgId,
      operatorId: context.operatorId,
      sourceRef,
      sourceAuthority: {
        authorityId: sourceAuthorityId,
        authorityType: 'SOURCE_PROVIDER',
      },
      acquisitionRoute: {
        channel: 'STANDARD_FILE_CONNECTOR',
        transport: 'FILE',
        acquisitionProviderId: 'cora-adapt-file-adapter',
      },
      sourceSchemaVersion: ADAPT_FIXTURE_SCHEMA_PREFIX,
      capturedAt: context.capturedAt,
      freshness: 'NOT_VERIFIED',
      purpose: context.purpose,
      recipientId: context.recipientId,
      rights: context.rights,
      payload: safeJsonValueSchema.parse(document),
      mappingRefs: [{ mappingId: mapping.mappingId, version: mapping.version }],
      provenance: [
        {
          edgeId: `synthetic-adapt-provenance-${document.dataSetId}`,
          fromRef: `${sourceProviderId}:ADAPT_DOCUMENT:${document.dataSetId}`,
          toRef: 'cora-adapt-file-adapter',
          relation: 'ACQUIRED_VIA',
          sourceProviderId,
          acquisitionChannel: 'STANDARD_FILE_CONNECTOR',
          occurredAt: context.capturedAt,
        },
      ],
      limitations: [
        'Synthetic ADAPT-shaped fixture only; not a provider runtime or official-file parser',
        ...(sourceProviderId === 'UNKNOWN'
          ? ['Upstream source provider is unknown and was not inferred from ADAPT']
          : []),
      ],
    },
    context.orgId,
    context.capturedAt,
  )

  const mapped = mapSourceCapture(capture, mapping, context.capturedAt)
  const mappingResult = applyBoundedAdaptSemantics(mapped, document)
  const capsule = assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: `synthetic-adapt-capsule-${document.dataSetId}`,
      orgId: context.orgId,
      purpose: context.purpose,
      createdAt: context.capturedAt,
      subjectRef: sourceRef,
      captures: [capture],
      mappings: [mapping],
      mappingResults: [mappingResult],
      limitations: [
        'Synthetic ADAPT-shaped fixture only',
        'Source currentness and source-provider availability are not verified',
        'Mapping losses and unresolved identity/time semantics remain explicit',
      ],
    },
    context.orgId,
  )

  return {
    capture,
    mapping,
    mappingResult,
    canonicalValues: getCanonicalValues(mappingResult),
    capsule,
  }
}
