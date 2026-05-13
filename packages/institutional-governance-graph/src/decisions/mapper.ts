/**
 * Decision mapper — skeleton.
 *
 * Maps institutional acts (motion outcomes, reserved-matter votes, Class B
 * vetoes, CBA ratifications, protocol amendments) into substrate
 * `DecisionNode` records. The mapper does NOT invent facts; every field
 * comes from the source record or is omitted.
 *
 * This is a SKELETON: it produces well-shaped `DecisionNode`s but does not
 * itself persist them, link them via `DecisionEdge`s, or run policy
 * enforcement. Phase 3 wires the persistence and linkage.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import {
  ActorTypes,
  DecisionStatuses,
  DecisionTypes,
} from '@nzila/platform-decision-graph'
import type {
  MotionSource,
  NegotiationSource,
  ReservedMatterVoteSource,
  RepresentationProtocolSource,
} from '../adapters/source-adapter.js'
import { normalizeLifecycleStatus } from '../lifecycle/normalize.js'
import { IggEntityKinds, IggEventKinds, substrateTypeFor } from '../ontology/kinds.js'

export type InstitutionalDecisionCategory =
  | 'motion_outcome'
  | 'reserved_matter_vote'
  | 'class_b_veto'
  | 'cba_ratification'
  | 'protocol_amendment'

export interface InstitutionalDecisionInput {
  readonly category: InstitutionalDecisionCategory
  readonly tenantId: string
  readonly sourceRecordId: string
  readonly subjectEntityId: string
  readonly summary: string
  readonly outcomeRaw: string
  readonly actorEntityId: string
  readonly actorType?: 'user' | 'system' | 'workflow' | 'policy_engine' | 'ai_model'
  readonly occurredAt: string
  readonly evidenceRefs?: readonly string[]
  readonly policyRefs?: readonly string[]
  readonly knowledgeRefs?: readonly string[]
  readonly reasoning?: string
  readonly confidence?: number
}

const CATEGORY_TO_DECISION_TYPE: Record<
  InstitutionalDecisionCategory,
  (typeof DecisionTypes)[keyof typeof DecisionTypes]
> = {
  motion_outcome: DecisionTypes.POLICY_EVALUATION,
  reserved_matter_vote: DecisionTypes.APPROVAL,
  class_b_veto: DecisionTypes.REJECTION,
  cba_ratification: DecisionTypes.APPROVAL,
  protocol_amendment: DecisionTypes.POLICY_EVALUATION,
}

const CATEGORY_TO_EVENT_KIND: Record<InstitutionalDecisionCategory, string> = {
  motion_outcome: IggEventKinds.MOTION_OUTCOME,
  reserved_matter_vote: IggEventKinds.RESERVED_MATTER_RAISED,
  class_b_veto: IggEventKinds.CLASS_B_VETO,
  cba_ratification: IggEventKinds.CBA_RATIFIED,
  protocol_amendment: IggEventKinds.PROTOCOL_AMENDMENT,
}

/**
 * Map an institutional act into a `DecisionNode` skeleton.
 *
 * The returned node is well-shaped for the substrate but is NOT validated
 * against the substrate's Zod schema (which requires UUIDs); callers are
 * expected to supply well-formed identifiers from the source schema.
 */
export function mapInstitutionalDecision(
  input: InstitutionalDecisionInput,
): DecisionNode {
  const lifecycle = normalizeLifecycleStatus(input.outcomeRaw)
  const isTerminal =
    lifecycle.status !== 'pending' &&
    lifecycle.status !== 'provisional' &&
    lifecycle.status !== 'unknown'
  return {
    id: `igg:decision:${input.category}:${input.sourceRecordId}`,
    tenantId: input.tenantId,
    decisionType: CATEGORY_TO_DECISION_TYPE[input.category],
    status: isTerminal ? DecisionStatuses.EXECUTED : DecisionStatuses.PENDING,
    actorType: input.actorType ?? ActorTypes.WORKFLOW,
    actorId: input.actorEntityId,
    entityType: substrateTypeFor(IggEntityKinds.DECISION),
    entityId: input.subjectEntityId,
    summary: input.summary,
    outcome: {
      iggCategory: input.category,
      iggEventKind: CATEGORY_TO_EVENT_KIND[input.category],
      lifecycleStatus: lifecycle.status,
      originalOutcome: lifecycle.originalStatus,
      ...(lifecycle.warning ? { lifecycleWarning: lifecycle.warning } : {}),
    },
    confidence: input.confidence,
    policyRefs: input.policyRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    knowledgeRefs: input.knowledgeRefs ?? [],
    reasoning: input.reasoning,
    createdAt: input.occurredAt,
    executedAt: isTerminal ? input.occurredAt : undefined,
  }
}

// ── Convenience adapters from source-record shapes ──────────────────────────

export function mapMotionDecision(row: MotionSource): DecisionNode {
  return mapInstitutionalDecision({
    category: 'motion_outcome',
    tenantId: row.tenantId,
    sourceRecordId: row.id,
    subjectEntityId: row.committeeId ?? row.id,
    summary: row.title,
    outcomeRaw: row.outcome,
    actorEntityId: row.proposerEntityId ?? 'unknown',
    occurredAt: row.decidedAt ?? new Date(0).toISOString(),
    evidenceRefs: row.evidenceRefs,
    policyRefs: row.policyRefs,
    reasoning: row.reasoning,
  })
}

export function mapReservedMatterVoteDecision(
  row: ReservedMatterVoteSource,
): DecisionNode {
  const isVeto = row.outcome.toLowerCase().includes('veto')
  return mapInstitutionalDecision({
    category: isVeto ? 'class_b_veto' : 'reserved_matter_vote',
    tenantId: row.tenantId,
    sourceRecordId: row.id,
    subjectEntityId: row.reservedMatterId,
    summary: `Reserved Matter ${row.reservedMatterId} — ${row.outcome}`,
    outcomeRaw: row.outcome,
    actorEntityId: row.classBHolderEntityId,
    occurredAt: row.castAt,
    evidenceRefs: row.evidenceRefs,
    policyRefs: row.policyRefs,
    reasoning: row.reasoning,
  })
}

export function mapCbaRatificationDecision(
  row: NegotiationSource,
): DecisionNode | null {
  if (!row.cbaRatifiedAt) return null
  return mapInstitutionalDecision({
    category: 'cba_ratification',
    tenantId: row.tenantId,
    sourceRecordId: row.id,
    subjectEntityId: row.bargainingUnitId,
    summary: `CBA ratified for bargaining unit ${row.bargainingUnitId}`,
    outcomeRaw: 'approved',
    actorEntityId: row.employerOrganizationId,
    occurredAt: row.cbaRatifiedAt,
    evidenceRefs: row.evidenceRefs,
    policyRefs: row.policyRefs,
    reasoning: row.reasoning,
  })
}

export function mapProtocolAmendmentDecision(
  row: RepresentationProtocolSource,
): DecisionNode {
  return mapInstitutionalDecision({
    category: 'protocol_amendment',
    tenantId: row.tenantId,
    sourceRecordId: row.id,
    subjectEntityId: row.representedEntityId,
    summary: `Representation protocol v${row.protocolVersion} for ${row.representedEntityId}`,
    outcomeRaw: row.status,
    actorEntityId: row.representativeEntityId,
    occurredAt: row.validFrom ?? new Date(0).toISOString(),
  })
}
