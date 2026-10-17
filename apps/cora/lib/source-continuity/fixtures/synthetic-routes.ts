import type { AcquisitionChannel, SafeJsonValue, SemanticMapping } from '../contracts'
import { createSourceCapture } from '../capture'
import { computeSemanticMappingDigest } from '../semantic-mapping'

export const SYNTHETIC_ORG_ID = 'synthetic-org-001'
export const SYNTHETIC_PURPOSE = 'synthetic-continuity-conformance'
export const SYNTHETIC_RECIPIENT_ID = 'cora-synthetic-reader'
export const SYNTHETIC_TIME = '2026-02-10T12:00:00.000Z'
export const SYNTHETIC_SOURCE_PROVIDER_ID = 'synthetic-certification-source'

const routeDefinitions: Record<
  AcquisitionChannel,
  { path: string; intermediaryId?: string; acquisitionProviderId?: string; acreagePath?: string }
> = {
  NATIVE_STRATEGIC_CONNECTOR: {
    path: 'status',
    acquisitionProviderId: 'synthetic-native-adapter',
    acreagePath: 'acreage',
  },
  AGGREGATED_CONNECTOR: {
    path: 'organic.status',
    acquisitionProviderId: 'synthetic-aggregator',
    intermediaryId: 'synthetic-intermediary-001',
  },
  STANDARD_FILE_CONNECTOR: {
    path: 'certification_status',
    acquisitionProviderId: 'synthetic-file-parser',
    acreagePath: 'field_acres',
  },
  OPERATOR_IMPORT: {
    path: 'statusText',
    acquisitionProviderId: 'synthetic-operator-import',
    acreagePath: 'acres',
  },
}

export interface SyntheticRouteFixture {
  channel: AcquisitionChannel
  capture: ReturnType<typeof createSourceCapture>
  mapping: SemanticMapping
}

function setPayloadPath(
  payload: Record<string, SafeJsonValue>,
  path: string,
  value: SafeJsonValue,
): void {
  const segments = path.split('.')
  let current = payload

  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment]
    if (existing === undefined) {
      const child: Record<string, SafeJsonValue> = {}
      current[segment] = child
      current = child
      continue
    }
    if (existing === null || Array.isArray(existing) || typeof existing !== 'object') {
      throw new Error(`Synthetic payload path collides at ${segment}`)
    }
    current = existing
  }

  current[segments[segments.length - 1]!] = value
}

export function buildSyntheticRouteFixture(channel: AcquisitionChannel): SyntheticRouteFixture {
  const definition = routeDefinitions[channel]
  const payload: Record<string, SafeJsonValue> = {}
  setPayloadPath(payload, definition.path, 'active')
  if (definition.acreagePath) {
    setPayloadPath(payload, definition.acreagePath, 640)
  }

  const mappingBase = {
    mappingId: `synthetic-status-${channel.toLowerCase()}`,
    version: '1.0.0',
    authorityId: 'cora-synthetic-mapping-authority',
    sourceProviderId: SYNTHETIC_SOURCE_PROVIDER_ID,
    sourceSchemaVersion: 'synthetic-source-v1',
    fields: [
      {
        sourcePath: definition.path,
        canonicalField: 'certification.status',
        operation: 'ENUM_LOOKUP' as const,
        enumValues: { active: 'CERTIFIED' },
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: definition.acreagePath ?? 'acreage',
        canonicalField: 'land.acreage',
        operation: 'IDENTITY' as const,
        sourceUnit: 'acre',
        canonicalUnit: 'acre',
        required: false,
        declaredLosses: [],
      },
    ],
    limitations: ['Synthetic fixture; not a source-provider runtime proof'],
  }
  const mapping: SemanticMapping = {
    ...mappingBase,
    definitionSha256: computeSemanticMappingDigest(mappingBase),
  }

  const rights = {
    decisionRef: 'synthetic-rights-decision-001',
    decidedAt: SYNTHETIC_TIME,
    permittedPurposes: [SYNTHETIC_PURPOSE],
    permittedRecipients: [
      SYNTHETIC_RECIPIENT_ID,
      'synthetic-institution-alpha',
      'synthetic-institution-beta',
    ],
    revocationAuthorityIds: ['synthetic-operator-001'],
    sourceAccess: 'ALLOWED' as const,
    transientProcessing: 'ALLOWED' as const,
    persistence: 'ALLOWED' as const,
    transformation: 'ALLOWED' as const,
    disclosure: 'ALLOWED' as const,
    export: 'ALLOWED' as const,
    rehydration: 'ALLOWED' as const,
    deletion: 'ALLOWED' as const,
    retentionAfterDisconnect: 'ALLOWED' as const,
  }

  const capture = createSourceCapture(
    {
      captureId: `synthetic-capture-${channel.toLowerCase()}`,
      orgId: SYNTHETIC_ORG_ID,
      operatorId: 'synthetic-operator-001',
      sourceRef: {
        providerId: SYNTHETIC_SOURCE_PROVIDER_ID,
        objectType: 'CERTIFICATION_RECORD',
        objectId: 'synthetic-record-001',
        sourceVersion: 'synthetic-record-v1',
      },
      sourceAuthority: {
        authorityId: 'synthetic-certifier-001',
        authorityType: 'SOURCE_ISSUER',
        authorityObjectId: 'synthetic-certification-program',
      },
      acquisitionRoute: {
        channel,
        transport:
          channel === 'STANDARD_FILE_CONNECTOR' || channel === 'OPERATOR_IMPORT'
            ? 'FILE'
            : channel === 'AGGREGATED_CONNECTOR'
              ? 'AGGREGATOR_API'
              : 'API',
        ...(definition.acquisitionProviderId
          ? { acquisitionProviderId: definition.acquisitionProviderId }
          : {}),
        ...(definition.intermediaryId ? { intermediaryId: definition.intermediaryId } : {}),
      },
      sourceSchemaVersion: 'synthetic-source-v1',
      sourceObservedAt: '2026-02-10T11:55:00.000Z',
      capturedAt: SYNTHETIC_TIME,
      freshness: 'NOT_VERIFIED',
      purpose: SYNTHETIC_PURPOSE,
      recipientId: SYNTHETIC_RECIPIENT_ID,
      rights,
      payload,
      mappingRefs: [{ mappingId: mapping.mappingId, version: mapping.version }],
      provenance: [
        {
          edgeId: `synthetic-provenance-${channel.toLowerCase()}`,
          fromRef: 'synthetic-certifier-001',
          toRef: 'synthetic-certification-source:CERTIFICATION_RECORD:synthetic-record-001',
          relation: 'ASSERTED_BY',
          sourceAuthorityId: 'synthetic-certifier-001',
          sourceProviderId: SYNTHETIC_SOURCE_PROVIDER_ID,
          acquisitionChannel: channel,
          occurredAt: SYNTHETIC_TIME,
        },
      ],
      limitations: ['Synthetic data only'],
    },
    SYNTHETIC_ORG_ID,
    SYNTHETIC_TIME,
  )

  return { channel, capture, mapping }
}

export const ALL_SYNTHETIC_CHANNELS: AcquisitionChannel[] = [
  'NATIVE_STRATEGIC_CONNECTOR',
  'AGGREGATED_CONNECTOR',
  'STANDARD_FILE_CONNECTOR',
  'OPERATOR_IMPORT',
]
