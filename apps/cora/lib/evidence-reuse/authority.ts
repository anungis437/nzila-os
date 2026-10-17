import {
  continuityCapsuleSchema,
  verifyCapsuleIntegrity,
  type ContinuityCapsule,
} from '../source-continuity/capsule'
import { sha256Canonical } from '../source-continuity/integrity'
import { mapSourceCapture } from '../source-continuity/semantic-mapping'
import {
  assertionCandidateSchema,
  authorityBindingSchema,
  evidenceSupportSchema,
  governedAssertionSchema,
  type AssertionCandidate,
  type EvidenceSupport,
  type GovernedEvidenceAssertion,
  type IssuerAuthorityPort,
} from './contracts'

export function referenceContinuitySupport(
  input: ContinuityCapsule,
  captureId: string,
  mappingRef: string,
  mappingVersion: string,
  at: string,
): EvidenceSupport {
  const capsule = continuityCapsuleSchema.parse(input)
  if (!verifyCapsuleIntegrity(capsule)) throw new Error('Evidence support capsule integrity failed')
  const capture = capsule.captures.find((item) => item.captureId === captureId)
  const mapping = capsule.mappings.find(
    (item) => item.mappingId === mappingRef && item.version === mappingVersion,
  )
  if (!capture || !mapping)
    throw new Error('Evidence support requires an included capture and mapping')
  const result = mapSourceCapture(capture, mapping, at)
  const claims = result.fields
    .filter(
      (field) =>
        field.state === 'MAPPED' && field.canonicalValue !== undefined && field.losses.length === 0,
    )
    .map((field) => ({ conceptRef: field.canonicalField, value: field.canonicalValue! }))
  return evidenceSupportSchema.parse({
    kind: 'EVIDENCE_SUPPORT',
    capsuleId: capsule.capsuleId,
    capsuleSha256: capsule.integrity.sha256,
    captureId,
    orgId: capsule.orgId,
    sourceRef: capture.sourceRef,
    sourceAuthorityId: capture.sourceAuthority.authorityId,
    provenanceRef: `support:${sha256Canonical(capture.provenance)}`,
    provenanceEdgeRefs: capture.provenance.map((edge) => edge.edgeId),
    mappingRef,
    mappingVersion,
    claims,
    limitations: [...capsule.limitations, ...capture.limitations, ...result.limitations],
    rights: capture.rights,
  })
}

export function assertionCandidateDigest(input: AssertionCandidate): string {
  const candidate = assertionCandidateSchema.parse(input)
  return sha256Canonical(JSON.parse(JSON.stringify(candidate)))
}

export function authorityRejectionReasons(
  input: AssertionCandidate,
  authority: IssuerAuthorityPort,
  at: string,
): string[] {
  const candidate = assertionCandidateSchema.parse(input)
  const reasons: string[] = []
  if (!Number.isFinite(Date.parse(at))) reasons.push('INVALID_EVALUATION_TIME')
  if (candidate.evidence.sourceAuthorityId !== candidate.support.sourceAuthorityId) {
    reasons.push('SOURCE_AUTHORITY_MISMATCH')
  }
  if (candidate.evidence.provenanceRef !== candidate.support.provenanceRef) {
    reasons.push('PROVENANCE_CHAIN_MISMATCH')
  }
  if (!candidate.support.sourceRef.sourceVersion) reasons.push('SOURCE_RECORD_VERSION_UNKNOWN')
  if (!candidate.evidence.methodology) reasons.push('METHODOLOGY_AUTHORITY_UNKNOWN')
  if (
    !candidate.evidence.observedAt ||
    !candidate.evidence.validFrom ||
    !candidate.evidence.validUntil
  ) {
    reasons.push('EVIDENCE_TEMPORAL_SCOPE_UNKNOWN')
  } else if (
    Date.parse(candidate.evidence.validFrom) >= Date.parse(candidate.evidence.validUntil)
  ) {
    reasons.push('EVIDENCE_VALIDITY_PERIOD_INVALID')
  }
  const resolved = authority.resolveBinding(candidate.authorityBindingRef)
  if (!resolved) return [...reasons, 'ISSUER_BINDING_NOT_ESTABLISHED']
  const binding = authorityBindingSchema.parse(resolved)
  if (
    binding.bindingRef !== candidate.authorityBindingRef ||
    binding.issuerAuthorityId !== candidate.evidence.sourceAuthorityId ||
    binding.relationship !== 'ISSUER_FOR_ASSERTION' ||
    binding.state !== 'ESTABLISHED'
  )
    reasons.push('ISSUER_AUTHORITY_RELATIONSHIP_NOT_ESTABLISHED')
  if (binding.candidateSha256 !== assertionCandidateDigest(candidate))
    reasons.push('ISSUER_BINDING_SCOPE_MISMATCH')
  if (
    Date.parse(binding.validFrom) > Date.parse(at) ||
    Date.parse(binding.validUntil) <= Date.parse(at) ||
    Date.parse(binding.validFrom) >= Date.parse(binding.validUntil)
  )
    reasons.push('ISSUER_BINDING_OUTSIDE_VALIDITY_PERIOD')
  return reasons
}

export function bindEvidenceAssertion(
  input: AssertionCandidate,
  authority: IssuerAuthorityPort,
  at: string,
):
  | { state: 'BOUND'; assertion: GovernedEvidenceAssertion }
  | { state: 'REJECTED'; reasonRefs: string[]; support: EvidenceSupport } {
  const candidate = assertionCandidateSchema.parse(input)
  const reasonRefs = authorityRejectionReasons(candidate, authority, at)
  if (reasonRefs.length) return { state: 'REJECTED', reasonRefs, support: candidate.support }
  const binding = authority.resolveBinding(candidate.authorityBindingRef)
  if (!binding) throw new Error('Issuer binding disappeared during assertion binding')
  return {
    state: 'BOUND',
    assertion: governedAssertionSchema.parse({
      ...candidate,
      kind: 'EVIDENCE_ASSERTION',
      authorityBinding: binding,
    }),
  }
}
