import { z } from 'zod'
import { rightsSnapshotSchema } from '../source-continuity/contracts'
import { methodologyVersionRefSchema } from '../evidence-foundation/contracts'

export const resolutionStateSchema = z.enum([
  'MATCHED',
  'PARTIAL',
  'UNKNOWN',
  'CONFLICT',
  'EXPIRED',
  'NOT_AUTHORIZED',
  'NOT_SATISFIED',
])

export const evidenceReferenceSchema = z
  .object({
    evidenceId: z.string().min(1),
    version: z.string().min(1),
    sourceAuthorityId: z.string().min(1),
    provenanceRef: z.string().min(1),
    methodology: methodologyVersionRefSchema.optional(),
    observedAt: z.string().datetime().optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    freshness: z.enum(['CURRENT', 'STALE', 'UNKNOWN', 'NOT_VERIFIED']).optional(),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (
      evidence.validFrom &&
      evidence.validUntil &&
      Date.parse(evidence.validFrom) >= Date.parse(evidence.validUntil)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Evidence validity must have a positive interval',
      })
    }
  })

export const recipientRequirementSchema = z
  .object({
    recipientId: z.string().min(1),
    requirementRef: z.string().min(1),
    requirementVersion: z.string().min(1),
    purpose: z.string().min(1),
    mappingVersion: z.string().min(1),
    requiredCriterionRefs: z.array(z.string().min(1)).min(1),
    evidenceCriterionStates: z.record(
      z.string(),
      z.enum(['MET', 'NOT_MET', 'UNKNOWN', 'CONFLICT']),
    ),
    rights: rightsSnapshotSchema,
    evidenceValidUntil: z.string().datetime().optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    expectedEvidenceVersion: z.string().min(1).optional(),
    requiredMethodology: methodologyVersionRefSchema.optional(),
    expectedInterpretationVersion: z.string().min(1).optional(),
    interpretationVersion: z.string().min(1).optional(),
    maximumEvidenceAgeSeconds: z.number().finite().nonnegative().optional(),
    evaluatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((requirement, context) => {
    if (
      requirement.validFrom &&
      requirement.validUntil &&
      Date.parse(requirement.validFrom) >= Date.parse(requirement.validUntil)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Requirement validity must have a positive interval',
      })
    }
    if (
      new Set(requirement.requiredCriterionRefs).size !== requirement.requiredCriterionRefs.length
    ) {
      context.addIssue({ code: 'custom', message: 'Required criteria must have unique references' })
    }
  })

export const resolutionResultSchema = z
  .object({
    evidence: evidenceReferenceSchema,
    recipientId: z.string().min(1),
    requirementRef: z.string().min(1),
    requirementVersion: z.string().min(1),
    authorizationRef: z.string().min(1),
    mappingVersion: z.string().min(1),
    state: resolutionStateSchema,
    reasonRefs: z.array(z.string().min(1)),
    unresolvedCriterionRefs: z.array(z.string().min(1)),
  })
  .strict()

export const recipientDispositionSchema = z
  .object({
    recipientId: z.string().min(1),
    dispositionRef: z.string().min(1),
    authorityRef: z.string().min(1),
    provenanceRef: z.string().min(1),
    value: z.string().min(1),
    recordedAt: z.string().datetime(),
  })
  .strict()

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>
export type RecipientRequirement = z.infer<typeof recipientRequirementSchema>
export type ResolutionResult = z.infer<typeof resolutionResultSchema>
export type RecipientDisposition = z.infer<typeof recipientDispositionSchema>
