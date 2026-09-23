// ─── @nzila/sage-core — institutional Q&A / retrieval context choke point ────
// Mandated synthesis-safety choke: every aggregation used for institutional
// Q&A, assistant-like answers, or annotated context JSON MUST pass candidates
// through buildAuthorizedEvidenceContextPayload BEFORE assembly.
//
// There is no generative AI surface in SAGE today; this is the reusable gate
// for list/search/export-adjacent institutional continuity answers.

import {
  applyAuthorizedEvidenceContextChoke,
  type SageAuthorizedEvidenceContextPayload,
  type SageEvidenceContextCandidate,
  type SageSynthesisPrincipal,
} from './synthesis-context'
import {
  buildInstitutionalQaDocument,
  filterClaimRegisterToAuthorizedContext,
  type SageAuthorizedClaimChainAnswer,
  type SageClaimChainEntry,
} from './claim-chain'
import type { SageAccessContext } from './access-model'
import type { SageAuthorizationLevel } from './types'
import type { SageExportPackageResource } from './export-package'
import { SageInvariantError } from './invariants'

export type SageInstitutionalQaContextInput = {
  actorId: string
  workspaceId: string
  orgId: string
  access: SageAccessContext
  /** All candidates considered for the answer (authorized + unauthorized). */
  candidates: readonly SageEvidenceContextCandidate[]
  /** Optional CLEAR/SAGE claim register mapped to evidence ids. */
  claimRegister?: readonly SageClaimChainEntry[]
  question?: string
}

export type SageInstitutionalQaContext = {
  authorizedContextOnly: true
  question?: string
  principalActorId: string
  workspaceId: string
  orgId: string
  evidence: SageAuthorizedEvidenceContextPayload['evidence']
  claims: readonly SageAuthorizedClaimChainAnswer[]
  excludedCandidateCount: number
}

/**
 * Build the institutional Q&A / retrieval context. ALWAYS filters via
 * buildAuthorizedEvidenceContextPayload first; claim chains attach only to
 * surviving evidence ids.
 */
export function buildSageInstitutionalQaContext(
  input: SageInstitutionalQaContextInput,
): SageInstitutionalQaContext {
  const principal: SageSynthesisPrincipal = {
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    orgId: input.orgId,
    access: input.access,
  }
  const payload = applyAuthorizedEvidenceContextChoke(principal, input.candidates)
  const claims = filterClaimRegisterToAuthorizedContext(
    payload,
    input.claimRegister ?? [],
  )
  // Belt-and-suspenders: no claim may reference an evidence id absent from payload.
  for (const c of claims) {
    if (!payload.evidence.some((e) => e.evidenceItemId === c.evidenceItemId)) {
      throw new SageInvariantError(
        `DO_NOT_REGRESS: claim ${c.claimId} references evidence absent from authorized context`,
      )
    }
  }
  return buildInstitutionalQaDocument({
    payload,
    claims,
    question: input.question,
  })
}

/**
 * Map export package evidence_item resources through the synthesis choke before
 * they may be embedded in package JSON. Non-evidence resources pass through
 * unchanged (they were already authorization-gated at resolve time).
 */
export function filterExportEvidenceResourcesThroughAuthorizedContext(input: {
  actorId: string
  workspaceId: string
  orgId: string
  access: SageAccessContext
  resources: readonly SageExportPackageResource[]
}): {
  resources: SageExportPackageResource[]
  context: SageAuthorizedEvidenceContextPayload
} {
  const candidates: SageEvidenceContextCandidate[] = input.resources
    .filter((r) => r.resourceType === 'evidence_item')
    .map((r) => ({
      evidenceItemId: r.resourceId,
      sourceId: typeof r.content.sourceId === 'string' ? r.content.sourceId : r.resourceId,
      workspaceId: input.workspaceId,
      orgId: input.orgId,
      authorizationLevel: r.authorizationLevel,
      title: typeof r.content.title === 'string' ? r.content.title : undefined,
      excerpt:
        typeof r.content.excerpt === 'string'
          ? r.content.excerpt
          : typeof r.content.note === 'string'
            ? r.content.note
            : undefined,
      metadata: r.content,
    }))

  const principal: SageSynthesisPrincipal = {
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    orgId: input.orgId,
    access: input.access,
  }
  const context = applyAuthorizedEvidenceContextChoke(principal, candidates)
  const allowed = new Set(context.evidence.map((e) => e.evidenceItemId))
  const resources: SageExportPackageResource[] = input.resources.filter((r) => {
    if (r.resourceType !== 'evidence_item') return true
    return allowed.has(r.resourceId)
  })
  return { resources, context }
}
