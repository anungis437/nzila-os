// SAGE executive accountability — human adoption gate.
//
// A draft produced by buildSageAccountabilityDraft is never an institutional
// conclusion. Adoption requires an independently admitted institutional mandate
// for decision.ratify (or a successor action) plus an explicit human choice.
// This module records the adoption decision as a pure, auditable structure; the
// transactional write path must persist it via executeInstitutionalActionInTransaction.

import { SageInvariantError } from './invariants'
import type { SageAccountabilityDraftOutput } from './accountability-draft'
import type { SageInstitutionalMandateDecision } from './institutional-authority'

export type SageAccountabilityAdoptionChoice = 'adopt' | 'decline' | 'defer' | 'challenge'

export type SageAccountabilityAdoptionInput = {
  draft: SageAccountabilityDraftOutput
  choice: SageAccountabilityAdoptionChoice
  /** ISO-8601 UTC from the trusted server clock. */
  adoptedAt: string
  adoptingActorId: string
  adoptingPositionId: string
  rationale: string
  /** Result of evaluateSageInstitutionalMandate / transactional admission. */
  mandateDecision: SageInstitutionalMandateDecision
  /** Optional successor named when deferring or challenging. */
  nextDecisionOwnerActorId?: string
}

export type SageAccountabilityAdoptionRecord =
  | {
      status: 'ADOPTED' | 'DECLINED' | 'DEFERRED' | 'CHALLENGED'
      orgId: string
      workspaceId: string
      resourceId: string
      draftStatusPreserved: 'DRAFT_REQUIRES_HUMAN_ADOPTION'
      choice: SageAccountabilityAdoptionChoice
      adoptedAt: string
      adoptingActorId: string
      adoptingPositionId: string
      rationale: string
      mandateId: string
      instrumentRef: string
      instrumentVersion: string
      nextDecisionOwnerActorId: string | null
      /** Explicit: adoption does not invent missing spend or causal attribution. */
      preservesDraftFacts: true
    }

const CHOICES: readonly SageAccountabilityAdoptionChoice[] = [
  'adopt',
  'decline',
  'defer',
  'challenge',
]

function requireIso(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new SageInvariantError(`${label} must be a canonical UTC ISO-8601 instant`)
  }
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== (value.includes('.') ? value : value.replace('Z', '.000Z'))) {
    throw new SageInvariantError(`${label} must be a canonical UTC ISO-8601 instant`)
  }
  return value.includes('.') ? value : value.replace('Z', '.000Z')
}

/**
 * Convert an accountability draft into an explicit human adoption record.
 * Fails closed unless the mandate decision is ADMITTED for this actor/resource.
 * Never mutates the draft or invents expenditure, acceptance or causation.
 */
export function adoptSageAccountabilityDraft(
  input: SageAccountabilityAdoptionInput,
): SageAccountabilityAdoptionRecord {
  if (input.draft.status !== 'DRAFT_REQUIRES_HUMAN_ADOPTION') {
    throw new SageInvariantError('only an unadopted accountability draft may be decided')
  }
  if (!CHOICES.includes(input.choice)) {
    throw new SageInvariantError('adoption choice must be adopt, decline, defer or challenge')
  }
  if (!input.rationale.trim()) {
    throw new SageInvariantError('a human rationale is required for adoption decisions')
  }
  if (!input.adoptingActorId.trim() || !input.adoptingPositionId.trim()) {
    throw new SageInvariantError('adopting actor and position are required')
  }
  if (input.adoptingActorId === 'system' || input.adoptingActorId.startsWith('service:')) {
    throw new SageInvariantError('institutional adoption requires a named human actor')
  }
  if (!input.mandateDecision.allowed) {
    throw new SageInvariantError(
      `institutional mandate denied: ${input.mandateDecision.reason}`,
    )
  }

  const adoptedAt = requireIso(input.adoptedAt, 'adoptedAt')
  const status =
    input.choice === 'adopt'
      ? 'ADOPTED'
      : input.choice === 'decline'
        ? 'DECLINED'
        : input.choice === 'defer'
          ? 'DEFERRED'
          : 'CHALLENGED'

  if (
    (input.choice === 'defer' || input.choice === 'challenge') &&
    !input.nextDecisionOwnerActorId?.trim()
  ) {
    throw new SageInvariantError('defer/challenge requires a next decision owner')
  }

  return {
    status,
    orgId: input.draft.orgId,
    workspaceId: input.draft.workspaceId,
    resourceId: input.draft.resourceId,
    draftStatusPreserved: 'DRAFT_REQUIRES_HUMAN_ADOPTION',
    choice: input.choice,
    adoptedAt,
    adoptingActorId: input.adoptingActorId,
    adoptingPositionId: input.adoptingPositionId,
    rationale: input.rationale.trim(),
    mandateId: input.mandateDecision.mandateId,
    instrumentRef: input.mandateDecision.instrumentRef,
    instrumentVersion: input.mandateDecision.instrumentVersion,
    nextDecisionOwnerActorId: input.nextDecisionOwnerActorId?.trim() || null,
    preservesDraftFacts: true,
  }
}
