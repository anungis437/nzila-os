import {
  evaluateOrganicFreshness,
  normalizeOrganicStatus,
  organicCertificationObservationSchema,
  type OrganicCertificationObservation,
  type OrganicStatusNormalizationMapping,
} from './contracts'
import { z } from 'zod'

export const proCertDirectoryRecordSchema = z
  .object({
    registryRef: z.string().min(1),
    sourceReference: z.string().min(1),
    rawStatus: z.string().min(1),
    program: z.string().min(1).optional(),
    scope: z.array(z.string().min(1)).optional(),
    products: z.array(z.string().min(1)).optional(),
    statusObservedAt: z.string().nullable().optional(),
    sourceCreatedAt: z.string().nullable().optional(),
    sourceUpdatedAt: z.string().nullable().optional(),
  })
  .strip()

export type ProCertDirectoryRecord = z.infer<typeof proCertDirectoryRecordSchema>

export function adaptProCertDirectoryRecord(
  input: unknown,
  options: {
    readonly evidenceId: string
    readonly freshnessEvaluation?: {
      readonly now: string
      readonly maxAgeMs?: number
    }
    readonly statusMappings?: readonly OrganicStatusNormalizationMapping[]
  },
): OrganicCertificationObservation {
  const record = proCertDirectoryRecordSchema.parse(input)
  const timestamp = record.statusObservedAt
  const validTimestamp =
    timestamp == null ? false : z.string().datetime().safeParse(timestamp).success
  const observationTime =
    timestamp == null
      ? { state: 'UNKNOWN' as const }
      : validTimestamp
        ? { state: 'KNOWN' as const, observedAt: timestamp }
        : { state: 'INVALID' as const, rawTimestamp: timestamp }
  const freshness = options.freshnessEvaluation
    ? evaluateOrganicFreshness({
        observationTime,
        sourceAvailability: 'AVAILABLE',
        now: options.freshnessEvaluation.now,
        maxAgeMs: options.freshnessEvaluation.maxAgeMs,
      })
    : observationTime.state === 'KNOWN'
      ? 'FRESHNESS_POLICY_UNSET'
      : observationTime.state === 'UNKNOWN'
        ? 'OBSERVATION_TIME_UNKNOWN'
        : 'INVALID_OBSERVATION_TIME'
  const normalized = normalizeOrganicStatus(record.rawStatus, options.statusMappings ?? [])
  const isCorProgram = record.program === 'COR'

  return organicCertificationObservationSchema.parse({
    evidenceId: options.evidenceId,
    factClass: 'organic.certification.status',
    subject: { operatorRef: record.registryRef },
    source: {
      institutionId: 'pro-cert',
      role: 'CERTIFICATION_BODY',
      system: 'pro-cert-client-directory',
      reference: record.sourceReference,
      uri: 'https://www.pro-cert.org/client-directory/',
    },
    rawStatus: record.rawStatus,
    normalizedStatus:
      normalized.state === 'MAPPED'
        ? {
            status: normalized.status,
            authorityId: normalized.authorityId,
            mappingId: normalized.mappingId,
            version: normalized.version,
          }
        : undefined,
    evidenceLevel: 'DIRECTORY_STATUS',
    certificationContext: {
      program: record.program,
      scope: record.scope,
      products: record.products,
    },
    sourceRecordMetadata: {
      registryRef: record.registryRef,
      sourceCreatedAt: record.sourceCreatedAt,
      sourceUpdatedAt: record.sourceUpdatedAt,
    },
    observationTime,
    sourceAvailability: 'AVAILABLE',
    freshness,
    provenance: [],
    rights: {
      publicationAuthority: isCorProgram
        ? {
            state: 'ESTABLISHED',
            basis: 'REGULATORY_PUBLICATION_MANDATE',
            evidenceRef: 'cfia-cor-publication-policy',
          }
        : { state: 'UNKNOWN', basis: 'UNKNOWN' },
      sourceAccessMethod: 'PUBLIC_WEB',
      automatedAccess: 'REQUIRES_CONFIRMATION',
      reuseRights: 'REQUIRES_CONFIRMATION',
      republicationRights: 'REQUIRES_CONFIRMATION',
    },
  })
}
