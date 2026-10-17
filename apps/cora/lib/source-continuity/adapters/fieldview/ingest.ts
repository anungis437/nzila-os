import { safeJsonValueSchema, type RightsSnapshot, type SafeJsonValue } from '../../contracts'
import { createSourceCapture } from '../../capture'
import { assembleContinuityCapsule, type ContinuityCapsule } from '../../capsule'
import {
  mapSourceCapture,
  type MappedField,
  type SemanticMappingResult,
} from '../../semantic-mapping'
import { FIELDVIEW_FIXTURE_SCHEMA_PREFIX, buildFieldViewMapping } from './mapping'
import { fieldViewSyntheticDocumentSchema, type FieldViewSyntheticDocument } from './contracts'

export interface FieldViewSyntheticIngestionContext {
  orgId: string
  operatorId: string
  purpose: string
  recipientId: string
  capturedAt: string
  rights: RightsSnapshot
}

export interface FieldViewSyntheticIngestionResult {
  capture: ReturnType<typeof createSourceCapture>
  mapping: ReturnType<typeof buildFieldViewMapping>
  mappingResult: SemanticMappingResult
  canonicalValues: Record<string, SafeJsonValue>
  capsule: ContinuityCapsule
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

function applyBoundedFieldViewSemantics(
  result: SemanticMappingResult,
  document: FieldViewSyntheticDocument,
): SemanticMappingResult {
  const fields = [...result.fields]
  addUnmappedSourceField(
    fields,
    'activity.lastModifiedTime',
    'agriculture.operation.lastModifiedTime',
    document.activity.lastModifiedTime,
    'SOURCE_EXTENSION_ONLY_LAST_MODIFIED_TIME',
  )

  return {
    ...result,
    fields,
    evidence: [
      {
        kind: 'IDENTITY_INTERPRETATION',
        evidenceRef: 'CORA_FV001_REFERENCE_CONNECTOR_ARCHITECTURE.md#synthetic-route-shape',
        details: {
          fieldViewGuidsRemainProviderScoped: true,
          boundaryFieldRelationshipResolved: document.boundary.fieldGuid === document.field.guid,
          activityFieldRelationshipResolved: document.activity.fieldGuid === document.field.guid,
          noUniversalIdentityCreated: true,
        },
      },
      {
        kind: 'TEMPORAL_INTERPRETATION',
        sourcePath: 'activity.lastModifiedTime',
        evidenceRef:
          'CORA_FV001_PUBLIC_CAPABILITY_EVIDENCE_LEDGER.md#change-and-freshness-primitives',
        details: {
          effectiveAt: document.activity.effectiveAt,
          observedAt: document.activity.observedAt,
          lastModifiedTime: document.activity.lastModifiedTime,
          state: 'PRESENT_BUT_NOT_CANONICAL',
          reason:
            'The synthetic kernel keeps lastModifiedTime as route-specific evidence rather than canonical truth',
        },
      },
      {
        kind: 'MAPPING_LIMITATION',
        sourcePath: 'activity.lastModifiedTime',
        evidenceRef: 'CORA_FV001_REFERENCE_CONNECTOR_ARCHITECTURE.md#rights-and-freshness-boundary',
        details: {
          state: 'SOURCE_EXTENSION_ONLY',
          reason: 'FieldView change metadata is retained without forcing a canonical extension',
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

export function ingestSyntheticFieldViewDocument(
  input: FieldViewSyntheticDocument,
  context: FieldViewSyntheticIngestionContext,
): FieldViewSyntheticIngestionResult {
  const document = fieldViewSyntheticDocumentSchema.parse(input)
  const sourceProviderId = document.sourceOrigin?.providerId ?? 'synthetic-fieldview-provider'
  const sourceAuthorityId =
    document.sourceOrigin?.authorityId ?? 'synthetic-fieldview-source-authority'
  const mapping = buildFieldViewMapping(sourceProviderId)
  const sourceRef = {
    providerId: sourceProviderId,
    objectType: 'FIELDVIEW_ACTIVITY_DOCUMENT',
    objectId: document.documentId,
    sourceVersion: `FIELDVIEW-${document.standardVersion}`,
  }
  const capture = createSourceCapture(
    {
      captureId: `synthetic-fieldview-capture-${document.documentId}`,
      orgId: context.orgId,
      operatorId: context.operatorId,
      sourceRef,
      sourceAuthority: {
        authorityId: sourceAuthorityId,
        authorityType: 'SOURCE_PROVIDER',
      },
      acquisitionRoute: {
        channel: 'NATIVE_STRATEGIC_CONNECTOR',
        transport: 'API',
        acquisitionProviderId: 'cora-fieldview-synthetic-adapter',
      },
      sourceSchemaVersion: FIELDVIEW_FIXTURE_SCHEMA_PREFIX,
      sourceObservedAt: document.activity.observedAt,
      capturedAt: context.capturedAt,
      freshness: 'NOT_VERIFIED',
      purpose: context.purpose,
      recipientId: context.recipientId,
      rights: context.rights,
      payload: safeJsonValueSchema.parse(document),
      mappingRefs: [{ mappingId: mapping.mappingId, version: mapping.version }],
      provenance: [
        {
          edgeId: `synthetic-fieldview-provenance-${document.documentId}`,
          fromRef: `${sourceProviderId}:FIELDVIEW_ACTIVITY_DOCUMENT:${document.documentId}`,
          toRef: 'cora-fieldview-synthetic-adapter',
          relation: 'ACQUIRED_VIA',
          sourceProviderId,
          acquisitionChannel: 'NATIVE_STRATEGIC_CONNECTOR',
          occurredAt: context.capturedAt,
        },
      ],
      limitations: [
        'Synthetic FieldView-shaped fixture only; not a provider runtime or live API integration',
        'FieldView route metadata remains bounded to the documented synthetic slice',
      ],
    },
    context.orgId,
    context.capturedAt,
  )

  const mapped = mapSourceCapture(capture, mapping, context.capturedAt)
  const mappingResult = applyBoundedFieldViewSemantics(mapped, document)
  const capsule = assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: `synthetic-fieldview-capsule-${document.documentId}`,
      orgId: context.orgId,
      purpose: context.purpose,
      createdAt: context.capturedAt,
      subjectRef: sourceRef,
      captures: [capture],
      mappings: [mapping],
      mappingResults: [mappingResult],
      limitations: [
        'Synthetic FieldView-shaped fixture only',
        'Source currentness and source-provider availability are not verified',
        'FieldView route metadata remains route-scoped evidence',
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
