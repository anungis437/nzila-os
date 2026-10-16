import type { SemanticMapping } from '../../contracts'
import { computeSemanticMappingDigest } from '../../semantic-mapping'

export const FIELDVIEW_MAPPING_ID = 'cora-fieldview-land-activity'
export const FIELDVIEW_MAPPING_VERSION = '1.0.0'
export const FIELDVIEW_FIXTURE_SCHEMA_PREFIX = 'fieldview-v4.0.11-cora-fixture-v1'

export function buildFieldViewMapping(sourceProviderId: string): SemanticMapping {
  const definition = {
    mappingId: FIELDVIEW_MAPPING_ID,
    version: FIELDVIEW_MAPPING_VERSION,
    authorityId: 'cora-fieldview-mapping-authority',
    sourceProviderId,
    sourceSchemaVersion: FIELDVIEW_FIXTURE_SCHEMA_PREFIX,
    fields: [
      {
        sourcePath: 'farm.guid',
        canonicalField: 'land.farm.sourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'field.guid',
        canonicalField: 'land.field.sourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'field.farmGuid',
        canonicalField: 'land.field.farmSourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'boundary.fieldGuid',
        canonicalField: 'land.boundary.fieldSourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'field.area.value',
        canonicalField: 'land.field.area',
        operation: 'IDENTITY' as const,
        sourceUnit: 'acre',
        canonicalUnit: 'acre',
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'boundary.geometry',
        canonicalField: 'land.boundary.geometry',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'activity.activityType',
        canonicalField: 'agriculture.operation.type',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'activity.measuredRate.value',
        canonicalField: 'agriculture.operation.measurement.value',
        operation: 'IDENTITY' as const,
        sourceUnit: 'kg/ha',
        canonicalUnit: 'kg/ha',
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'activity.measuredRate.unit',
        canonicalField: 'agriculture.operation.measurement.unit',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'activity.effectiveAt',
        canonicalField: 'agriculture.operation.effectiveAt',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'activity.observedAt',
        canonicalField: 'agriculture.operation.observedAt',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
    ],
    limitations: [
      'FieldView GUIDs remain provider-local and are never Cora-wide identities',
      'The Cora fixture envelope is not an official FieldView export or API payload',
      'The mapping covers one synthetic land and activity slice only',
    ],
  }

  return {
    ...definition,
    definitionSha256: computeSemanticMappingDigest(definition),
  }
}
