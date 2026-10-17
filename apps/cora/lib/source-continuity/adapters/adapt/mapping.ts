import type { SemanticMapping } from '../../contracts'
import { computeSemanticMappingDigest } from '../../semantic-mapping'

export const ADAPT_MAPPING_ID = 'cora-adapt-land-operation'
export const ADAPT_MAPPING_VERSION = '1.0.0'
export const ADAPT_FIXTURE_SCHEMA_PREFIX = 'adapt-adm-3.1.0-cora-fixture-v1'
export const HECTARES_TO_ACRES = 2.471053814671653
export const ADAPT_UNIT_TRANSFORMATION_ID = 'hectare-to-acre'
export const ADAPT_UNIT_TRANSFORMATION_VERSION = '1.0.0'

export function buildAdaptMapping(
  sourceProviderId: string,
  areaUnit: 'ha' | 'acre' | undefined,
  measurementUnit: string,
): SemanticMapping {
  const areaField =
    areaUnit === 'ha'
      ? {
          sourcePath: 'field.area.value',
          canonicalField: 'land.field.area',
          operation: 'UNIT_CONVERSION' as const,
          sourceUnit: 'ha',
          canonicalUnit: 'acre',
          unitConversion: {
            transformationId: ADAPT_UNIT_TRANSFORMATION_ID,
            version: ADAPT_UNIT_TRANSFORMATION_VERSION,
            scale: HECTARES_TO_ACRES,
            offset: 0,
            evidenceRef: 'CORA_ADAPT_MAPPING_CONTRACT.md#unit-conversion',
          },
          required: false,
          declaredLosses: [],
        }
      : {
          sourcePath: 'field.area.value',
          canonicalField: 'land.field.area',
          operation: 'IDENTITY' as const,
          ...(areaUnit !== undefined ? { sourceUnit: areaUnit, canonicalUnit: areaUnit } : {}),
          required: false,
          declaredLosses: [],
        }

  const definition = {
    mappingId: ADAPT_MAPPING_ID,
    version: ADAPT_MAPPING_VERSION,
    authorityId: 'cora-adapt-mapping-authority',
    sourceProviderId,
    sourceSchemaVersion: ADAPT_FIXTURE_SCHEMA_PREFIX,
    fields: [
      {
        sourcePath: 'farm.id.referenceId',
        canonicalField: 'land.farm.sourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: false,
        declaredLosses: [],
      },
      {
        sourcePath: 'field.id.referenceId',
        canonicalField: 'land.field.sourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: false,
        declaredLosses: [],
      },
      {
        sourcePath: 'field.farmId',
        canonicalField: 'land.field.farmSourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: false,
        declaredLosses: [],
      },
      {
        sourcePath: 'boundary.fieldId',
        canonicalField: 'land.boundary.fieldSourceLocalReferenceId',
        operation: 'IDENTITY' as const,
        required: false,
        declaredLosses: [],
      },
      areaField,
      {
        sourcePath: 'operation.operationType',
        canonicalField: 'agriculture.operation.type',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'operation.measurement.value',
        canonicalField: 'agriculture.operation.measurement.value',
        operation: 'IDENTITY' as const,
        sourceUnit: measurementUnit,
        canonicalUnit: measurementUnit,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'operation.measurement.unit',
        canonicalField: 'agriculture.operation.measurement.unit',
        operation: 'IDENTITY' as const,
        required: true,
        declaredLosses: [],
      },
      {
        sourcePath: 'operation.timeScope.timeStamp1',
        canonicalField: 'agriculture.operation.timeValue',
        operation: 'IDENTITY' as const,
        required: false,
        declaredLosses: [],
      },
    ],
    limitations: [
      'ADAPT local reference IDs are not Cora-wide identities',
      'The Cora fixture envelope is not an official ADAPT serialization format',
      'The mapping covers one synthetic land and operation slice only',
    ],
  }

  return {
    ...definition,
    definitionSha256: computeSemanticMappingDigest(definition),
  }
}
