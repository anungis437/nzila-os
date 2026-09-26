// ─── @nzila/sage-core — authorization-before-context (synthesis / retrieval) ─
// SAGE has no generative AI product surface today. Any future retrieval or
// synthesis path MUST pass candidates through this filter BEFORE building a
// model/context payload. Inaccessible evidence must never enter the payload —
// not as raw text, quote, summary, id-only hint that reveals existence of a
// denied item in mixed sets when the caller asked for "all", nor as an
// inference dependency.
//
// DO_NOT_REGRESS: synthesized/retrieved output must not reveal, quote,
// summarize, infer from, or depend on evidence the principal cannot access.

import {
  canAccessEvidenceLevel,
  type SageAccessContext,
} from './access-model'
import type { SageAuthorizationLevel } from './types'
import { SageInvariantError } from './invariants'

/** A candidate snippet that might be fed to retrieval/synthesis. */
export type SageEvidenceContextCandidate = {
  evidenceItemId: string
  sourceId: string
  /** Workspace the evidence belongs to (cross-workspace must not leak). */
  workspaceId: string
  /** Tenant/org the evidence belongs to (cross-tenant must not leak). */
  orgId: string
  authorizationLevel: SageAuthorizationLevel
  /** Optional narrative the filter must drop entirely when inaccessible. */
  title?: string
  excerpt?: string
  /** Optional free-form fields that must never survive when inaccessible. */
  metadata?: Record<string, unknown>
}

/** What a principal is allowed to see for a single synthesis/retrieval request. */
export type SageSynthesisPrincipal = {
  actorId: string
  /** Active workspace scope for this request. */
  workspaceId: string
  orgId: string
  access: SageAccessContext
}

/**
 * Authorized-only context payload. Deliberately excludes any field that would
 * disclose inaccessible candidates (no "excludedIds", no redacted stubs that
 * reveal count of denied sensitive items beyond an opaque aggregate).
 */
export type SageAuthorizedEvidenceContextPayload = {
  principalActorId: string
  workspaceId: string
  orgId: string
  /** Only authorized snippets; empty when none are accessible. */
  evidence: ReadonlyArray<{
    evidenceItemId: string
    sourceId: string
    authorizationLevel: SageAuthorizationLevel
    title?: string
    excerpt?: string
    metadata?: Record<string, unknown>
  }>
  /** Opaque count of candidates dropped — never identifies which/why. */
  excludedCandidateCount: number
  /**
   * Marker that downstream synthesizers must treat as authoritative: only
   * `evidence` may be quoted, summarized, or depended upon.
   */
  authorizedContextOnly: true
}

function isSameScope(
  candidate: SageEvidenceContextCandidate,
  principal: SageSynthesisPrincipal,
): boolean {
  return (
    candidate.workspaceId === principal.workspaceId && candidate.orgId === principal.orgId
  )
}

/**
 * Pure authorization-before-context filter.
 *
 * Rules (fail closed):
 * - Cross-tenant or cross-workspace candidates are always excluded.
 * - Same-tenant/workspace candidates require membership + canAccessEvidenceLevel.
 * - Revoked grants are already reflected in `access.evidenceAuthorizations`
 *   (callers must not pass revoked levels); this filter re-checks levels only.
 * - Mixed bags retain ONLY accessible items; inaccessible text never appears.
 */
export function buildAuthorizedEvidenceContextPayload(
  principal: SageSynthesisPrincipal,
  candidates: readonly SageEvidenceContextCandidate[],
): SageAuthorizedEvidenceContextPayload {
  const evidence: Array<SageAuthorizedEvidenceContextPayload['evidence'][number]> = []
  let excludedCandidateCount = 0

  for (const c of candidates) {
    if (!isSameScope(c, principal)) {
      excludedCandidateCount += 1
      continue
    }
    if (!canAccessEvidenceLevel(principal.access, c.authorizationLevel)) {
      excludedCandidateCount += 1
      continue
    }
    evidence.push({
      evidenceItemId: c.evidenceItemId,
      sourceId: c.sourceId,
      authorizationLevel: c.authorizationLevel,
      ...(c.title !== undefined ? { title: c.title } : {}),
      ...(c.excerpt !== undefined ? { excerpt: c.excerpt } : {}),
      ...(c.metadata !== undefined ? { metadata: { ...c.metadata } } : {}),
    })
  }

  return {
    principalActorId: principal.actorId,
    workspaceId: principal.workspaceId,
    orgId: principal.orgId,
    evidence,
    excludedCandidateCount,
    authorizedContextOnly: true,
  }
}

/**
 * Assert that a synthesized or retrieved string does not depend on inaccessible
 * evidence. Pass the raw synthesis/retrieval output plus the inaccessible
 * candidates that were offered to the filter. Throws SageInvariantError on
 * regression (quote / title / excerpt / id leak of inaccessible material).
 */
export function assertSynthesisOutputDoesNotLeakInaccessibleEvidence(input: {
  output: string
  inaccessibleCandidates: readonly SageEvidenceContextCandidate[]
}): void {
  const haystack = input.output.toLowerCase()
  for (const c of input.inaccessibleCandidates) {
    const needles: string[] = [c.evidenceItemId, c.sourceId]
    if (c.title) needles.push(c.title)
    if (c.excerpt) needles.push(c.excerpt)
    for (const n of needles) {
      if (!n) continue
      if (haystack.includes(n.toLowerCase())) {
        throw new SageInvariantError(
          `DO_NOT_REGRESS: synthesis/retrieval output leaks inaccessible evidence (${c.evidenceItemId})`,
        )
      }
    }
  }
}

/**
 * Convenience: filter then assert a proposed "model answer" only uses authorized
 * material. Used by unit tests as the executable DO_NOT_REGRESS gate.
 */
export function assertAuthorizedSynthesisPath(input: {
  principal: SageSynthesisPrincipal
  candidates: readonly SageEvidenceContextCandidate[]
  /**
   * Simulated downstream output. Production synthesizers must build answers
   * ONLY from `payload.evidence`; tests pass deliberate good/bad answers.
   */
  proposedOutput: string
}): SageAuthorizedEvidenceContextPayload {
  const payload = buildAuthorizedEvidenceContextPayload(input.principal, input.candidates)
  const inaccessible = input.candidates.filter((c) => {
    if (!isSameScope(c, input.principal)) return true
    return !canAccessEvidenceLevel(input.principal.access, c.authorizationLevel)
  })
  assertSynthesisOutputDoesNotLeakInaccessibleEvidence({
    output: input.proposedOutput,
    inaccessibleCandidates: inaccessible,
  })
  // Also forbid depending on inaccessible ids even if the payload was bypassed.
  for (const c of inaccessible) {
    if (payload.evidence.some((e) => e.evidenceItemId === c.evidenceItemId)) {
      throw new SageInvariantError(
        `DO_NOT_REGRESS: inaccessible evidence entered authorized context payload (${c.evidenceItemId})`,
      )
    }
  }
  return payload
}


/**
 * Canonical synthesis-safety choke marker.
 *
 * EVERY evidence-bearing retrieval / context-assembly / export-evidence path in
 * sage-core MUST call this (or buildAuthorizedEvidenceContextPayload via this
 * wrapper) before returning narrative, ids, or package embeddings to a principal.
 * Architectural regression tests grep for this symbol at required entry points.
 */
export function applyAuthorizedEvidenceContextChoke(
  principal: SageSynthesisPrincipal,
  candidates: readonly SageEvidenceContextCandidate[],
): SageAuthorizedEvidenceContextPayload {
  return buildAuthorizedEvidenceContextPayload(principal, candidates)
}
