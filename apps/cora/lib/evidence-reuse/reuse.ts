import { z } from 'zod'
import { resolutionResultSchema } from '../evidence-resolution/contracts'
import { sha256Canonical } from '../source-continuity/integrity'
import {
  reuseAttemptSchema,
  reuseQualificationSchema,
  type IssuerAuthorityPort,
  type ReuseAttempt,
  type ReuseQualification,
} from './contracts'
import { resolveInstitutionalUse } from './resolve-use'

const contextRefSchema = z
  .object({
    contextId: z.string().min(1),
    institutionId: z.string().min(1),
    recipientId: z.string().min(1),
    decisionAuthorityRef: z.string().min(1),
    purpose: z.string().min(1),
    requirementRef: z.string().min(1),
    requirementVersion: z.string().min(1),
    authorizationRef: z.string().min(1),
    interpretationRef: z.string().min(1),
    interpretationVersion: z.string().min(1),
  })
  .strict()

export const crossInstitutionalEvidenceReuseEventSchema = z
  .object({
    eventId: z.string().min(1),
    opportunityKey: z.string().regex(/^[a-f0-9]{64}$/),
    evidenceId: z.string().min(1),
    evidenceVersion: z.string().min(1),
    provenanceRef: z.string().min(1),
    originating: contextRefSchema,
    consuming: contextRefSchema,
    reuseTimestamp: z.string().datetime(),
    reconstructionAvoided: z.enum(['ESTABLISHED', 'NOT_ESTABLISHED', 'UNKNOWN']),
    reconstructionEvidence: reuseAttemptSchema.shape.reconstructionEvidence,
    qualification: reuseQualificationSchema,
    eligibleOpportunity: z.boolean(),
    rejectionReasons: z.array(z.string().min(1)),
    originatingResolution: resolutionResultSchema,
    consumingResolution: resolutionResultSchema,
    supportingEvidence: z.array(resolutionResultSchema.shape.evidence).min(1),
  })
  .strict()
  .superRefine((event, context) => {
    const trace = event.reconstructionEvidence
    const reconstructionProven =
      trace.contextId === event.consuming.contextId &&
      trace.evidenceId === event.evidenceId &&
      trace.evidenceVersion === event.evidenceVersion &&
      trace.sourceRetrieval === 0 &&
      trace.manualReentry === 0 &&
      trace.duplicateDocumentProduction === 0 &&
      trace.evidenceReconstruction === 0
    if (
      event.qualification === 'QUALIFIED_REUSE' &&
      (!event.eligibleOpportunity ||
        event.reconstructionAvoided !== 'ESTABLISHED' ||
        !reconstructionProven ||
        event.rejectionReasons.length > 0 ||
        ![event.originatingResolution, event.consumingResolution].every((result) =>
          ['MATCHED', 'PARTIAL', 'NOT_SATISFIED'].includes(result.state),
        ))
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Qualified reuse requires an eligible, reconstruction-free opportunity with no rejection reasons',
      })
    }
    if (
      event.eligibleOpportunity &&
      !['QUALIFIED_REUSE', 'INELIGIBLE'].includes(event.qualification)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Pseudo-reuse and unauthorized attempts are excluded opportunities',
      })
    }
    for (const [ref, resolution] of [
      [event.originating, event.originatingResolution],
      [event.consuming, event.consumingResolution],
    ] as const) {
      if (
        ref.recipientId !== resolution.recipientId ||
        ref.requirementRef !== resolution.requirementRef ||
        ref.requirementVersion !== resolution.requirementVersion ||
        ref.authorizationRef !== resolution.authorizationRef
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Reuse context does not match its technical resolution',
        })
      }
    }
  })

export type CrossInstitutionalEvidenceReuseEvent = z.infer<
  typeof crossInstitutionalEvidenceReuseEventSchema
>

export function qualifyEvidenceReuse(
  input: ReuseAttempt,
  authority: IssuerAuthorityPort,
): CrossInstitutionalEvidenceReuseEvent {
  const attempt = reuseAttemptSchema.parse(input)
  const a = attempt.originating
  const b = attempt.consuming
  const first = resolveInstitutionalUse(a, authority, attempt.at)
  const second = resolveInstitutionalUse(b, authority, attempt.at)
  const contextRef = (use: ReuseAttempt['originating']) => ({
    contextId: use.contextId,
    institutionId: use.institutionId,
    recipientId: use.requirement.recipientId,
    decisionAuthorityRef: use.decisionAuthorityRef,
    purpose: use.requirement.purpose,
    requirementRef: use.requirement.requirementRef,
    requirementVersion: use.requirement.requirementVersion,
    authorizationRef: use.requirement.rights.decisionRef,
    interpretationRef: use.interpretation.interpretationRef,
    interpretationVersion: use.interpretation.version,
  })
  const originating = contextRef(a)
  const consuming = contextRef(b)
  const sameEvidence = sha256Canonical(a.assertion) === sha256Canonical(b.assertion)
  const independent =
    a.contextId !== b.contextId &&
    a.institutionId !== b.institutionId &&
    a.requirement.recipientId !== b.requirement.recipientId &&
    a.decisionAuthorityRef !== b.decisionAuthorityRef &&
    a.requirement.rights.decisionRef !== b.requirement.rights.decisionRef &&
    a.interpretation.interpretationRef !== b.interpretation.interpretationRef &&
    !attempt.originDispositionUsedAsAuthority
  const evaluable = [first.technical, second.technical].every((result) =>
    ['MATCHED', 'PARTIAL', 'NOT_SATISFIED'].includes(result.state),
  )
  const trace = attempt.reconstructionEvidence
  const reconstructionProven =
    attempt.reconstructionAvoided === 'ESTABLISHED' &&
    trace.contextId === b.contextId &&
    trace.evidenceId === b.assertion.evidence.evidenceId &&
    trace.evidenceVersion === b.assertion.evidence.version &&
    trace.sourceRetrieval === 0 &&
    trace.manualReentry === 0 &&
    trace.duplicateDocumentProduction === 0 &&
    trace.evidenceReconstruction === 0
  let qualification: ReuseQualification
  let rejectionReasons: string[]
  if ([first.technical, second.technical].some((result) => result.state === 'NOT_AUTHORIZED')) {
    qualification = 'NOT_AUTHORIZED'
    rejectionReasons = ['RECIPIENT_OR_SOURCE_DISCLOSURE_NOT_AUTHORIZED']
  } else if (attempt.acquisition !== 'GOVERNED_REFERENCE') {
    qualification = attempt.acquisition
    rejectionReasons = ['GOVERNED_EVIDENCE_REFERENCE_NOT_REUSED']
  } else if (!sameEvidence) {
    qualification = 'NOT_SAME_EVIDENCE'
    rejectionReasons = ['EVIDENCE_IDENTITY_VERSION_AUTHORITY_OR_PROVENANCE_CHANGED']
  } else if (!independent) {
    qualification = 'NOT_INDEPENDENT_CONTEXT'
    rejectionReasons = ['CONTEXT_OR_RECIPIENT_AUTHORITY_NOT_INDEPENDENT']
  } else if (!evaluable || !reconstructionProven) {
    qualification = 'INELIGIBLE'
    rejectionReasons = [
      ...(!evaluable
        ? [
            'TECHNICAL_RESOLUTION_BLOCKED',
            ...first.technical.reasonRefs,
            ...second.technical.reasonRefs,
          ]
        : []),
      ...(!reconstructionProven ? ['RECONSTRUCTION_AVOIDANCE_NOT_ESTABLISHED'] : []),
    ]
  } else {
    qualification = 'QUALIFIED_REUSE'
    rejectionReasons = []
  }
  return crossInstitutionalEvidenceReuseEventSchema.parse({
    eventId: attempt.eventId,
    opportunityKey: sha256Canonical({
      evidence: a.assertion.evidence,
      consumingEvidence: b.assertion.evidence,
      originating,
      consuming,
    }),
    evidenceId: a.assertion.evidence.evidenceId,
    evidenceVersion: a.assertion.evidence.version,
    provenanceRef: a.assertion.evidence.provenanceRef,
    originating,
    consuming,
    reuseTimestamp: attempt.at,
    reconstructionAvoided: attempt.reconstructionAvoided,
    reconstructionEvidence: trace,
    qualification,
    eligibleOpportunity:
      sameEvidence && independent && evaluable && attempt.acquisition === 'GOVERNED_REFERENCE',
    rejectionReasons,
    originatingResolution: first.technical,
    consumingResolution: second.technical,
    supportingEvidence: second.supportingEvidence,
  })
}
