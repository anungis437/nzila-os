import { evaluateRights } from '../source-continuity/rights'
import { sha256Canonical } from '../source-continuity/integrity'
import {
  evidenceReferenceSchema,
  recipientRequirementSchema,
  resolutionResultSchema,
  type EvidenceReference,
  type RecipientRequirement,
  type ResolutionResult,
} from './contracts'

export function resolveEvidence(
  evidenceInput: EvidenceReference,
  requirementInput: RecipientRequirement,
): ResolutionResult {
  const evidence = evidenceReferenceSchema.parse(evidenceInput)
  const requirement = recipientRequirementSchema.parse(requirementInput)
  const authorization = evaluateRights(requirement.rights, 'DISCLOSE', {
    purpose: requirement.purpose,
    recipientId: requirement.recipientId,
    at: requirement.evaluatedAt,
  })
  const resultBase = {
    evidence,
    recipientId: requirement.recipientId,
    requirementRef: requirement.requirementRef,
    requirementVersion: requirement.requirementVersion,
    authorizationRef: requirement.rights.decisionRef,
    mappingVersion: requirement.mappingVersion,
  }
  const blocked = (state: ResolutionResult['state'], reason: string): ResolutionResult =>
    resolutionResultSchema.parse({
      ...resultBase,
      state,
      reasonRefs: [reason],
      unresolvedCriterionRefs: requirement.requiredCriterionRefs,
    })

  if (!authorization.allowed) {
    const expired = authorization.reasons.some((reason) => reason === 'RIGHTS_EXPIRED')
    return resolutionResultSchema.parse({
      ...resultBase,
      state: expired ? 'EXPIRED' : 'NOT_AUTHORIZED',
      reasonRefs: authorization.reasons,
      unresolvedCriterionRefs: requirement.requiredCriterionRefs,
    })
  }
  const at = Date.parse(requirement.evaluatedAt)
  if (requirement.validFrom && Date.parse(requirement.validFrom) > at) {
    return blocked('UNKNOWN', 'REQUIREMENT_NOT_YET_VALID')
  }
  if (requirement.validUntil && Date.parse(requirement.validUntil) <= at) {
    return blocked('EXPIRED', 'REQUIREMENT_VALIDITY_PERIOD_ENDED')
  }
  if (
    requirement.expectedEvidenceVersion &&
    requirement.expectedEvidenceVersion !== evidence.version
  ) {
    return blocked('UNKNOWN', 'EVIDENCE_VERSION_MISMATCH')
  }
  if (
    requirement.requiredMethodology &&
    (!evidence.methodology ||
      sha256Canonical(requirement.requiredMethodology) !== sha256Canonical(evidence.methodology))
  ) {
    return blocked('UNKNOWN', 'METHODOLOGY_VERSION_MISMATCH_OR_UNKNOWN')
  }
  if (
    requirement.expectedInterpretationVersion &&
    requirement.expectedInterpretationVersion !== requirement.interpretationVersion
  ) {
    return blocked('UNKNOWN', 'INTERPRETATION_VERSION_MISMATCH_OR_UNKNOWN')
  }
  if (evidence.validFrom && Date.parse(evidence.validFrom) > at) {
    return blocked('UNKNOWN', 'EVIDENCE_NOT_YET_VALID')
  }
  if (evidence.validUntil && Date.parse(evidence.validUntil) <= at) {
    return blocked('EXPIRED', 'EVIDENCE_VALIDITY_PERIOD_ENDED')
  }
  if (evidence.freshness === 'STALE') return blocked('UNKNOWN', 'EVIDENCE_STALE')
  if (
    requirement.maximumEvidenceAgeSeconds !== undefined &&
    (!evidence.observedAt ||
      Date.parse(evidence.observedAt) > at ||
      at - Date.parse(evidence.observedAt) > requirement.maximumEvidenceAgeSeconds * 1000)
  ) {
    return blocked('UNKNOWN', 'EVIDENCE_OBSERVATION_TIME_UNKNOWN_FUTURE_OR_TOO_OLD')
  }
  if (
    requirement.evidenceValidUntil &&
    Date.parse(requirement.evidenceValidUntil) <= Date.parse(requirement.evaluatedAt)
  ) {
    return resolutionResultSchema.parse({
      ...resultBase,
      state: 'EXPIRED',
      reasonRefs: ['EVIDENCE_VALIDITY_PERIOD_ENDED'],
      unresolvedCriterionRefs: requirement.requiredCriterionRefs,
    })
  }

  const states = requirement.requiredCriterionRefs.map(
    (criterion) => requirement.evidenceCriterionStates[criterion] ?? 'UNKNOWN',
  )
  const unresolvedCriterionRefs = requirement.requiredCriterionRefs.filter(
    (criterion) => requirement.evidenceCriterionStates[criterion] !== 'MET',
  )
  let state: ResolutionResult['state']
  if (states.includes('CONFLICT')) state = 'CONFLICT'
  else if (states.every((value) => value === 'MET')) state = 'MATCHED'
  else if (states.every((value) => value === 'NOT_MET')) state = 'NOT_SATISFIED'
  else if (states.every((value) => value === 'UNKNOWN')) state = 'UNKNOWN'
  else if (states.includes('MET')) state = 'PARTIAL'
  else state = 'UNKNOWN'

  return resolutionResultSchema.parse({
    ...resultBase,
    state,
    reasonRefs: unresolvedCriterionRefs.map(
      (criterion) =>
        `CRITERION_${requirement.evidenceCriterionStates[criterion] ?? 'UNKNOWN'}:${criterion}`,
    ),
    unresolvedCriterionRefs,
  })
}
