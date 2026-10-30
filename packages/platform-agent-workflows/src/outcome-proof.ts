/**
 * Independently verified outcome proof: execution agents cannot mint successful
 * receipts by putting "verified": true in a tool response or skill document.
 *
 * IMPORTANT: The verifier must be supplied by trusted HOST configuration,
 * never from an agent, external skill, or MCP tool response. This module has
 * no authority to approve a release or to execute a tool.
 */
import type { AgentWorkflow, OutcomeEvidence } from './types'
import { outcomeEvidenceSchema } from './types'

export interface OutcomeVerificationRequest {
  workflowId: string
  stepId: string
  app: string
  orgId: string
  executingAgentId: string
  commitSha: string
  artifactDigest: string
  evidenceRefs: readonly string[]
}

export interface IndependentVerificationResult {
  verdict: 'PASS' | 'FAIL'
  verificationRef: string
  verifierId: string
  source: string
  verifiedAt: string
  checkedCommitSha: string
  checkedArtifactDigest: string
  checkedEvidenceRefs: readonly string[]
}

export interface TrustedOutcomeVerifier {
  verify(request: Readonly<OutcomeVerificationRequest>): Promise<IndependentVerificationResult>
}

export interface VerifiedOutcomeProof {
  readonly request: Readonly<OutcomeVerificationRequest>
  readonly evidence: Readonly<OutcomeEvidence>
}

/** Runtime minted receipts are unforgeable by plain JSON or object casts. */
const minted = new WeakSet<object>()

function requireScope(value: string, field: string): void {
  if (!value || value.length > 256 || /[\u0000-\u001f]/.test(value)) {
    throw new Error('Invalid outcome ' + field)
  }
}

/**
 * Verify via the trusted host's independent evidence source. Fail closed when
 * the verifier cannot be contacted, evidence differs, or verifier = executor.
 */
export async function verifyOutcomeEvidence(
  request: OutcomeVerificationRequest,
  trustedHostVerifier: TrustedOutcomeVerifier,
): Promise<VerifiedOutcomeProof> {
  for (const k of ['workflowId', 'stepId', 'app', 'orgId', 'executingAgentId'] as const) {
    requireScope(request[k], k)
  }
  if (!/^[0-9a-f]{40}$/i.test(request.commitSha) ||
      !/^sha256:[0-9a-f]{64}$/i.test(request.artifactDigest) ||
      !request.evidenceRefs.length ||
      request.evidenceRefs.some(x => !x || x.length > 512)) {
    throw new Error('Outcome evidence coordinates are missing or malformed')
  }
  if (!trustedHostVerifier || typeof trustedHostVerifier.verify !== 'function') {
    throw new Error('Trusted independent outcome verifier is unavailable')
  }
  const result = await trustedHostVerifier.verify(Object.freeze({
    ...request,
    evidenceRefs: Object.freeze([...request.evidenceRefs]),
  }))
  if (result.verdict !== 'PASS' ||
      result.verifierId === request.executingAgentId ||
      result.checkedCommitSha !== request.commitSha ||
      result.checkedArtifactDigest !== request.artifactDigest ||
      result.checkedEvidenceRefs.length !== request.evidenceRefs.length ||
      result.checkedEvidenceRefs.some((x, i) => x !== request.evidenceRefs[i])) {
    throw new Error('Independent outcome verification was not established')
  }
  const evidence = outcomeEvidenceSchema.parse({
    phase: 'VERIFIED',
    verificationRef: result.verificationRef,
    verifierId: result.verifierId,
    source: result.source,
    commitSha: result.checkedCommitSha,
    artifactDigest: result.checkedArtifactDigest,
    evidenceRefs: [...result.checkedEvidenceRefs],
    verifiedAt: result.verifiedAt,
  })
  const proof = Object.freeze({
    request: Object.freeze({ ...request, evidenceRefs: Object.freeze([...request.evidenceRefs]) }),
    evidence: Object.freeze({ ...evidence, evidenceRefs: Object.freeze([...evidence.evidenceRefs]) }),
  })
  minted.add(proof)
  return proof
}

export function isVerifiedOutcomeFor(
  proof: unknown,
  workflow: AgentWorkflow,
  stepId: string,
): proof is VerifiedOutcomeProof {
  if (!proof || typeof proof !== 'object' || !minted.has(proof)) return false
  const p = proof as VerifiedOutcomeProof
  return p.request.workflowId === workflow.id &&
    p.request.stepId === stepId &&
    p.request.app === workflow.app &&
    p.request.orgId === workflow.orgId &&
    p.evidence.phase === 'VERIFIED' &&
    p.evidence.commitSha === p.request.commitSha &&
    p.evidence.artifactDigest === p.request.artifactDigest
}

/**
 * A serialized receipt is evidence for later reconciliation, NOT an executable
 * authorization or a runtime-minted proof. Rehydration needs trusted verification.
 */
export function serializeOutcomeProof(proof: VerifiedOutcomeProof): OutcomeEvidence {
  if (!minted.has(proof)) throw new Error('Untrusted outcome proof')
  return proof.evidence
}
