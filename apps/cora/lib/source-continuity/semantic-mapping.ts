import {
  acquisitionChannelSchema,
  safeJsonValueSchema,
  semanticMappingSchema,
  type SafeJsonValue,
  type SemanticMapping,
  type SemanticMappingField,
  type SourceCapture,
} from './contracts'
import { sha256Canonical } from './integrity'
import { evaluateRights } from './rights'
import { verifySourceCaptureIntegrity } from './capture'
import { z } from 'zod'

export const mappedFieldSchema = z
  .object({
    sourcePath: z.string().min(1),
    canonicalField: z.string().min(1),
    sourceValue: safeJsonValueSchema.optional(),
    canonicalValue: safeJsonValueSchema.optional(),
    sourceUnit: z.string().min(1).optional(),
    canonicalUnit: z.string().min(1).optional(),
    state: z.enum(['MAPPED', 'MISSING', 'UNMAPPED']),
    losses: z.array(z.string().min(1)),
    transformationEvidence: z
      .object({
        transformationId: z.string().min(1),
        version: z.string().min(1),
        evidenceRef: z.string().min(1),
        scale: z.number().finite(),
        offset: z.number().finite(),
        sourceValue: z.number().finite(),
        sourceUnit: z.string().min(1),
        transformedValue: z.number().finite(),
        canonicalUnit: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict()

export const semanticMappingEvidenceSchema = z
  .object({
    kind: z.enum([
      'IDENTITY_INTERPRETATION',
      'TEMPORAL_INTERPRETATION',
      'SEMANTIC_LOSS',
      'MAPPING_LIMITATION',
    ]),
    sourcePath: z.string().min(1).optional(),
    evidenceRef: z.string().min(1),
    details: safeJsonValueSchema,
  })
  .strict()

export const semanticMappingResultSchema = z
  .object({
    captureId: z.string().min(1),
    mappingId: z.string().min(1),
    mappingVersion: z.string().min(1),
    sourceProviderId: z.string().min(1),
    acquisitionChannel: acquisitionChannelSchema,
    fields: z.array(mappedFieldSchema),
    evidence: z.array(semanticMappingEvidenceSchema),
    limitations: z.array(z.string().min(1)),
  })
  .strict()

export type MappedField = z.infer<typeof mappedFieldSchema>
export type SemanticMappingEvidence = z.infer<typeof semanticMappingEvidenceSchema>
export type SemanticMappingResult = z.infer<typeof semanticMappingResultSchema>

export function computeSemanticMappingDigest(
  input: Omit<SemanticMapping, 'definitionSha256'>,
): string {
  return sha256Canonical(input)
}

export function verifySemanticMapping(mapping: SemanticMapping): boolean {
  const parsed = semanticMappingSchema.parse(mapping)
  const { definitionSha256, ...definition } = parsed
  return computeSemanticMappingDigest(definition) === definitionSha256
}

function readPath(payload: SafeJsonValue, path: string): SafeJsonValue | undefined {
  let current: SafeJsonValue | undefined = payload
  for (const part of path.split('.')) {
    if (
      current === null ||
      Array.isArray(current) ||
      typeof current !== 'object' ||
      !(part in current)
    ) {
      return undefined
    }
    current = current[part]
  }
  return current
}

function mapField(field: SemanticMappingField, payload: SafeJsonValue): MappedField {
  const sourceValue = readPath(payload, field.sourcePath)
  if (sourceValue === undefined || sourceValue === null) {
    return {
      sourcePath: field.sourcePath,
      canonicalField: field.canonicalField,
      ...(field.sourceUnit !== undefined ? { sourceUnit: field.sourceUnit } : {}),
      ...(field.canonicalUnit !== undefined ? { canonicalUnit: field.canonicalUnit } : {}),
      state: field.required ? 'MISSING' : 'UNMAPPED',
      losses: [...field.declaredLosses, 'SOURCE_VALUE_UNAVAILABLE'],
    }
  }

  if (field.operation === 'IDENTITY') {
    return {
      sourcePath: field.sourcePath,
      canonicalField: field.canonicalField,
      sourceValue,
      canonicalValue: sourceValue,
      ...(field.sourceUnit !== undefined ? { sourceUnit: field.sourceUnit } : {}),
      ...(field.canonicalUnit !== undefined ? { canonicalUnit: field.canonicalUnit } : {}),
      state: 'MAPPED',
      losses: [...field.declaredLosses],
    }
  }

  const lookupKey =
    typeof sourceValue === 'string' ||
    typeof sourceValue === 'number' ||
    typeof sourceValue === 'boolean'
      ? String(sourceValue)
      : undefined

  if (field.operation === 'UNIT_CONVERSION') {
    if (
      typeof sourceValue !== 'number' ||
      !field.unitConversion ||
      !field.sourceUnit ||
      !field.canonicalUnit
    ) {
      return {
        sourcePath: field.sourcePath,
        canonicalField: field.canonicalField,
        sourceValue,
        ...(field.sourceUnit !== undefined ? { sourceUnit: field.sourceUnit } : {}),
        ...(field.canonicalUnit !== undefined ? { canonicalUnit: field.canonicalUnit } : {}),
        state: 'UNMAPPED',
        losses: [...field.declaredLosses, 'UNIT_CONVERSION_REQUIRES_NUMERIC_VALUE'],
      }
    }

    const { unitConversion } = field
    const transformedValue = sourceValue * unitConversion.scale + unitConversion.offset
    if (!Number.isFinite(transformedValue)) {
      return {
        sourcePath: field.sourcePath,
        canonicalField: field.canonicalField,
        sourceValue,
        ...(field.sourceUnit !== undefined ? { sourceUnit: field.sourceUnit } : {}),
        ...(field.canonicalUnit !== undefined ? { canonicalUnit: field.canonicalUnit } : {}),
        state: 'UNMAPPED',
        losses: [...field.declaredLosses, 'UNIT_CONVERSION_RESULT_NOT_FINITE'],
      }
    }

    return {
      sourcePath: field.sourcePath,
      canonicalField: field.canonicalField,
      sourceValue,
      canonicalValue: transformedValue,
      sourceUnit: field.sourceUnit,
      canonicalUnit: field.canonicalUnit,
      state: 'MAPPED',
      losses: [...field.declaredLosses],
      transformationEvidence: {
        transformationId: unitConversion.transformationId,
        version: unitConversion.version,
        evidenceRef: unitConversion.evidenceRef,
        scale: unitConversion.scale,
        offset: unitConversion.offset,
        sourceValue,
        sourceUnit: field.sourceUnit,
        transformedValue,
        canonicalUnit: field.canonicalUnit,
      },
    }
  }

  const canonicalValue = lookupKey === undefined ? undefined : field.enumValues?.[lookupKey]

  if (canonicalValue === undefined) {
    return {
      sourcePath: field.sourcePath,
      canonicalField: field.canonicalField,
      sourceValue,
      ...(field.sourceUnit !== undefined ? { sourceUnit: field.sourceUnit } : {}),
      ...(field.canonicalUnit !== undefined ? { canonicalUnit: field.canonicalUnit } : {}),
      state: 'UNMAPPED',
      losses: [...field.declaredLosses, 'ENUM_VALUE_NOT_MAPPED'],
    }
  }

  return {
    sourcePath: field.sourcePath,
    canonicalField: field.canonicalField,
    sourceValue,
    canonicalValue,
    ...(field.sourceUnit !== undefined ? { sourceUnit: field.sourceUnit } : {}),
    ...(field.canonicalUnit !== undefined ? { canonicalUnit: field.canonicalUnit } : {}),
    state: 'MAPPED',
    losses: [...field.declaredLosses],
  }
}

export function mapSourceCapture(
  capture: SourceCapture,
  inputMapping: SemanticMapping,
  evaluatedAt: string,
): SemanticMappingResult {
  if (!verifySourceCaptureIntegrity(capture)) {
    throw new Error('Source capture integrity verification failed before mapping')
  }
  const mapping = semanticMappingSchema.parse(inputMapping)
  if (!verifySemanticMapping(mapping)) {
    throw new Error('Semantic mapping definition integrity verification failed')
  }
  if (mapping.sourceProviderId !== capture.sourceRef.providerId) {
    throw new Error('Semantic mapping provider does not match source provider')
  }
  if (mapping.sourceSchemaVersion !== capture.sourceSchemaVersion) {
    throw new Error('Semantic mapping source schema version does not match capture')
  }
  if (
    !capture.mappingRefs.some(
      (reference) =>
        reference.mappingId === mapping.mappingId && reference.version === mapping.version,
    )
  ) {
    throw new Error('Capture does not reference this immutable mapping version')
  }

  const rights = evaluateRights(capture.rights, 'TRANSFORM', {
    purpose: capture.purpose,
    recipientId: capture.recipientId,
    at: evaluatedAt,
  })
  if (!rights.allowed) {
    throw new Error(`Mapping is not authorized: ${rights.reasons.join(', ')}`)
  }

  return {
    captureId: capture.captureId,
    mappingId: mapping.mappingId,
    mappingVersion: mapping.version,
    sourceProviderId: capture.sourceRef.providerId,
    acquisitionChannel: capture.acquisitionRoute.channel,
    fields: mapping.fields.map((field) => mapField(field, capture.payload)),
    evidence: [],
    limitations: [...mapping.limitations],
  }
}
