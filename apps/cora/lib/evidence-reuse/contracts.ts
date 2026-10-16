import { z } from 'zod'
import {
  evidenceReferenceSchema,
  recipientRequirementSchema,
} from '../evidence-resolution/contracts'
import {
  namespacedSourceRefSchema,
  safeJsonValueSchema,
  rightsSnapshotSchema,
} from '../source-continuity/contracts'

const ref = z.string().min(1)

export const evidenceSupportSchema = z
  .object({
    kind: z.literal('EVIDENCE_SUPPORT'),
    capsuleId: ref,
    capsuleSha256: z.string().regex(/^[a-f0-9]{64}$/),
    captureId: ref,
    orgId: ref,
    sourceRef: namespacedSourceRefSchema,
    sourceAuthorityId: ref,
    provenanceRef: ref,
    provenanceEdgeRefs: z.array(ref).min(1),
    mappingRef: ref,
    mappingVersion: ref,
    claims: z.array(z.object({ conceptRef: ref, value: safeJsonValueSchema }).strict()).min(1),
    limitations: z.array(ref),
    rights: rightsSnapshotSchema,
  })
  .strict()

export const assertionCandidateSchema = z
  .object({
    evidence: evidenceReferenceSchema,
    support: evidenceSupportSchema,
    evidenceClass: ref,
    subjectRef: ref,
    scopeRef: ref,
    authorityBindingRef: ref,
  })
  .strict()

export const authorityBindingSchema = z
  .object({
    bindingRef: ref,
    issuerAuthorityId: ref,
    relationship: z.enum(['ISSUER_FOR_ASSERTION', 'SUPPORT_ONLY']),
    state: z.enum(['ESTABLISHED', 'UNKNOWN', 'REVOKED']),
    candidateSha256: z.string().regex(/^[a-f0-9]{64}$/),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
  })
  .strict()

export const governedAssertionSchema = assertionCandidateSchema
  .extend({ kind: z.literal('EVIDENCE_ASSERTION'), authorityBinding: authorityBindingSchema })
  .strict()

export const interpretationSchema = z
  .object({
    interpretationRef: ref,
    version: ref,
    acceptedEvidenceClasses: z.array(ref).min(1),
    subjectRef: ref,
    scopeRef: ref,
    rules: z
      .array(
        z
          .object({ criterionRef: ref, conceptRef: ref, expectedValue: safeJsonValueSchema })
          .strict(),
      )
      .min(1),
  })
  .strict()

export const institutionalUseSchema = z
  .object({
    contextId: ref,
    institutionId: ref,
    decisionAuthorityRef: ref,
    assertion: governedAssertionSchema,
    supplementalAssertions: z.array(governedAssertionSchema).default([]),
    requirement: recipientRequirementSchema,
    interpretation: interpretationSchema,
  })
  .strict()

export const reuseQualificationSchema = z.enum([
  'QUALIFIED_REUSE',
  'DUPLICATE_UPLOAD',
  'RECONSTRUCTED_ASSERTION',
  'TECHNICAL_COPY_ONLY',
  'NOT_AUTHORIZED',
  'NOT_SAME_EVIDENCE',
  'NOT_INDEPENDENT_CONTEXT',
  'INELIGIBLE',
])

export const reuseAttemptSchema = z
  .object({
    eventId: ref,
    originating: institutionalUseSchema,
    consuming: institutionalUseSchema,
    at: z.string().datetime(),
    acquisition: z.enum([
      'GOVERNED_REFERENCE',
      'DUPLICATE_UPLOAD',
      'RECONSTRUCTED_ASSERTION',
      'TECHNICAL_COPY_ONLY',
    ]),
    reconstructionAvoided: z.enum(['ESTABLISHED', 'NOT_ESTABLISHED', 'UNKNOWN']),
    reconstructionEvidence: z
      .object({
        traceRef: ref,
        evidenceId: ref,
        evidenceVersion: ref,
        contextId: ref,
        sourceRetrieval: z.number().int().nonnegative(),
        manualReentry: z.number().int().nonnegative(),
        duplicateDocumentProduction: z.number().int().nonnegative(),
        evidenceReconstruction: z.number().int().nonnegative(),
      })
      .strict(),
    originDispositionUsedAsAuthority: z.boolean(),
  })
  .strict()

export type EvidenceSupport = z.infer<typeof evidenceSupportSchema>
export type AssertionCandidate = z.infer<typeof assertionCandidateSchema>
export type AuthorityBinding = z.infer<typeof authorityBindingSchema>
export type GovernedEvidenceAssertion = z.infer<typeof governedAssertionSchema>
export type InstitutionalUse = z.infer<typeof institutionalUseSchema>
export type ReuseAttempt = z.infer<typeof reuseAttemptSchema>
export type ReuseQualification = z.infer<typeof reuseQualificationSchema>

export interface IssuerAuthorityPort {
  resolveBinding(bindingRef: string): AuthorityBinding | undefined
}
