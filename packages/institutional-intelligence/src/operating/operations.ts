import { z } from 'zod'
import { institutionalReferenceSchema, type InstitutionalMutationContext } from '@nzila/platform-contracts'
import { engagementSchema, outputSchema } from '../foundation/runtime'
import type { InstitutionalCommand } from '../foundation/authority'
import { sourceQuality, sourceReadSchema, type OperatingGuard, type Quality } from './sources'
import { missionBlockers } from './raid'
import { refKey } from './estate'

export const operationalLinkSchema = z.object({
  missionRef: institutionalReferenceSchema,
  incidentRefs: z.array(institutionalReferenceSchema), problemRefs: z.array(institutionalReferenceSchema),
  operationalChangeRefs: z.array(institutionalReferenceSchema), deploymentChangeRefs: z.array(institutionalReferenceSchema),
  estateRefs: z.array(institutionalReferenceSchema), decisionRefs: z.array(institutionalReferenceSchema),
}).strict()
export const operationalStoredSchema = operationalLinkSchema.extend({
  auditEventId: z.string(), updatedAt: z.string(), updatedBy: z.string(), authorityRef: z.string(),
})
export function operationalLink(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  g.human(ctx)
  const input = operationalLinkSchema.parse(c.payload)
  const typed = [[input.missionRef], input.incidentRefs, input.problemRefs, input.operationalChangeRefs, input.deploymentChangeRefs, input.decisionRefs]
  const kinds = ['Mission', 'Incident', 'Problem', 'OperationalChange', 'DeploymentChange', 'GovernanceRationale']
  typed.forEach((refs, i) => {
    for (const ref of refs) {
      if (ref.kind !== kinds[i]) g.deny(ctx, 'OPERATIONAL_SOURCE_KIND_MISMATCH')
      g.reference(ctx, ref)
    }
  })
  for (const ref of input.estateRefs) g.reference(ctx, ref)
  if (c.expectedVersion) g.current(ctx, c.expectedVersion)
  return g.append(ctx, c.expectedVersion, 'OperationalLink', input)
}

const obligation = z.object({
  id: z.string().min(1), criteria: z.string().min(1),
  status: z.enum(['OPEN', 'SUBMITTED', 'ACCEPTED', 'UNPROVEN']),
  evidenceRef: institutionalReferenceSchema.nullable(), producer: z.string().min(1),
}).strict()
export const termsInputSchema = z.object({
  engagementRef: institutionalReferenceSchema, authorizedOutputs: z.array(z.literal('Recommendation')).min(1),
  obligations: z.array(obligation),
}).strict()
export const termsStoredSchema = termsInputSchema.extend({
  acceptedBy: z.string().nullable(), auditEventId: z.string(), updatedAt: z.string(), updatedBy: z.string(), authorityRef: z.string(),
})
export function engagementTerms(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  g.human(ctx)
  const input = termsInputSchema.parse(c.payload)
  if (input.engagementRef.kind !== 'SpecialistEngagement') g.deny(ctx, 'ENGAGEMENT_KIND_REQUIRED')
  const row = g.reference(ctx, input.engagementRef)
  if (!('kind' in row)) g.deny(ctx, 'LOCAL_ENGAGEMENT_REQUIRED')
  const engagement = engagementSchema.parse(row.data)
  g.owner(ctx, engagement.sponsor)
  const duplicate = g.boundary.store.list(ctx.target.scope, 'EngagementTerms').some(r =>
    r.id !== ctx.target.sourceId && termsStoredSchema.parse(r.data).engagementRef.sourceId === input.engagementRef.sourceId)
  if (duplicate) g.deny(ctx, 'ENGAGEMENT_TERMS_ALREADY_REGISTERED')
  if (new Set(input.obligations.map(o => o.id)).size !== input.obligations.length) g.deny(ctx, 'DUPLICATE_OBLIGATION')
  if (c.expectedVersion) {
    const old = termsStoredSchema.parse(g.current(ctx, c.expectedVersion).data)
    if (refKey(old.engagementRef) !== refKey(input.engagementRef)) g.deny(ctx, 'ENGAGEMENT_TERMS_IDENTITY_IMMUTABLE')
    if (old.obligations.some(o => !input.obligations.some(n => n.id === o.id
      && n.criteria === o.criteria && n.producer === o.producer && (o.status !== 'ACCEPTED' || n.status === 'ACCEPTED')))) {
      g.deny(ctx, 'OBLIGATION_HISTORY_MUST_BE_PRESERVED')
    }
  }
  for (const o of input.obligations) {
    if (o.producer !== engagement.specialist) g.deny(ctx, 'OBLIGATION_PRODUCER_MISMATCH')
    if (o.evidenceRef) g.reference(ctx, o.evidenceRef)
    if (o.status === 'ACCEPTED') {
      g.human(ctx, o.producer)
      if (!o.evidenceRef || o.evidenceRef.kind !== 'OutputAcceptance') g.deny(ctx, 'INDEPENDENT_OUTPUT_ACCEPTANCE_REQUIRED')
      const acceptance = g.reference(ctx, o.evidenceRef)
      if (!('kind' in acceptance)) g.deny(ctx, 'LOCAL_ACCEPTANCE_REQUIRED')
      const accepted = z.object({ acceptedBy: z.string(), criteria: z.string(), outputRef: institutionalReferenceSchema }).parse(acceptance.data)
      const output = g.reference(ctx, accepted.outputRef)
      if (!('kind' in output)) g.deny(ctx, 'LOCAL_ENGAGEMENT_OUTPUT_REQUIRED')
      const submitted = outputSchema.parse(output.data)
      if (submitted.engagementRef.sourceId !== input.engagementRef.sourceId || submitted.producer !== o.producer) g.deny(ctx, 'OBLIGATION_OUTPUT_MISMATCH')
      if (accepted.acceptedBy === o.producer || accepted.criteria !== o.criteria) g.deny(ctx, 'OBLIGATION_CRITERIA_NOT_ACCEPTED')
    }
  }
  return g.append(ctx, c.expectedVersion, 'EngagementTerms', {
    ...input, acceptedBy: input.obligations.some(o => o.status === 'ACCEPTED') ? ctx.actor.id : null,
  })
}

export function specialistVisibility(g: OperatingGuard, ctx: InstitutionalMutationContext, id: string) {
  const row = g.boundary.store.get(ctx.target.scope, 'SpecialistEngagement', id)
  if (!row || !g.visible(ctx, g.localRef(row))) g.deny(ctx, 'REFERENCE_SCOPE_OR_READ_DENIED')
  g.recorded(row)
  const engagement = engagementSchema.parse(row.data)
  g.owner(ctx, engagement.sponsor)
  const status = engagement.expiresAt <= ctx.occurredAt && !['CLOSED', 'REVOKED'].includes(engagement.status)
    ? 'EXPIRED' : engagement.status
  const termsRow = g.boundary.store.list(row.scope, 'EngagementTerms').find(t => termsStoredSchema.parse(t.data).engagementRef.sourceId === id)
  const terms = termsRow && g.visible(ctx, g.localRef(termsRow)) ? termsStoredSchema.parse(termsRow.data) : null
  if (termsRow && terms) g.recorded(termsRow)
  const outputs = g.boundary.store.list(row.scope, 'Recommendation').filter(output => {
    const data = outputSchema.parse(output.data)
    return data.engagementRef.sourceId === id && g.visible(ctx, g.localRef(output))
  })
  const acceptances = g.boundary.store.list(row.scope, 'OutputAcceptance').filter(acceptance =>
    g.visible(ctx, g.localRef(acceptance))
    && outputs.some(o => z.object({ outputRef: institutionalReferenceSchema }).parse(acceptance.data).outputRef.sourceId === o.id))
  let complete = terms !== null
  const obligations = terms?.obligations.map(o => {
    if (o.evidenceRef && !g.visible(ctx, o.evidenceRef)) { complete = false; return { ...o, evidenceRef: null, status: 'UNPROVEN' as const } }
    return o
  }) ?? null
  for (const output of [...outputs, ...acceptances]) g.recorded(output)
  return {
    ref: g.localRef(row), status, sponsor: engagement.sponsor, specialist: engagement.specialist,
    effectiveAt: engagement.effectiveAt, expiresAt: engagement.expiresAt,
    authorizedOutputs: terms?.authorizedOutputs ?? null, obligations,
    submittedEvidence: outputs.map(output => g.localRef(output)),
    acceptanceRefs: acceptances.map(a => g.localRef(a)), complete,
    authorityMeaning: 'PROJECTION' as const,
  }
}

export function specialistGuard(g: OperatingGuard, ctx: InstitutionalMutationContext, engagementRef: z.infer<typeof institutionalReferenceSchema>) {
  const terms = g.boundary.store.list(ctx.target.scope, 'EngagementTerms')
    .filter(row => termsStoredSchema.parse(row.data).engagementRef.sourceId === engagementRef.sourceId)
  if (terms.length !== 1) g.deny(ctx, 'ENGAGEMENT_OUTPUT_TERMS_REQUIRED')
  const row = terms[0]!
  g.reference(ctx, g.localRef(row))
  if (!termsStoredSchema.parse(row.data).authorizedOutputs.includes('Recommendation')) g.deny(ctx, 'ENGAGEMENT_OUTPUT_NOT_AUTHORIZED')
}

const capacitySchema = z.object({
  knowledge: z.enum(['KNOWN', 'UNKNOWN']), confidence: z.enum(['OBSERVED', 'DECLARED', 'ESTIMATED', 'UNKNOWN']),
  unit: z.string().min(1), windowStart: z.string().datetime(), windowEnd: z.string().datetime(),
  availableChangeCapacity: z.number().nonnegative().nullable(), committedCapacity: z.number().nonnegative().nullable(),
  runReserve: z.number().nonnegative().nullable(), sourceRefs: z.array(institutionalReferenceSchema),
  ruleVersion: z.string().min(1),
}).strict().superRefine((c, ctx) => {
  if (c.windowEnd <= c.windowStart) ctx.addIssue({ code: 'custom', message: 'INVALID_CAPACITY_WINDOW' })
  if (c.knowledge === 'UNKNOWN' && [c.availableChangeCapacity, c.committedCapacity, c.runReserve].some(v => v !== null)) {
    ctx.addIssue({ code: 'custom', message: 'UNKNOWN_CAPACITY_MUST_BE_NULL' })
  }
  if (c.knowledge === 'KNOWN' && ([c.availableChangeCapacity, c.committedCapacity, c.runReserve].some(v => v === null)
    || !c.sourceRefs.length || c.confidence === 'UNKNOWN')) ctx.addIssue({ code: 'custom', message: 'KNOWN_CAPACITY_REQUIRES_SOURCE' })
})
export const laneInputSchema = z.object({
  purpose: z.string().min(1), owner: z.string().min(1), executionOwner: z.string().min(1),
  status: z.enum(['ACTIVE', 'ARCHIVED']), missionRefs: z.array(institutionalReferenceSchema).min(1),
  engagementRefs: z.array(institutionalReferenceSchema), capacity: capacitySchema,
}).strict()
export const laneStoredSchema = laneInputSchema.extend({
  commitments: z.array(z.object({ workRef: institutionalReferenceSchema, quantity: z.number().positive(), unit: z.string() })),
  auditEventId: z.string(), updatedAt: z.string(), updatedBy: z.string(), authorityRef: z.string(),
})
export function laneCreate(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  g.human(ctx); g.owner(ctx, laneInputSchema.parse(c.payload).owner)
  if (c.expectedVersion !== 0) g.deny(ctx, 'LANE_USE_RESERVATION_COMMAND')
  const input = laneInputSchema.parse(c.payload)
  const executor = g.boundary.authority.ports.principal(input.executionOwner)
  if (!executor || !['INTERNAL_HUMAN', 'AGENT', 'SYSTEM'].includes(executor.classification)) g.deny(ctx, 'GOVERNED_EXECUTION_OWNER_REQUIRED')
  for (const ref of [...input.missionRefs, ...input.engagementRefs, ...input.capacity.sourceRefs]) g.reference(ctx, ref)
  return g.append(ctx, 0, 'Lane', { ...input, commitments: [] })
}
export function laneReserve(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  g.human(ctx)
  const input = z.object({ workRef: institutionalReferenceSchema, quantity: z.number().positive(), unit: z.string() }).strict().parse(c.payload)
  const old = laneStoredSchema.parse(g.current(ctx, c.expectedVersion).data)
  g.owner(ctx, old.owner); g.reference(ctx, input.workRef)
  if (old.status !== 'ACTIVE' || old.capacity.windowEnd <= ctx.occurredAt || old.capacity.windowStart > ctx.occurredAt) g.deny(ctx, 'CAPACITY_WINDOW_NOT_ACTIVE')
  const available = old.capacity.availableChangeCapacity, committed = old.capacity.committedCapacity
  if (old.capacity.knowledge !== 'KNOWN' || available === null || committed === null) g.deny(ctx, 'CAPACITY_UNKNOWN')
  if (old.capacity.unit !== input.unit) g.deny(ctx, 'CAPACITY_UNIT_MISMATCH')
  if (available - committed < input.quantity) g.deny(ctx, 'CAPACITY_OVERCOMMITTED')
  for (const ref of old.capacity.sourceRefs) g.reference(ctx, ref)
  return g.append(ctx, c.expectedVersion, 'Lane', { ...old,
    capacity: { ...old.capacity, committedCapacity: committed + input.quantity }, commitments: [...old.commitments, input] })
}

export function operatingComposition(g: OperatingGuard, ctx: InstitutionalMutationContext, ref: z.infer<typeof institutionalReferenceSchema>) {
  const linked = g.reference(ctx, ref)
  if (!('kind' in linked) || linked.kind !== 'OperationalLink') g.deny(ctx, 'OPERATIONAL_LINK_REQUIRED')
  const input = operationalStoredSchema.parse(linked.data)
  const reads = [...input.incidentRefs, ...input.problemRefs, ...input.operationalChangeRefs, ...input.deploymentChangeRefs].map(sourceRef => {
    if (!g.visible(ctx, sourceRef)) return { status: 'INCOMPLETE' as Quality, ref: null, value: null }
    const read = sourceReadSchema.parse(g.sources.read(ctx.actor, sourceRef))
    if (refKey(read.ref) !== refKey(sourceRef)) g.deny(ctx, 'SOURCE_REFERENCE_MISMATCH')
    const status = sourceQuality(read, ctx.occurredAt)
    return { status, ref: sourceRef, value: ['UNAVAILABLE', 'ERROR', 'UNKNOWN'].includes(status) ? null : read.value,
      observedAt: read.observedAt, watermark: read.watermark, authorityMeaning: 'SOURCE' as const }
  })
  const mission = g.boundary.store.get(input.missionRef.scope, 'Mission', input.missionRef.sourceId)
  if (!mission || !g.visible(ctx, g.localRef(mission))) g.deny(ctx, 'MISSION_READ_DENIED')
  g.recorded(mission)
  const blockers = missionBlockers(g, { ...ctx, target: g.localRef(mission) })
  return { ref, missionRef: g.localRef(mission), missionState: z.object({ status: z.string() }).parse(mission.data).status,
    blockers, reads, complete: reads.every(r => ['OBSERVED', 'ILLUSTRATIVE'].includes(r.status)),
    health: reads.some(r => !['OBSERVED', 'ILLUSTRATIVE'].includes(r.status)) ? 'UNKNOWN' : 'NOT_EVALUATED',
    causalMeaning: 'CORRELATED_NOT_CONFIRMED' as const }
}
