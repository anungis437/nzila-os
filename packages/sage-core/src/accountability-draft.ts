// SAGE executive accountability — authorization-filtered DRAFT projection.
//
// Do not confuse a readable, source-consistent draft with an authoritative
// institutionally adopted decision. This pure builder cannot attest any
// institution's records, verify a delegated mandate or perform a mutation.
// It may only run AFTER the caller's workspace access and evidence grants have
// been enforced and buildAuthorizedEvidenceContextPayload has filtered sources.
//
// The data flow becomes: institutionally controlled source references →
// authorized evidence context → source-bound accountability draft → later
// independent human review/adoption. No causality, score, ranking, certification,
// invented missing values or unreviewed institutional decision.

import { SageInvariantError } from './invariants'
import type { SageAuthorizationLevel } from './types'
import type { SageAuthorizedEvidenceContextPayload } from './synthesis-context'

export type SageAccountabilityEvidenceRef = {
  evidenceItemId: string
  sourceId: string
  authorizationLevel: SageAuthorizationLevel
}

export type SageAccountabilityMeasure = {
  value: number
  unit: 'working_days' | 'count' | 'percentage_points'
  window: string
  evidence: SageAccountabilityEvidenceRef
}

export type SageAccountabilityDraftInput = {
  orgId: string
  workspaceId: string
  resourceId: string
  objective: string
  accountableActorId: string
  intervention: string
  reviewDueAt: string
  /** An asserted institutional authority, NOT an attested mandate. */
  authority?: {
    instrumentReference: string
    evidence: SageAccountabilityEvidenceRef
  }
  commitment?: {
    monetaryCeilingMinor: number
    currency: string
    expectedDeliverables: number
    evidence: SageAccountabilityEvidenceRef
  }
  execution?: {
    receivedDeliverables: number
    evidence: SageAccountabilityEvidenceRef
    acceptedDeliverables?: number
    acceptanceEvidence?: SageAccountabilityEvidenceRef
  }
  expected: SageAccountabilityMeasure
  observed?: SageAccountabilityMeasure
  actualSpend?: {
    amountMinor: number
    currency: string
    evidence: SageAccountabilityEvidenceRef
  }
  differingInterpretations?: readonly {
    id: string
    statement: string
    evidence: readonly SageAccountabilityEvidenceRef[]
  }[]
  nextDecisionOwnerActorId?: string
}

export type SageAccountabilityDraftOutput = {
  status: 'DRAFT_REQUIRES_HUMAN_ADOPTION'
  orgId: string
  workspaceId: string
  resourceId: string
  objective: string
  accountableActorId: string
  intervention: string
  reviewDueAt: string
  /** Source reference is visible; institutional authority NOT attested here. */
  authority: { status: 'UNATTESTED'; instrumentReference: string | null; evidence: SageAccountabilityEvidenceRef | null }
  commitment: {
    status: 'RECORDED_UNVERIFIED' | 'MISSING'
    monetaryCeilingMinor: number | null
    currency: string | null
    expectedDeliverables: number | null
    receivedDeliverables: number | null
    acceptedDeliverables: number | null
    actualSpendMinor: number | null
    commitmentEvidence: SageAccountabilityEvidenceRef | null
    executionEvidence: SageAccountabilityEvidenceRef | null
    acceptanceEvidence: SageAccountabilityEvidenceRef | null
    actualSpendEvidence: SageAccountabilityEvidenceRef | null
  }
  outcome: {
    expected: SageAccountabilityMeasure
    observed: SageAccountabilityMeasure | null
    comparison: 'COMPARABLE' | 'INCOMPARABLE' | 'MISSING_OBSERVATION'
    delta: number | null
    percentVsExpected: number | null
  }
  differingInterpretations: readonly {
    id: string
    statement: string
    disposition: 'UNRESOLVED'
    evidence: readonly SageAccountabilityEvidenceRef[]
  }[]
  nextDecisionOwnerActorId: string | null
  /** Explicit missing values rather than inferred spend/acceptance/outcomes. */
  missing: readonly (
    | 'authority_attestation'
    | 'commitment'
    | 'execution'
    | 'deliverable_acceptance'
    | 'observation'
    | 'actual_spend'
    | 'next_decision_owner'
    | 'human_adoption'
  )[]
  humanAdoption: 'NOT_ESTABLISHED'
  causalAttribution: 'NOT_ASSESSED'
  /** The source-binding check is NOT a claim of independent verification. */
  evidentiaryPosture: 'AUTHORIZED_REFERENCES_NOT_INSTITUTIONALLY_ATTESTED'
}

function fail(message: string): never {
  throw new SageInvariantError('SAGE accountability draft: ' + message)
}

function required(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) fail(name + ' required')
}

function validUtcInstant(value: string, label: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) fail(label + ' must be a valid canonical UTC timestamp')
}

function nonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) fail(field + ' must be finite and nonnegative')
}

function nonNegativeSafeInt(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) fail(field + ' must be a safe nonnegative integer')
}

function validateMeasure(measure: SageAccountabilityMeasure, name: string): void {
  nonNegativeFinite(measure.value, name)
  if (!['working_days', 'count', 'percentage_points'].includes(measure.unit)) {
    fail(name + ' uses an unsupported measure unit')
  }
  required(measure.window, name + ' window')
}

/**
 * A deliberately non-authoritative, deterministic executive/accountability
 * draft. The only permissible provenance ids are those that survived SAGE's
 * authorization-before-context gate, including their EXACT source and level.
 *
 * Integration contract: call only from a server route that has established
 * membership and SAGE permissions; load organization facts from authoritative
 * tables; do not allow request JSON to supply or upgrade those facts.
 */
export function buildSageAccountabilityDraft(
  payload: SageAuthorizedEvidenceContextPayload,
  input: SageAccountabilityDraftInput,
): SageAccountabilityDraftOutput {
  if (
    payload.authorizedContextOnly !== true ||
    input.orgId !== payload.orgId ||
    input.workspaceId !== payload.workspaceId ||
    !payload.principalActorId
  ) fail('authorized principal and exact workspace scope required')

  for (const [name, value] of Object.entries({
    resourceId: input.resourceId,
    objective: input.objective,
    accountableActorId: input.accountableActorId,
    intervention: input.intervention,
    reviewDueAt: input.reviewDueAt,
  })) required(value, name)
  validUtcInstant(input.reviewDueAt, 'reviewDueAt')

  // A duplicate item ID is ambiguous even when the duplicate rows agree.
  const permitted = new Map<string, SageAccountabilityEvidenceRef | null>()
  for (const e of payload.evidence) {
    if (permitted.has(e.evidenceItemId)) {
      permitted.set(e.evidenceItemId, null)
    } else {
      permitted.set(e.evidenceItemId, {
        evidenceItemId: e.evidenceItemId,
        sourceId: e.sourceId,
        authorizationLevel: e.authorizationLevel,
      })
    }
  }

  function assertAuthorized(ref: SageAccountabilityEvidenceRef, label: string): void {
    if (!ref) fail(label + ' has no evidence reference')
    const e = permitted.get(ref.evidenceItemId)
    if (
      !e ||
      e.sourceId !== ref.sourceId ||
      e.authorizationLevel !== ref.authorizationLevel
    ) fail(label + ' not bound to exact authorized evidence/source/classification')
  }

  validateMeasure(input.expected, 'expected')
  assertAuthorized(input.expected.evidence, 'expected measure')
  if (input.observed) {
    validateMeasure(input.observed, 'observed')
    assertAuthorized(input.observed.evidence, 'observed measure')
  }

  if (input.authority) {
    required(input.authority.instrumentReference, 'instrumentReference')
    assertAuthorized(input.authority.evidence, 'authority instrument')
  }
  if (input.commitment) {
    nonNegativeSafeInt(input.commitment.monetaryCeilingMinor, 'monetary ceiling')
    nonNegativeSafeInt(input.commitment.expectedDeliverables, 'expected deliverables')
    required(input.commitment.currency, 'commitment currency')
    assertAuthorized(input.commitment.evidence, 'commitment')
  }
  if (input.execution) {
    if (!input.commitment) fail('execution requires a source-bound commitment')
    nonNegativeSafeInt(input.execution.receivedDeliverables, 'received deliverables')
    if (input.execution.acceptedDeliverables !== undefined) {
      nonNegativeSafeInt(input.execution.acceptedDeliverables, 'accepted deliverables')
      if (!input.execution.acceptanceEvidence) fail('acceptance evidence required')
      if (input.execution.acceptedDeliverables > input.execution.receivedDeliverables) {
        fail('acceptance cannot exceed received deliverables')
      }
      assertAuthorized(input.execution.acceptanceEvidence, 'deliverable acceptance')
    } else if (input.execution.acceptanceEvidence) {
      fail('acceptance evidence without accepted deliverables')
    }
    assertAuthorized(input.execution.evidence, 'execution')
  }
  if (input.actualSpend) {
    if (!input.commitment) fail('actual spend requires source-bound commitment')
    nonNegativeSafeInt(input.actualSpend.amountMinor, 'actual spend')
    if (input.actualSpend.currency !== input.commitment.currency) {
      fail('actual spend currency does not match commitment currency')
    }
    assertAuthorized(input.actualSpend.evidence, 'actual spend')
  }

  const differing = input.differingInterpretations ?? []
  const seen = new Set<string>()
  for (const interpretation of differing) {
    required(interpretation.id, 'interpretation id')
    required(interpretation.statement, 'interpretation statement')
    if (seen.has(interpretation.id)) fail('duplicate interpretation id')
    seen.add(interpretation.id)
    if (interpretation.evidence.length === 0) fail('interpretation lacks supporting evidence')
    for (const e of interpretation.evidence) assertAuthorized(e, 'interpretation')
  }

  const observed = input.observed ?? null
  const comparable = Boolean(
    observed &&
    observed.unit === input.expected.unit &&
    observed.window === input.expected.window,
  )
  const delta = comparable ? observed!.value - input.expected.value : null
  // A zero expectation has no meaningful percentage denominator.
  const percentVsExpected =
    delta !== null && input.expected.value !== 0
      ? (delta / input.expected.value) * 100
      : null

  const missing: SageAccountabilityDraftOutput['missing'][number][] = ['authority_attestation']
  if (!input.commitment) missing.push('commitment')
  if (!input.execution) missing.push('execution')
  if (input.execution?.acceptedDeliverables === undefined) missing.push('deliverable_acceptance')
  if (!observed) missing.push('observation')
  if (!input.actualSpend) missing.push('actual_spend')
  if (!input.nextDecisionOwnerActorId?.trim()) missing.push('next_decision_owner')
  missing.push('human_adoption')

  return {
    status: 'DRAFT_REQUIRES_HUMAN_ADOPTION',
    orgId: input.orgId,
    workspaceId: input.workspaceId,
    resourceId: input.resourceId,
    objective: input.objective,
    accountableActorId: input.accountableActorId,
    intervention: input.intervention,
    reviewDueAt: input.reviewDueAt,
    authority: {
      status: 'UNATTESTED',
      instrumentReference: input.authority?.instrumentReference ?? null,
      evidence: input.authority ? { ...input.authority.evidence } : null,
    },
    commitment: {
      status: input.commitment ? 'RECORDED_UNVERIFIED' : 'MISSING',
      monetaryCeilingMinor: input.commitment?.monetaryCeilingMinor ?? null,
      currency: input.commitment?.currency ?? null,
      expectedDeliverables: input.commitment?.expectedDeliverables ?? null,
      receivedDeliverables: input.execution?.receivedDeliverables ?? null,
      acceptedDeliverables: input.execution?.acceptedDeliverables ?? null,
      actualSpendMinor: input.actualSpend?.amountMinor ?? null,
      commitmentEvidence: input.commitment ? { ...input.commitment.evidence } : null,
      executionEvidence: input.execution ? { ...input.execution.evidence } : null,
      acceptanceEvidence: input.execution?.acceptanceEvidence ? { ...input.execution.acceptanceEvidence } : null,
      actualSpendEvidence: input.actualSpend ? { ...input.actualSpend.evidence } : null,
    },
    outcome: {
      expected: structuredClone(input.expected),
      observed: observed ? structuredClone(observed) : null,
      comparison: !observed
        ? 'MISSING_OBSERVATION'
        : comparable
          ? 'COMPARABLE'
          : 'INCOMPARABLE',
      delta,
      percentVsExpected,
    },
    differingInterpretations: differing.map((d) => ({
      id: d.id,
      statement: d.statement,
      disposition: 'UNRESOLVED' as const,
      evidence: d.evidence.map((e) => ({ ...e })),
    })),
    nextDecisionOwnerActorId: input.nextDecisionOwnerActorId?.trim() || null,
    missing,
    humanAdoption: 'NOT_ESTABLISHED',
    causalAttribution: 'NOT_ASSESSED',
    evidentiaryPosture: 'AUTHORIZED_REFERENCES_NOT_INSTITUTIONALLY_ATTESTED',
  }
}
