import { z } from 'zod'

export const evidenceQualitySchema = z.object({
  completeness: z.enum(['complete', 'partial', 'estimated', 'unknown']),
  freshness: z.enum(['current', 'stale', 'unknown']),
  traceability: z.enum(['direct', 'derived', 'unknown']),
  limitations: z.array(z.string().min(1)),
})

export const confidenceAssessmentSchema = z.object({
  level: z.enum(['high', 'medium', 'low', 'unknown']),
  basis: z.string().min(1),
})

export const temporalScopeSchema = z
  .object({
    observedAt: z.string().datetime(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
  })
  .refine(
    (scope) =>
      !scope.validFrom ||
      !scope.validTo ||
      Date.parse(scope.validFrom) <= Date.parse(scope.validTo),
    { message: 'validFrom must not be later than validTo' },
  )

export const evidenceSourceRefSchema = z.object({
  system: z.string().min(1),
  recordId: z.string().min(1),
  uri: z.string().url().optional(),
})

export const methodologyVersionRefSchema = z.object({
  id: z.guid(),
  authorityId: z.string().min(1),
  methodologyId: z.string().min(1),
  version: z.string().min(1),
  definitionSha256: z.string().regex(/^[a-f0-9]{64}$/),
})

export const evidencePackArtifactRefSchema = z.object({
  packId: z.string().min(1),
  artifactId: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
})

export const coraEvidenceRecordDraftSchema = z
  .object({
    evidenceType: z.string().min(1),
    purpose: z.string().min(1),
    consentRef: z.string().min(1),
    source: evidenceSourceRefSchema,
    temporalScope: temporalScopeSchema,
    methodology: methodologyVersionRefSchema,
    provenanceRef: z.string().min(1),
    payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
    evidencePackArtifact: evidencePackArtifactRefSchema.optional(),
    confidence: confidenceAssessmentSchema,
    dataQuality: evidenceQualitySchema,
  })
  .strict()

export const coraConclusionDraftSchema = z
  .object({
    conclusionType: z.string().min(1),
    purpose: z.string().min(1),
    consentRef: z.string().min(1),
    statement: z.string().min(1),
    outcome: z.record(z.string(), z.unknown()),
    evidence: z
      .array(
        z.object({
          evidenceId: z.guid(),
          payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .min(1),
    methodology: methodologyVersionRefSchema,
    temporalScope: temporalScopeSchema,
    confidence: confidenceAssessmentSchema,
    dataQuality: evidenceQualitySchema,
  })
  .strict()

export type EvidenceQuality = z.infer<typeof evidenceQualitySchema>
export type ConfidenceAssessment = z.infer<typeof confidenceAssessmentSchema>
export type TemporalScope = z.infer<typeof temporalScopeSchema>
export type EvidenceSourceRef = z.infer<typeof evidenceSourceRefSchema>
export type MethodologyVersionRef = z.infer<typeof methodologyVersionRefSchema>
export type CoraEvidenceRecordDraft = z.infer<typeof coraEvidenceRecordDraftSchema>
export type CoraConclusionDraft = z.infer<typeof coraConclusionDraftSchema>
export interface CoraEvidenceRecord extends CoraEvidenceRecordDraft {
  readonly id: string
  readonly orgId: string
  readonly createdBy: string
  readonly createdAt: string
}

export interface CoraConclusion extends CoraConclusionDraft {
  readonly id: string
  readonly orgId: string
  readonly createdBy: string
  readonly generatedAt: string
  readonly createdAt: string
}
