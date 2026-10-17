import { z } from 'zod'
import {
  institutionBindingSchema, institutionalReferenceSchema,
  type InstitutionalMutationContext, type InstitutionalReference,
} from '@nzila/platform-contracts'
import { decisionAnalysisSchema, decisionAnalysisInputSchema } from '@nzila/decision-intelligence-engine/schema/decision'
import {
  governanceRationaleSchema, decideInstitutionalRationale, verifyInstitutionalRationale,
  assertRationaleIsImmutable, institutionalRationalePayloadSchema,
} from '@nzila/governance-rationale'
import { bindingRegistryScope } from './bindings'
import type { InstitutionalMutationBoundary } from './audit'
import type { StoredInstitutionalRecord } from './local-store'
import { foundationHash, institutionalCommandSchema, type InstitutionalCommand } from './authority'

const missionStatus = z.enum(['proposed', 'authorized', 'active', 'blocked', 'completed', 'closed', 'cancelled'])
const missionSchema = z.object({
  title: z.string().min(1), desiredOutcome: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  accountableOwner: z.string().min(1), executionOwner: z.string().min(1),
  status: missionStatus, producer: z.string().min(1), auditEventId: z.string().uuid(),
  blockedFrom: z.enum(['authorized', 'active']).nullable(), amendmentPending: z.boolean(),
  evidenceRefs: z.array(institutionalReferenceSchema),
})
export const engagementSchema = z.object({
  sponsor: z.string().min(1), counterpart: z.string().min(1), specialist: z.string().min(1),
  effectiveAt: z.string().datetime(), expiresAt: z.string().datetime(),
  status: z.enum(['DRAFT', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLOSING', 'CLOSED', 'REVOKED']),
  approvedBy: z.string().nullable(), auditEventId: z.string().uuid(),
})
export const outputSchema = z.object({
  engagementRef: institutionalReferenceSchema, producer: z.string().min(1),
  content: z.string().min(1), digest: z.string(), submittedAt: z.string().datetime(),
  status: z.literal('SUBMITTED'), auditEventId: z.string().uuid(),
})
const analysisStoredSchema = z.object({
  analysis: decisionAnalysisSchema, evidenceRefs: z.array(institutionalReferenceSchema),
  auditEventId: z.string().uuid(),
})
const rationaleStoredSchema = z.object({
  record: z.object({ payload: institutionalRationalePayloadSchema, hashVersion: z.literal(1), payloadHash: z.string() }),
  auditEventId: z.string().uuid(),
})
export const foundationActions = [
  'institution.enroll', 'assignment.create', 'mission.create', 'mission.transition', 'mission.amend',
  'engagement.create', 'engagement.transition', 'recommendation.submit', 'output.accept',
  'analysis.create', 'rationale.record', 'rationale.supersede',
] as const
export type FoundationAction = typeof foundationActions[number]

export class InstitutionalFoundationRuntime {
  constructor(readonly boundary: InstitutionalMutationBoundary,
    readonly missionGuard?: (context: InstitutionalMutationContext, next: string) => void,
    readonly specialistGuard?: (context: InstitutionalMutationContext, engagement: InstitutionalReference) => void) {}

  execute(session: string, action: FoundationAction, raw: unknown): StoredInstitutionalRecord & { auditDelivery: 'PENDING' | 'RECORDED' } {
    z.enum(foundationActions).parse(action)
    let authorityAction: string = action
    if (action === 'mission.transition' || action === 'engagement.transition') {
      const requested = z.object({ next: z.string().min(1) }).parse(institutionalCommandSchema.parse(raw).payload)
      authorityAction = `${action.split('.')[0]}.${requested.next.toLowerCase()}`
    }
    const { command, context } = this.boundary.authority.resolve(session, authorityAction, raw)
    const committed = this.boundary.commit(context, command.expectedVersion, () => {
      switch (action) {
        case 'institution.enroll': return this.#enroll(context, command)
        case 'assignment.create': return this.#assign(context, command)
        case 'mission.create': return this.#createMission(context, command)
        case 'mission.transition': return this.#transitionMission(context, command)
        case 'mission.amend': return this.#amendMission(context, command)
        case 'engagement.create': return this.#createEngagement(context, command)
        case 'engagement.transition': return this.#transitionEngagement(context, command)
        case 'recommendation.submit': return this.#submit(context, command)
        case 'output.accept': return this.#accept(context, command)
        case 'analysis.create': return this.#analysis(context, command)
        case 'rationale.record': return this.#rationale(context, command, false)
        case 'rationale.supersede': return this.#rationale(context, command, true)
      }
    }, context.target.kind === 'Mission' ? { mission: context.target }
      : context.target.kind === 'GovernanceRationale' ? { decision: context.target } : {})
    return { ...committed, auditDelivery: this.boundary.deliveryState(context.target.scope, context.requestId) }
  }

  mutateDecidedRationale(): never { return assertRationaleIsImmutable() }

  effectiveRationale(session: string, raw: unknown): StoredInstitutionalRecord {
    const { context } = this.boundary.authority.resolve(session, 'rationale.read', raw)
    const ref = context.target
    if (ref.kind !== 'GovernanceRationale') throw new Error('TARGET_KIND_MISMATCH')
    if (!this.boundary.authority.ports.canReadReference(context.actor, ref)) this.#deny(context, 'REFERENCE_READ_DENIED')
    const row = this.boundary.store.get(ref.scope, 'GovernanceRationale', ref.sourceId, ref.revision)
    if (!row) throw new Error('REFERENCE_NOT_FOUND')
    const stored = rationaleStoredSchema.parse(row.data)
    verifyInstitutionalRationale(stored.record)
    this.boundary.requireRecorded(ref.scope, stored.auditEventId)
    if (this.boundary.store.successor(ref.scope, ref.sourceId)) throw new Error('RATIONALE_SUPERSEDED')
    return row
  }

  #append(ctx: InstitutionalMutationContext, command: InstitutionalCommand, kind: string, data: unknown): StoredInstitutionalRecord {
    if (ctx.target.kind !== kind) this.#deny(ctx, 'TARGET_KIND_MISMATCH')
    return this.boundary.store.append(ctx.target.scope, kind, ctx.target.sourceId, command.expectedVersion, data)
  }

  #get(ref: InstitutionalReference, ctx: InstitutionalMutationContext): StoredInstitutionalRecord {
    if (ref.scope.type !== ctx.target.scope.type || ref.scope.id !== ctx.target.scope.id) this.#deny(ctx, 'CROSS_SCOPE_REFERENCE_DENIED')
    if (!this.boundary.authority.ports.canReadReference(ctx.actor, ref)) this.#deny(ctx, 'REFERENCE_READ_DENIED')
    const row = this.boundary.store.get(ref.scope, ref.kind, ref.sourceId, ref.revision)
    if (!row) this.#deny(ctx, 'REFERENCE_NOT_FOUND')
    const envelope = z.object({ auditEventId: z.string().uuid() }).parse(row.data)
    this.boundary.requireRecorded(ref.scope, envelope.auditEventId)
    return row
  }

  #human(ctx: InstitutionalMutationContext, differentFrom?: string): void {
    this.boundary.authority.internalHuman(ctx, differentFrom)
  }

  #owner(ctx: InstitutionalMutationContext, id: string): void {
    const actor = this.boundary.authority.ports.principal(id)
    if (!actor || actor.classification !== 'INTERNAL_HUMAN' || !actor.internalAffiliation
      || !this.boundary.authority.ports.assignedInternalHuman(id, ctx.target.scope)) this.#deny(ctx, 'ASSIGNED_INTERNAL_OWNER_REQUIRED')
  }

  #enroll(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    this.#human(ctx)
    z.object({}).strict().parse(command.payload)
    const proposed = this.boundary.authority.ports.enrollmentBinding(ctx.target)
    const binding = institutionBindingSchema.parse({ ...proposed, authorityRef: ctx.authorityRef, approvedBy: ctx.actor.id })
    this.boundary.store.append(bindingRegistryScope, 'InstitutionBinding', binding.institutionId, 0, binding)
    return this.#append(ctx, command, 'InstitutionBinding', { binding, auditEventId: ctx.requestId })
  }

  #assign(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    this.#human(ctx)
    const input = z.object({
      principalId: z.string().min(1), effectiveAt: z.string().datetime(), expiresAt: z.string().datetime(),
    }).strict().parse(command.payload)
    const principal = this.boundary.authority.ports.principal(input.principalId)
    if (!principal || principal.classification !== 'INTERNAL_HUMAN' || !principal.internalAffiliation
      || input.expiresAt <= input.effectiveAt) this.#deny(ctx, 'ASSIGNED_INTERNAL_OWNER_REQUIRED')
    return this.#append(ctx, command, 'HumanAssignment', { ...input, appointedBy: ctx.actor.id,
      authorityRef: ctx.authorityRef, auditEventId: ctx.requestId })
  }

  #createMission(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    this.#human(ctx)
    const input = z.object({
      title: z.string().min(1), desiredOutcome: z.string().min(1),
      acceptanceCriteria: z.array(z.string().min(1)).min(1),
      accountableOwner: z.string().min(1), executionOwner: z.string().min(1),
    }).strict().parse(command.payload)
    this.#owner(ctx, input.accountableOwner)
    const executionOwner = this.boundary.authority.ports.principal(input.executionOwner)
    if (!executionOwner || !['INTERNAL_HUMAN', 'AGENT', 'SYSTEM'].includes(executionOwner.classification)) {
      this.#deny(ctx, 'EXECUTION_OWNER_NOT_INTERNAL_OR_GOVERNED_MACHINE')
    }
    if (executionOwner.classification === 'INTERNAL_HUMAN') this.#owner(ctx, executionOwner.id)
    return this.#append(ctx, command, 'Mission', missionSchema.parse({
      ...input, status: 'proposed', producer: input.executionOwner, auditEventId: ctx.requestId,
      blockedFrom: null, amendmentPending: false, evidenceRefs: [],
    }))
  }

  #current(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    const row = this.boundary.store.get(ctx.target.scope, ctx.target.kind, ctx.target.sourceId)
    if (!row || row.version !== command.expectedVersion) this.#deny(ctx, 'CONFLICT')
    const envelope = z.object({ auditEventId: z.string().uuid() }).parse(row.data)
    this.boundary.requireRecorded(ctx.target.scope, envelope.auditEventId)
    return row
  }

  #transitionMission(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    const input = z.object({ next: missionStatus, evidenceRefs: z.array(institutionalReferenceSchema).default([]) }).strict().parse(command.payload)
    const old = missionSchema.parse(this.#current(ctx, command).data)
    this.missionGuard?.(ctx, input.next)
    if (old.status === 'closed' || old.status === 'cancelled') this.#deny(ctx, 'MISSION_TERMINAL')
    this.#owner(ctx, old.accountableOwner)
    const transitions: Record<z.infer<typeof missionStatus>, string[]> = {
      proposed: ['authorized', 'cancelled'], authorized: ['active', 'blocked', 'cancelled'],
      active: ['blocked', 'completed', 'cancelled'], blocked: [old.blockedFrom ?? 'authorized', 'cancelled'],
      completed: ['closed', 'cancelled'], closed: [], cancelled: [],
    }
    if (!transitions[old.status].includes(input.next)) this.#deny(ctx, 'MISSION_TRANSITION_DENIED')
    if (['authorized', 'closed', 'cancelled'].includes(input.next)) this.#human(ctx, input.next === 'closed' ? old.producer : undefined)
    else if (ctx.actor.id !== old.executionOwner && ctx.actor.classification !== 'INTERNAL_HUMAN') this.#deny(ctx, 'EXECUTION_OWNER_REQUIRED')
    if (input.next === 'active' && old.amendmentPending) this.#deny(ctx, 'MISSION_REAUTHORIZATION_REQUIRED')
    if (['completed', 'closed'].includes(input.next) && input.evidenceRefs.length === 0) this.#deny(ctx, 'MISSION_EVIDENCE_REQUIRED')
    for (const ref of input.evidenceRefs) this.#get(ref, ctx)
    if (input.next === 'closed') {
      const acceptedCriteria = input.evidenceRefs.filter(ref => ref.kind === 'OutputAcceptance')
        .map(ref => z.object({ criteria: z.string(), acceptedBy: z.string() }).parse(this.#get(ref, ctx).data))
      if (!old.acceptanceCriteria.every(criterion => acceptedCriteria.some(accepted => accepted.criteria === criterion))) {
        this.#deny(ctx, 'MISSION_CRITERIA_NOT_ACCEPTED')
      }
    }
    return this.#append(ctx, command, 'Mission', {
      ...old, status: input.next, auditEventId: ctx.requestId,
      producer: input.next === 'completed' ? ctx.actor.id : old.producer,
      blockedFrom: input.next === 'blocked' ? old.status : null,
      amendmentPending: input.next === 'authorized' ? false : old.amendmentPending,
      evidenceRefs: input.evidenceRefs.length ? input.evidenceRefs : old.evidenceRefs,
    })
  }

  #amendMission(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    this.#human(ctx)
    const input = z.object({ desiredOutcome: z.string().min(1), acceptanceCriteria: z.array(z.string().min(1)).min(1) }).strict().parse(command.payload)
    const old = missionSchema.parse(this.#current(ctx, command).data)
    if (!['proposed', 'authorized'].includes(old.status)) this.#deny(ctx, 'ACTIVE_SCOPE_EXPANSION_REQUIRES_SUSPENSION')
    return this.#append(ctx, command, 'Mission', { ...old, ...input, status: 'proposed',
      amendmentPending: true, auditEventId: ctx.requestId })
  }

  #createEngagement(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    this.#human(ctx)
    const input = z.object({
      sponsor: z.string(), counterpart: z.string(), specialist: z.string(),
      effectiveAt: z.string().datetime(), expiresAt: z.string().datetime(),
    }).strict().parse(command.payload)
    this.#owner(ctx, input.sponsor)
    this.#owner(ctx, input.counterpart)
    const specialist = this.boundary.authority.ports.principal(input.specialist)
    if (!specialist || !['EXTERNAL_HUMAN', 'EXTERNAL_AI'].includes(specialist.classification)
      || input.expiresAt <= input.effectiveAt) this.#deny(ctx, 'ENGAGEMENT_SCOPE_INVALID')
    return this.#append(ctx, command, 'SpecialistEngagement', {
      ...input, status: 'DRAFT', approvedBy: null, auditEventId: ctx.requestId,
    })
  }

  #transitionEngagement(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    const input = z.object({ next: engagementSchema.shape.status }).strict().parse(command.payload)
    const old = engagementSchema.parse(this.#current(ctx, command).data)
    this.#human(ctx, input.next === 'APPROVED' ? old.sponsor : old.specialist)
    const allowed: Record<z.infer<typeof engagementSchema>['status'], string[]> = {
      DRAFT: ['APPROVED', 'CLOSED', 'REVOKED'], APPROVED: ['ACTIVE', 'EXPIRED', 'CLOSED', 'REVOKED'],
      ACTIVE: ['SUSPENDED', 'EXPIRED', 'CLOSING', 'REVOKED'], SUSPENDED: ['ACTIVE', 'EXPIRED', 'CLOSING', 'REVOKED'],
      EXPIRED: ['CLOSING', 'REVOKED'], CLOSING: ['CLOSED', 'REVOKED'], CLOSED: [], REVOKED: [],
    }
    if (!allowed[old.status].includes(input.next)) this.#deny(ctx, 'ENGAGEMENT_TRANSITION_DENIED')
    if (input.next === 'ACTIVE' && (!old.approvedBy || old.expiresAt <= ctx.occurredAt
      || old.effectiveAt > ctx.occurredAt)) this.#deny(ctx, 'ENGAGEMENT_NOT_ACTIVE')
    return this.#append(ctx, command, 'SpecialistEngagement', { ...old, status: input.next,
      approvedBy: input.next === 'APPROVED' ? ctx.actor.id : old.approvedBy, auditEventId: ctx.requestId })
  }

  #submit(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    const input = z.object({ engagementRef: institutionalReferenceSchema, content: z.string().min(1) }).strict().parse(command.payload)
    this.specialistGuard?.(ctx, input.engagementRef)
    this.#get(input.engagementRef, ctx)
    const latest = this.boundary.store.get(input.engagementRef.scope, 'SpecialistEngagement', input.engagementRef.sourceId)
    const engagement = engagementSchema.parse(latest?.data)
    this.boundary.requireRecorded(ctx.target.scope, engagement.auditEventId)
    if (engagement.specialist !== ctx.actor.id || !['EXTERNAL_HUMAN', 'EXTERNAL_AI'].includes(ctx.actor.classification)
      || engagement.status !== 'ACTIVE' || engagement.expiresAt <= ctx.occurredAt
      || engagement.effectiveAt > ctx.occurredAt) this.#deny(ctx, 'ENGAGEMENT_NOT_ACTIVE')
    return this.#append(ctx, command, 'Recommendation', {
      ...input, producer: ctx.actor.id, digest: this.#hash(input.content), submittedAt: ctx.occurredAt,
      status: 'SUBMITTED', auditEventId: ctx.requestId,
    })
  }

  #accept(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    const input = z.object({ outputRef: institutionalReferenceSchema, criteria: z.string().min(1) }).strict().parse(command.payload)
    const output = outputSchema.parse(this.#get(input.outputRef, ctx).data)
    this.#human(ctx, output.producer)
    return this.#append(ctx, command, 'OutputAcceptance', {
      ...input, acceptedBy: ctx.actor.id, authorityRef: ctx.authorityRef, auditEventId: ctx.requestId,
    })
  }

  #analysis(ctx: InstitutionalMutationContext, command: InstitutionalCommand): StoredInstitutionalRecord {
    const input = z.object({
      recommendationRef: institutionalReferenceSchema, title: z.string().min(1),
      objective: z.string().min(1), recommendation: z.string().min(1), uncertainty: z.string().min(1),
    }).strict().parse(command.payload)
    this.#get(input.recommendationRef, ctx)
    this.#owner(ctx, ctx.actor.id)
    const base = decisionAnalysisInputSchema.parse({
      orgId: ctx.governanceOrgId, title: input.title, objective: input.objective,
      decisionType: 'architecture', ownerId: ctx.actor.id, status: 'drafting',
    })
    const analysis = decisionAnalysisSchema.parse({
      ...base, id: ctx.target.sourceId, alternatives: [], rejectedAlternatives: [],
      selectedAlternativeId: null, rationale: input.recommendation,
      rationaleEvidenceRefs: [input.recommendationRef.sourceId],
      riskAcceptances: [], mitigationCommitments: [], approvers: [], allApproversSignedOff: false,
      supersededBy: null, createdAt: ctx.occurredAt, updatedAt: ctx.occurredAt, decidedAt: null,
    })
    return this.#append(ctx, command, 'DecisionAnalysis', {
      analysis, evidenceRefs: [input.recommendationRef], uncertainty: input.uncertainty, auditEventId: ctx.requestId,
    })
  }

  #rationale(ctx: InstitutionalMutationContext, command: InstitutionalCommand, supersede: boolean): StoredInstitutionalRecord {
    this.#human(ctx)
    const input = z.object({
      analysisRef: institutionalReferenceSchema, outcome: z.string().min(1), rationale: z.string().min(1),
      uncertaintyStatement: z.string().min(1), predecessorRef: institutionalReferenceSchema.optional(),
    }).strict().parse(command.payload)
    const analysis = analysisStoredSchema.parse(this.#get(input.analysisRef, ctx).data)
    let predecessor: StoredInstitutionalRecord | undefined
    if (supersede) {
      if (!input.predecessorRef || input.predecessorRef.kind !== 'GovernanceRationale') this.#deny(ctx, 'PREDECESSOR_REQUIRED')
      predecessor = this.#get(input.predecessorRef, ctx)
      const old = rationaleStoredSchema.parse(predecessor.data)
      verifyInstitutionalRationale(old.record)
      if (this.boundary.store.successor(ctx.target.scope, predecessor.id)) this.#deny(ctx, 'CONFLICT')
    } else if (input.predecessorRef) this.#deny(ctx, 'USE_SUPERSESSION')
    for (const ref of analysis.evidenceRefs) this.#get(ref, ctx)
    const rationale = governanceRationaleSchema.parse({
      id: ctx.target.sourceId, orgId: ctx.governanceOrgId, decisionTitle: analysis.analysis.title,
      decisionType: analysis.analysis.decisionType, trigger: 'architecture-change',
      context: analysis.analysis.objective, deviation: '', outcome: input.outcome, rationale: input.rationale,
      supportingEvidenceRefs: analysis.evidenceRefs.map(ref => ref.sourceId),
      assumptions: [], alternativesRejected: [], acceptedRisks: [], mitigationCommitments: [],
      policyRef: ctx.authorityRef, decisionAnalysisRef: analysis.analysis.id, releaseRef: null,
      continuityImplications: [], approvedBy: [], isReplayable: true, replayHash: null,
      status: 'active', ownerId: ctx.actor.id, createdAt: ctx.occurredAt, updatedAt: ctx.occurredAt,
      supersededBy: null, supersedes: predecessor?.id ?? null,
    })
    const record = decideInstitutionalRationale({
      scope: ctx.target.scope, schemaVersion: 1, rationale, analysisRef: input.analysisRef,
      evidenceRefs: analysis.evidenceRefs, uncertaintyStatement: input.uncertaintyStatement,
      effectiveAt: ctx.occurredAt, reviewAt: null, authorityRef: ctx.authorityRef,
      decidedBy: ctx.actor.id, decidedAt: ctx.occurredAt,
    })
    const result = this.#append(ctx, command, 'GovernanceRationale', { record, auditEventId: ctx.requestId })
    if (predecessor) this.boundary.store.linkSuccessor(ctx.target.scope, predecessor.id, result.id)
    return result
  }

  #hash(value: unknown): string { return foundationHash(value) }

  #deny(ctx: InstitutionalMutationContext, code: string): never {
    return this.boundary.authority.deny(code, ctx.requestId)
  }
}
