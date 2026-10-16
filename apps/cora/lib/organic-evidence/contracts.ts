import { z } from 'zod'

export const organicCertificationFactClasses = [
  'organic.certification.status',
  'organic.certification.certifier',
  'organic.certification.program',
  'organic.certification.scope',
  'organic.certification.product',
  'organic.certification.issue_date',
  'organic.certification.validity',
  'organic.certification.standard',
  'organic.certification.standard_version',
] as const

export const organicSourceInstitutionRoles = [
  'SCHEME_AUTHORITY',
  'CONFORMITY_VERIFICATION_BODY',
  'CERTIFICATION_BODY',
  'CERTIFICATION_PROGRAM',
  'EVIDENCE_AGGREGATOR',
  'STANDARD_INTERPRETATION_AUTHORITY',
  'SECTOR_CONVENOR',
  'MARKET_INTELLIGENCE_PUBLISHER',
] as const

export const organicStatusConcepts = [
  'CERTIFIED',
  'SUSPENDED',
  'CANCELLED',
  'REVOKED',
  'DENIED',
  'WITHDRAWN',
  'PRE_CERTIFIED',
] as const

const organicSourceInstitutionRoleSchema = z.enum(organicSourceInstitutionRoles)
const organicCertificationFactClassSchema = z.enum(organicCertificationFactClasses)
const organicStatusConceptSchema = z.enum(organicStatusConcepts)

const organicProvenanceEdgeSchema = z
  .object({
    fromInstitutionId: z.string().min(1),
    fromRole: organicSourceInstitutionRoleSchema,
    relationship: z.enum(['accredits', 'certifies', 'publishes', 'aggregates', 'interprets']),
    toInstitutionId: z.string().min(1),
    toRole: organicSourceInstitutionRoleSchema,
    evidenceRef: z.string().min(1),
  })
  .strict()

const organicObservationTimeSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('KNOWN'),
      observedAt: z.string().datetime(),
    })
    .strict(),
  z.object({ state: z.literal('UNKNOWN') }).strict(),
  z
    .object({
      state: z.literal('INVALID'),
      rawTimestamp: z.string(),
    })
    .strict(),
])

const organicSourcePublicationAuthoritySchema = z
  .object({
    state: z.enum(['ESTABLISHED', 'NOT_ESTABLISHED', 'UNKNOWN']),
    basis: z.enum([
      'REGULATORY_PUBLICATION_MANDATE',
      'SOURCE_SELF_PUBLICATION',
      'VOLUNTARY_PUBLICATION',
      'UNKNOWN',
    ]),
    evidenceRef: z.string().min(1).optional(),
  })
  .strict()

const organicRightsStateSchema = z.enum([
  'ESTABLISHED',
  'ESTABLISHED_ALLOWED',
  'ESTABLISHED_PROHIBITED',
  'NOT_ESTABLISHED',
  'REQUIRES_CONFIRMATION',
  'NOT_APPLICABLE',
  'UNKNOWN',
  'DENIED',
])

const organicEvidenceLevelSchema = z.enum(['DIRECTORY_STATUS', 'CERTIFICATE'])

const organicCertificationContextSchema = z
  .object({
    program: z.string().min(1).optional(),
    scope: z.array(z.string().min(1)).optional(),
    products: z.array(z.string().min(1)).optional(),
  })
  .strict()

const organicSourceRecordMetadataSchema = z
  .object({
    registryRef: z.string().min(1),
    sourceCreatedAt: z.string().nullable().optional(),
    sourceUpdatedAt: z.string().nullable().optional(),
  })
  .strict()

export const organicSourceRightsSchema = z
  .object({
    publicationAuthority: organicSourcePublicationAuthoritySchema,
    sourceAccessMethod: z.enum(['PUBLIC_WEB', 'MANUAL_REQUEST', 'API', 'BULK_FILE', 'UNKNOWN']),
    automatedAccess: organicRightsStateSchema,
    reuseRights: organicRightsStateSchema,
    republicationRights: organicRightsStateSchema,
    termsReference: z.string().min(1).optional(),
    lastLegalTermsReviewAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((rights, context) => {
    if (
      rights.publicationAuthority.state === 'ESTABLISHED' &&
      !rights.publicationAuthority.evidenceRef
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicationAuthority', 'evidenceRef'],
        message: 'Established publication authority requires a supporting evidence reference',
      })
    }
  })

const organicNormalizationSchema = z
  .object({
    status: organicStatusConceptSchema,
    authorityId: z.string().min(1),
    mappingId: z.string().min(1),
    version: z.string().min(1),
  })
  .strict()

export const organicCertificationObservationSchema = z
  .object({
    evidenceId: z.string().min(1),
    factClass: organicCertificationFactClassSchema,
    subject: z
      .object({
        operatorRef: z.string().min(1),
      })
      .strict(),
    source: z
      .object({
        institutionId: z.string().min(1),
        role: z.enum(['SCHEME_AUTHORITY', 'CERTIFICATION_BODY', 'EVIDENCE_AGGREGATOR']),
        system: z.string().min(1),
        reference: z.string().min(1),
        uri: z.string().url().optional(),
      })
      .strict(),
    rawStatus: z.string().min(1).optional(),
    rawValue: z.string().min(1).optional(),
    normalizedStatus: organicNormalizationSchema.optional(),
    evidenceLevel: organicEvidenceLevelSchema.optional(),
    certificationContext: organicCertificationContextSchema.optional(),
    sourceRecordMetadata: organicSourceRecordMetadataSchema.optional(),
    observationTime: organicObservationTimeSchema,
    sourcePublishedAt: z.string().datetime().optional(),
    sourceAvailability: z.enum(['AVAILABLE', 'UNAVAILABLE']),
    freshness: z.enum([
      'CURRENT',
      'STALE',
      'SOURCE_UNAVAILABLE',
      'OBSERVATION_TIME_UNKNOWN',
      'INVALID_OBSERVATION_TIME',
      'FUTURE_OBSERVATION_TIME',
      'FRESHNESS_POLICY_UNSET',
    ]),
    standard: z
      .object({
        identifier: z.string().min(1),
        version: z.string().min(1).optional(),
        effectiveDate: z.string().date().optional(),
        transitionState: z.enum(['CURRENT', 'TRANSITIONAL', 'SUPERSEDED', 'UNKNOWN']).optional(),
      })
      .strict()
      .optional(),
    provenance: z.array(organicProvenanceEdgeSchema),
    rights: organicSourceRightsSchema,
    evidenceSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()
  .superRefine((observation, context) => {
    if (
      observation.source.system === 'pro-cert-client-directory' &&
      observation.evidenceLevel !== 'DIRECTORY_STATUS'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidenceLevel'],
        message: 'Pro-Cert directory observations are directory evidence, not certificates',
      })
    }

    if (
      observation.sourceAvailability === 'AVAILABLE' &&
      observation.factClass === 'organic.certification.status' &&
      !observation.rawStatus
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rawStatus'],
        message:
          'An available certification-status observation must preserve its raw source status',
      })
    }

    if (
      observation.sourceAvailability === 'AVAILABLE' &&
      observation.factClass !== 'organic.certification.status' &&
      !observation.rawValue
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rawValue'],
        message: 'An available non-status observation must preserve its raw source value',
      })
    }

    if (
      observation.sourceAvailability === 'UNAVAILABLE' &&
      (observation.rawStatus || observation.rawValue)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rawStatus'],
        message: 'An unavailable source cannot supply a source value',
      })
    }

    if (observation.normalizedStatus && !observation.rawStatus) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['normalizedStatus'],
        message: 'A normalized status must retain its original raw status',
      })
    }

    if (observation.normalizedStatus && observation.factClass !== 'organic.certification.status') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['normalizedStatus'],
        message: 'Only certification-status observations can carry a normalized status',
      })
    }

    if (observation.source.role === 'EVIDENCE_AGGREGATOR') {
      const hasCertifierOrigin = observation.provenance.some(
        (edge) =>
          edge.relationship === 'aggregates' &&
          edge.fromRole === 'CERTIFICATION_BODY' &&
          edge.toInstitutionId === observation.source.institutionId &&
          edge.toRole === 'EVIDENCE_AGGREGATOR',
      )
      if (!hasCertifierOrigin) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['provenance'],
          message:
            'Aggregator observations must retain a provenance edge from the certification body',
        })
      }
    }

    if (
      observation.sourceAvailability === 'UNAVAILABLE' &&
      observation.freshness !== 'SOURCE_UNAVAILABLE'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['freshness'],
        message: 'Unavailable sources must be represented as SOURCE_UNAVAILABLE',
      })
    }
  })

export const organicStatusNormalizationMappingSchema = z
  .object({
    rawStatus: z.string().min(1),
    normalizedStatus: organicStatusConceptSchema,
    authorityId: z.string().min(1),
    mappingId: z.string().min(1),
    version: z.string().min(1),
  })
  .strict()

export const organicFreshnessStates = [
  'CURRENT',
  'STALE',
  'SOURCE_UNAVAILABLE',
  'OBSERVATION_TIME_UNKNOWN',
  'INVALID_OBSERVATION_TIME',
  'FUTURE_OBSERVATION_TIME',
  'FRESHNESS_POLICY_UNSET',
] as const

export const organicConflictStates = [
  'NO_EVIDENCE',
  'CONSISTENT',
  'CONFLICTING_AUTHORITIES',
  'CONFLICTING_OBSERVATIONS',
  'STALE_SOURCE',
  'SOURCE_UNAVAILABLE',
  'UNRESOLVED_SEMANTICS',
  'UNRESOLVED_FRESHNESS',
] as const

export const organicSourceRegistryEntrySchema = z
  .object({
    institutionId: z.string().min(1),
    institutionName: z.string().min(1),
    roles: z.array(organicSourceInstitutionRoleSchema).min(1),
    sourceClass: z.string().min(1),
    sourceUrl: z.string().url(),
    rights: organicSourceRightsSchema,
    exposedDataClasses: z.array(z.string().min(1)),
    expectedRefreshMetadata: z
      .object({
        sourceClaim: z.string().min(1).optional(),
        checkedAt: z.string().datetime().optional(),
      })
      .strict(),
  })
  .strict()

export const organicStandardReferenceSchema = z
  .object({
    identifier: z.string().min(1),
    version: z.string().min(1).optional(),
    effectiveDate: z.string().date().optional(),
    transitionState: z.enum(['CURRENT', 'TRANSITIONAL', 'SUPERSEDED', 'UNKNOWN']).optional(),
    sourceRef: z.string().min(1),
  })
  .strict()

export const organicStandardInterpretationSchema = z
  .object({
    interpretationId: z.string().min(1),
    kind: z.literal('STANDARD_INTERPRETATION'),
    authorityInstitutionId: z.string().min(1),
    standard: organicStandardReferenceSchema,
    reference: z.string().min(1),
    effectiveAt: z.string().datetime().optional(),
  })
  .strict()

export const organicSectorMembershipEvidenceSchema = z
  .object({
    membershipEvidenceId: z.string().min(1),
    institutionId: z.string().min(1),
    institutionRole: z.enum(['SECTOR_CONVENOR', 'MARKET_INTELLIGENCE_PUBLISHER']),
    memberRef: z.string().min(1),
    sourceRef: z.string().min(1),
    observedAt: z.string().datetime().optional(),
  })
  .strict()

export const organicRecipientDispositionSchema = z
  .object({
    recipientInstitutionId: z.string().min(1),
    recipientOrganizationId: z.string().min(1),
    recipientRole: z.string().min(1),
    disposition: z.enum(['ACCEPTED', 'REJECTED', 'REQUIRES_VERIFICATION', 'UNDECIDED']),
    decidedAt: z.string().datetime().optional(),
    evidenceRefs: z.array(z.string().min(1)),
  })
  .strict()

export const organicEvidencePassportSchema = z
  .object({
    operatorRef: z.string().min(1),
    observations: z.array(organicCertificationObservationSchema),
    conflictState: z.enum(organicConflictStates),
    recipientDisposition: organicRecipientDispositionSchema.optional(),
    disclaimer: z.literal('Cora presents source evidence. Cora is not the certification body.'),
  })
  .strict()

export const certificationStatusChangedEventSchema = z
  .object({
    eventType: z.literal('CERTIFICATION_STATUS_CHANGED'),
    operatorRef: z.string().min(1),
    evidenceSource: z
      .object({
        institutionId: z.string().min(1),
        role: z.enum(['CERTIFICATION_BODY', 'EVIDENCE_AGGREGATOR', 'SCHEME_AUTHORITY']),
        reference: z.string().min(1),
      })
      .strict(),
    previousObservationRef: z.string().min(1).optional(),
    newObservationRef: z.string().min(1),
    observedAt: z.string().datetime(),
    evidenceRefs: z.array(z.string().min(1)).min(1),
    previous: z
      .object({
        rawStatus: z.string().min(1).optional(),
        normalizedStatus: organicStatusConceptSchema.optional(),
      })
      .strict()
      .optional(),
    current: z
      .object({
        rawStatus: z.string().min(1),
        normalizedStatus: organicStatusConceptSchema.optional(),
      })
      .strict(),
  })
  .strict()

export type OrganicCertificationObservation = z.infer<typeof organicCertificationObservationSchema>
export type OrganicStatusNormalizationMapping = z.infer<
  typeof organicStatusNormalizationMappingSchema
>
export type OrganicSourceRegistryEntry = z.infer<typeof organicSourceRegistryEntrySchema>
export type OrganicStandardInterpretation = z.infer<typeof organicStandardInterpretationSchema>
export type OrganicSectorMembershipEvidence = z.infer<typeof organicSectorMembershipEvidenceSchema>
export type OrganicEvidencePassport = z.infer<typeof organicEvidencePassportSchema>
export type OrganicRightsState = z.infer<typeof organicRightsStateSchema>

export function normalizeOrganicStatus(
  rawStatus: string,
  mappings: readonly OrganicStatusNormalizationMapping[],
) {
  const matches = mappings.filter((mapping) => mapping.rawStatus === rawStatus)
  if (matches.length !== 1) {
    return { state: 'UNKNOWN' as const, rawStatus }
  }

  const [mapping] = matches
  if (!mapping) {
    return { state: 'UNKNOWN' as const, rawStatus }
  }

  return {
    state: 'MAPPED' as const,
    rawStatus,
    status: mapping.normalizedStatus,
    authorityId: mapping.authorityId,
    mappingId: mapping.mappingId,
    version: mapping.version,
  }
}

export function evaluateOrganicFreshness(input: {
  readonly observationTime:
    | { readonly state: 'KNOWN'; readonly observedAt: string }
    | { readonly state: 'UNKNOWN' }
    | { readonly state: 'INVALID'; readonly rawTimestamp: string }
  readonly sourceAvailability: 'AVAILABLE' | 'UNAVAILABLE'
  readonly now: string
  readonly maxAgeMs?: number
}) {
  if (input.sourceAvailability === 'UNAVAILABLE') return 'SOURCE_UNAVAILABLE' as const
  if (input.observationTime.state === 'UNKNOWN') return 'OBSERVATION_TIME_UNKNOWN' as const
  if (input.observationTime.state === 'INVALID') return 'INVALID_OBSERVATION_TIME' as const
  if (input.maxAgeMs === undefined || !Number.isFinite(input.maxAgeMs) || input.maxAgeMs < 0) {
    return 'FRESHNESS_POLICY_UNSET' as const
  }

  const now = Date.parse(input.now)
  const observedAt = Date.parse(input.observationTime.observedAt)
  if (!Number.isFinite(now) || !Number.isFinite(observedAt)) {
    return 'INVALID_OBSERVATION_TIME' as const
  }
  const ageMs = now - observedAt
  if (ageMs < 0) return 'FUTURE_OBSERVATION_TIME' as const
  return ageMs <= input.maxAgeMs ? ('CURRENT' as const) : ('STALE' as const)
}

export function classifyOrganicEvidenceConflict(
  observations: readonly OrganicCertificationObservation[],
) {
  if (observations.length === 0) return 'NO_EVIDENCE' as const
  if (observations.some((item) => item.sourceAvailability === 'UNAVAILABLE')) {
    return 'SOURCE_UNAVAILABLE' as const
  }
  if (observations.some((item) => item.freshness === 'STALE')) return 'STALE_SOURCE' as const
  if (
    observations.some(
      (item) =>
        item.freshness === 'OBSERVATION_TIME_UNKNOWN' ||
        item.freshness === 'INVALID_OBSERVATION_TIME' ||
        item.freshness === 'FUTURE_OBSERVATION_TIME' ||
        item.freshness === 'FRESHNESS_POLICY_UNSET',
    )
  ) {
    return 'UNRESOLVED_FRESHNESS' as const
  }
  if (
    observations.some(
      (item) => item.factClass === 'organic.certification.status' && !item.normalizedStatus,
    )
  ) {
    return 'UNRESOLVED_SEMANTICS' as const
  }

  const statuses = new Set(observations.flatMap((item) => item.normalizedStatus?.status ?? []))
  if (statuses.size > 1) {
    const sourceInstitutions = new Set(observations.map((item) => item.source.institutionId))
    return sourceInstitutions.size > 1
      ? ('CONFLICTING_AUTHORITIES' as const)
      : ('CONFLICTING_OBSERVATIONS' as const)
  }
  return 'CONSISTENT' as const
}
