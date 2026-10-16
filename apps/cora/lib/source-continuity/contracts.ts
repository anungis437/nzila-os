import { z } from 'zod'

export const acquisitionChannelSchema = z.enum([
  'NATIVE_STRATEGIC_CONNECTOR',
  'AGGREGATED_CONNECTOR',
  'STANDARD_FILE_CONNECTOR',
  'OPERATOR_IMPORT',
])

export const transportSchema = z.enum(['API', 'AGGREGATOR_API', 'FILE', 'MANUAL', 'OTHER'])

export const rightStateSchema = z.enum([
  'ALLOWED',
  'ALLOWED_WITH_CONDITIONS',
  'DENIED',
  'UNKNOWN',
  'EXPIRED',
])

export const freshnessStateSchema = z.enum(['CURRENT', 'STALE', 'UNKNOWN', 'NOT_VERIFIED'])

const sensitiveKeyPattern =
  /token|secret|password|credential|private.?key|cookie|authorizationheader/i

export const safeJsonValueSchema: z.ZodType<
  string | number | boolean | null | SafeJsonValue[] | { [key: string]: SafeJsonValue }
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(safeJsonValueSchema),
    z.record(z.string(), safeJsonValueSchema).superRefine((value, context) => {
      for (const key of Object.keys(value)) {
        if (sensitiveKeyPattern.test(key)) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'Sensitive credential-like fields are not permitted',
          })
        }
      }
    }),
  ]),
)

export type SafeJsonValue =
  | string
  | number
  | boolean
  | null
  | SafeJsonValue[]
  | { [key: string]: SafeJsonValue }

export const namespacedSourceRefSchema = z
  .object({
    providerId: z.string().min(1),
    objectType: z.string().min(1),
    objectId: z.string().min(1),
    sourceVersion: z.string().min(1).optional(),
  })
  .strict()

export const sourceAuthorityRefSchema = z
  .object({
    authorityId: z.string().min(1),
    authorityType: z.enum(['SOURCE_ISSUER', 'SOURCE_PROVIDER', 'OPERATOR', 'INTERMEDIARY']),
    authorityObjectId: z.string().min(1).optional(),
  })
  .strict()

export const acquisitionRouteSchema = z
  .object({
    channel: acquisitionChannelSchema,
    transport: transportSchema,
    acquisitionProviderId: z.string().min(1).optional(),
    intermediaryId: z.string().min(1).optional(),
  })
  .strict()

export const rightsSnapshotSchema = z
  .object({
    decisionRef: z.string().min(1),
    decidedAt: z.string().datetime(),
    validFrom: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    revokedAt: z.string().datetime().optional(),
    permittedPurposes: z.array(z.string().min(1)).min(1),
    permittedRecipients: z.array(z.string().min(1)).min(1),
    revocationAuthorityIds: z.array(z.string().min(1)).min(1),
    sourceAccess: rightStateSchema,
    transientProcessing: rightStateSchema,
    persistence: rightStateSchema,
    transformation: rightStateSchema,
    disclosure: rightStateSchema,
    export: rightStateSchema,
    rehydration: rightStateSchema,
    deletion: rightStateSchema,
    retentionAfterDisconnect: rightStateSchema,
  })
  .strict()
  .superRefine((rights, context) => {
    if (
      rights.validFrom &&
      rights.expiresAt &&
      Date.parse(rights.validFrom) > Date.parse(rights.expiresAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['validFrom'],
        message: 'validFrom must not be later than expiresAt',
      })
    }
  })

export const provenanceEdgeSchema = z
  .object({
    edgeId: z.string().min(1),
    fromRef: z.string().min(1),
    toRef: z.string().min(1),
    relation: z.enum([
      'ASSERTED_BY',
      'OBSERVED_FROM',
      'ACQUIRED_VIA',
      'MAPPED_TO',
      'IDENTIFIED_AS',
      'PACKAGED_AS',
    ]),
    sourceAuthorityId: z.string().min(1).optional(),
    sourceProviderId: z.string().min(1),
    acquisitionChannel: acquisitionChannelSchema,
    occurredAt: z.string().datetime(),
  })
  .strict()

const sourceCaptureBaseSchema = z
  .object({
    captureId: z.string().min(1),
    orgId: z.string().min(1),
    operatorId: z.string().min(1),
    sourceRef: namespacedSourceRefSchema,
    sourceAuthority: sourceAuthorityRefSchema,
    acquisitionRoute: acquisitionRouteSchema,
    sourceSchemaVersion: z.string().min(1),
    sourceObservedAt: z.string().datetime().optional(),
    capturedAt: z.string().datetime(),
    currentlyVerifiedAt: z.string().datetime().optional(),
    freshness: freshnessStateSchema,
    purpose: z.string().min(1),
    recipientId: z.string().min(1),
    rights: rightsSnapshotSchema,
    payload: safeJsonValueSchema,
    mappingRefs: z
      .array(
        z
          .object({
            mappingId: z.string().min(1),
            version: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    provenance: z.array(provenanceEdgeSchema).min(1),
    limitations: z.array(z.string().min(1)).default([]),
  })
  .strict()

function requireFreshnessEvidence(
  capture: { freshness: FreshnessState; currentlyVerifiedAt?: string },
  context: z.RefinementCtx,
): void {
  if (capture.freshness === 'CURRENT' && !capture.currentlyVerifiedAt) {
    context.addIssue({
      code: 'custom',
      path: ['currentlyVerifiedAt'],
      message: 'CURRENT freshness requires an explicit verification timestamp',
    })
  }
}

export const sourceCaptureDraftSchema =
  sourceCaptureBaseSchema.superRefine(requireFreshnessEvidence)

export const sourceCaptureSchema = sourceCaptureBaseSchema
  .extend({
    integritySha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .superRefine(requireFreshnessEvidence)

export const identityCandidateSchema = z
  .object({
    providerId: z.string().min(1),
    objectType: z.string().min(1),
    objectId: z.string().min(1),
    authorityId: z.string().min(1),
  })
  .strict()

export const identityResolutionSchema = z
  .object({
    resolutionId: z.string().min(1),
    orgId: z.string().min(1),
    outcome: z.enum(['MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'CONFLICT']),
    candidates: z.array(identityCandidateSchema),
    canonicalIdentityId: z.string().min(1).optional(),
    bindingEvidenceRef: z.string().min(1).optional(),
    methodRef: z.string().min(1),
    resolvedAt: z.string().datetime(),
    limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((resolution, context) => {
    if (
      resolution.outcome === 'MATCHED' &&
      (resolution.candidates.length !== 1 ||
        !resolution.canonicalIdentityId ||
        !resolution.bindingEvidenceRef)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message:
          'MATCHED requires one candidate, canonical identity, and explicit binding evidence',
      })
    }

    if (
      resolution.outcome === 'AMBIGUOUS' &&
      (resolution.candidates.length < 2 || resolution.canonicalIdentityId)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'AMBIGUOUS requires multiple candidates and no canonical identity',
      })
    }

    if (resolution.outcome === 'UNMATCHED' && resolution.canonicalIdentityId) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'UNMATCHED requires no candidates and no canonical identity',
      })
    }

    if (
      resolution.outcome === 'CONFLICT' &&
      (resolution.candidates.length < 2 || resolution.canonicalIdentityId)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'CONFLICT requires multiple candidates and no canonical identity',
      })
    }
  })

export const semanticMappingFieldSchema = z
  .object({
    sourcePath: z.string().min(1),
    canonicalField: z.string().min(1),
    operation: z.enum(['IDENTITY', 'ENUM_LOOKUP', 'UNIT_CONVERSION']),
    sourceUnit: z.string().min(1).optional(),
    canonicalUnit: z.string().min(1).optional(),
    enumValues: z.record(z.string(), safeJsonValueSchema).optional(),
    unitConversion: z
      .object({
        transformationId: z.string().min(1),
        version: z.string().min(1),
        scale: z
          .number()
          .finite()
          .refine((value) => value !== 0),
        offset: z.number().finite(),
        evidenceRef: z.string().min(1),
      })
      .strict()
      .optional(),
    required: z.boolean(),
    declaredLosses: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.operation === 'ENUM_LOOKUP' && !field.enumValues) {
      context.addIssue({
        code: 'custom',
        path: ['enumValues'],
        message: 'ENUM_LOOKUP requires an explicit enum mapping',
      })
    }

    if (field.operation === 'UNIT_CONVERSION') {
      if (
        !field.unitConversion ||
        !field.sourceUnit ||
        !field.canonicalUnit ||
        field.sourceUnit === field.canonicalUnit
      ) {
        context.addIssue({
          code: 'custom',
          path: ['unitConversion'],
          message:
            'UNIT_CONVERSION requires a conversion definition and distinct source and canonical units',
        })
      }
    } else if (field.unitConversion) {
      context.addIssue({
        code: 'custom',
        path: ['unitConversion'],
        message: 'unitConversion is only valid with UNIT_CONVERSION',
      })
    }

    if (
      field.operation === 'IDENTITY' &&
      field.sourceUnit !== field.canonicalUnit &&
      (field.sourceUnit !== undefined || field.canonicalUnit !== undefined)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['canonicalUnit'],
        message: 'IDENTITY mappings cannot change units',
      })
    }
  })

export const semanticMappingSchema = z
  .object({
    mappingId: z.string().min(1),
    version: z.string().min(1),
    authorityId: z.string().min(1),
    sourceProviderId: z.string().min(1),
    sourceSchemaVersion: z.string().min(1),
    fields: z.array(semanticMappingFieldSchema).min(1),
    definitionSha256: z.string().regex(/^[a-f0-9]{64}$/),
    limitations: z.array(z.string().min(1)),
  })
  .strict()

export type AcquisitionChannel = z.infer<typeof acquisitionChannelSchema>
export type Transport = z.infer<typeof transportSchema>
export type RightState = z.infer<typeof rightStateSchema>
export type FreshnessState = z.infer<typeof freshnessStateSchema>
export type NamespacedSourceRef = z.infer<typeof namespacedSourceRefSchema>
export type SourceAuthorityRef = z.infer<typeof sourceAuthorityRefSchema>
export type AcquisitionRoute = z.infer<typeof acquisitionRouteSchema>
export type RightsSnapshot = z.infer<typeof rightsSnapshotSchema>
export type ProvenanceEdge = z.infer<typeof provenanceEdgeSchema>
export type SourceCaptureDraft = z.infer<typeof sourceCaptureDraftSchema>
export type SourceCapture = z.infer<typeof sourceCaptureSchema>
export type IdentityCandidate = z.infer<typeof identityCandidateSchema>
export type IdentityResolution = z.infer<typeof identityResolutionSchema>
export type SemanticMappingField = z.infer<typeof semanticMappingFieldSchema>
export type SemanticMapping = z.infer<typeof semanticMappingSchema>
