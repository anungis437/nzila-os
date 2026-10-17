import { z } from 'zod'
import { institutionalReferenceSchema, type InstitutionalMutationContext } from '@nzila/platform-contracts'
import type { InstitutionalCommand } from '../foundation/authority'
import { foundationHash } from '../foundation/authority'
import type { OperatingGuard } from './sources'

const valueStates = z.enum(['FORECAST', 'OBSERVED', 'REALIZED', 'REJECTED', 'UNPROVEN'])
export const benefitInputSchema = z.object({
  title: z.string().min(1), outcomeDefinition: z.string().min(1), owner: z.string().min(1),
  type: z.enum(['FINANCIAL', 'SERVICE', 'RISK_REDUCTION', 'CAPACITY', 'CONTINUITY', 'OTHER']),
  baselineRef: institutionalReferenceSchema.nullable(),
  metric: z.string().min(1), unit: z.string().min(1), methodVersion: z.string().min(1),
  windowStart: z.string().datetime(), windowEnd: z.string().datetime(), attributionMethod: z.string().min(1),
  forecast: z.object({ value: z.number().finite().nullable(), basisRef: institutionalReferenceSchema.nullable(), uncertainty: z.string().min(1) }).strict(),
  criteria: z.object({ version: z.string().min(1), kind: z.enum(['NUMERIC_AT_LEAST', 'QUALITATIVE_VERIFIED']),
    threshold: z.number().finite().nullable(), description: z.string().min(1) }).strict(),
  missionRefs: z.array(institutionalReferenceSchema), decisionRefs: z.array(institutionalReferenceSchema),
  changeRefs: z.array(institutionalReferenceSchema), estateRefs: z.array(institutionalReferenceSchema),
}).strict().superRefine((b, ctx) => {
  if (b.windowEnd <= b.windowStart || (b.forecast.value !== null && !b.forecast.basisRef)
    || (b.criteria.kind === 'NUMERIC_AT_LEAST' && b.criteria.threshold === null)
    || (b.criteria.kind === 'QUALITATIVE_VERIFIED' && b.criteria.threshold !== null)) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_BENEFIT_MEASUREMENT_CONTRACT' })
  }
})
export const benefitStoredSchema = z.object({
  benefit: benefitInputSchema, status: valueStates,
  observationRefs: z.array(institutionalReferenceSchema), acceptanceRefs: z.array(institutionalReferenceSchema),
  reason: z.string(), createdAt: z.string().datetime(), auditEventId: z.string().uuid(),
  updatedAt: z.string().datetime(), updatedBy: z.string(), authorityRef: z.string(),
})
export const observationSchema = z.object({
  benefitRef: institutionalReferenceSchema, sourceRefs: z.array(institutionalReferenceSchema),
  evidenceRefs: z.array(institutionalReferenceSchema), baselineRef: institutionalReferenceSchema.nullable(),
  unit: z.string(), methodVersion: z.string(), windowStart: z.string().datetime(), windowEnd: z.string().datetime(),
  value: z.number().finite().nullable(), qualitativeResult: z.boolean().nullable(), baselineVerified: z.boolean(),
  knowledge: z.enum(['OBSERVED', 'UNKNOWN']), uncertainty: z.string().min(1), confounders: z.array(z.string()),
  producedBy: z.string(), observedAt: z.string().datetime(), immutableHash: z.string(),
  auditEventId: z.string().uuid(),
})
export const acceptanceSchema = z.object({
  benefitRef: institutionalReferenceSchema, observationRef: institutionalReferenceSchema.nullable(),
  outcome: z.enum(['ACCEPTED', 'REJECTED', 'INSUFFICIENT']), criteriaVersion: z.string(),
  acceptedBy: z.string(), acceptedAt: z.string().datetime(), reason: z.string(),
  evidenceRefs: z.array(institutionalReferenceSchema), authorityRef: z.string(), auditEventId: z.string().uuid(),
})
function current(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  const row = g.current(ctx, c.expectedVersion)
  const old = benefitStoredSchema.parse(row.data)
  g.owner(ctx, old.benefit.owner)
  return { row, old }
}
export function benefitCreate(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  g.human(ctx)
  if (c.expectedVersion !== 0) g.deny(ctx, 'BENEFIT_USE_LIFECYCLE_COMMAND')
  const benefit = benefitInputSchema.parse(c.payload)
  g.owner(ctx, benefit.owner)
  for (const ref of [...benefit.missionRefs, ...benefit.decisionRefs, ...benefit.changeRefs, ...benefit.estateRefs,
    ...(benefit.baselineRef ? [benefit.baselineRef] : []), ...(benefit.forecast.basisRef ? [benefit.forecast.basisRef] : [])]) g.reference(ctx, ref)
  return g.append(ctx, 0, 'Benefit', { benefit, status: 'FORECAST', observationRefs: [], acceptanceRefs: [],
    reason: 'Forecast only; realization requires observation and independent acceptance', createdAt: ctx.occurredAt })
}
export function benefitObserve(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  const input = z.object({
    sourceRefs: z.array(institutionalReferenceSchema), evidenceRefs: z.array(institutionalReferenceSchema),
    uncertainty: z.string().min(1), confounders: z.array(z.string()),
  }).strict().parse(c.payload)
  if (!['INTERNAL_HUMAN', 'AGENT', 'SYSTEM'].includes(ctx.actor.classification)) g.deny(ctx, 'OBSERVATION_COLLECTOR_REQUIRED')
  const { row, old } = current(g, ctx, c)
  if (['REJECTED', 'REALIZED'].includes(old.status)) g.deny(ctx, 'BENEFIT_REASSESSMENT_REQUIRED')
  for (const ref of [...input.sourceRefs, ...input.evidenceRefs]) g.reference(ctx, ref)
  const b = old.benefit
  const request = { sourceRefs: input.sourceRefs, evidenceRefs: input.evidenceRefs, baselineRef: b.baselineRef,
    unit: b.unit, methodVersion: b.methodVersion, windowStart: b.windowStart, windowEnd: b.windowEnd }
  const sufficient = input.sourceRefs.length > 0 && input.evidenceRefs.length > 0
    && (b.criteria.kind !== 'NUMERIC_AT_LEAST' || b.baselineRef !== null) && b.windowEnd <= ctx.occurredAt
  if (sufficient && !g.sources.measurement) g.deny(ctx, 'MEASUREMENT_ADAPTER_UNAVAILABLE')
  const measured = sufficient ? z.object({
    value: z.number().finite().nullable(), qualitativeResult: z.boolean().nullable(), baselineVerified: z.boolean(),
  }).strict().parse(g.sources.measurement!(ctx.actor, request)) : { value: null, qualitativeResult: null, baselineVerified: false }
  const observed = sufficient && (b.criteria.kind === 'QUALITATIVE_VERIFIED'
    ? measured.qualitativeResult !== null : measured.value !== null && measured.baselineVerified)
  const payload = { ...request, ...measured, producedBy: ctx.actor.id, observedAt: ctx.occurredAt,
    benefitRef: g.localRef(row), knowledge: observed ? 'OBSERVED' : 'UNKNOWN',
    uncertainty: input.uncertainty, confounders: input.confounders, auditEventId: ctx.requestId }
  const observation = g.boundary.store.append(ctx.target.scope, 'BenefitObservation', ctx.requestId, 0,
    { ...payload, immutableHash: foundationHash(payload) })
  return g.append(ctx, c.expectedVersion, 'Benefit', { ...old, status: observed ? 'OBSERVED' : 'UNPROVEN',
    observationRefs: [...old.observationRefs, g.localRef(observation)], reason: observed ? 'Observation is not acceptance' : 'Insufficient baseline/evidence/measurement' })
}
export function benefitAccept(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  const input = z.object({ observationRef: institutionalReferenceSchema, reason: z.string().min(1) }).strict().parse(c.payload)
  const { row, old } = current(g, ctx, c)
  if (old.status !== 'OBSERVED') g.deny(ctx, 'BENEFIT_NOT_OBSERVED')
  if (input.observationRef.kind !== 'BenefitObservation' || !old.observationRefs.some(ref => foundationHash(ref) === foundationHash(input.observationRef))) {
    g.deny(ctx, 'BENEFIT_OBSERVATION_MISMATCH')
  }
  const source = g.reference(ctx, input.observationRef)
  if (!('kind' in source)) g.deny(ctx, 'LOCAL_OBSERVATION_REQUIRED')
  const observation = observationSchema.parse(source.data)
  const { immutableHash, ...payload } = observation
  if (immutableHash !== foundationHash(payload)) g.deny(ctx, 'OBSERVATION_INTEGRITY_ERROR')
  g.human(ctx, observation.producedBy)
  for (const ref of old.benefit.missionRefs) {
    const mission = g.reference(ctx, ref)
    if ('kind' in mission) {
      const producer = z.object({ executionOwner: z.string(), producer: z.string() }).parse(mission.data)
      if ([producer.executionOwner, producer.producer].includes(ctx.actor.id)) g.deny(ctx, 'INDEPENDENT_IMPLEMENTATION_ACCEPTOR_REQUIRED')
    }
  }
  for (const ref of [...observation.sourceRefs, ...observation.evidenceRefs, ...(observation.baselineRef ? [observation.baselineRef] : [])]) g.reference(ctx, ref)
  const b = old.benefit
  if (observation.knowledge !== 'OBSERVED' || !observation.evidenceRefs.length
    || observation.unit !== b.unit || observation.methodVersion !== b.methodVersion
    || observation.windowStart !== b.windowStart || observation.windowEnd !== b.windowEnd) g.deny(ctx, 'MEASUREMENT_CRITERIA_NOT_SATISFIED')
  if (!g.sources.measurement) g.deny(ctx, 'MEASUREMENT_ADAPTER_UNAVAILABLE')
  const measured = g.sources.measurement(ctx.actor, observation)
  if (measured.value !== observation.value || measured.qualitativeResult !== observation.qualitativeResult
    || measured.baselineVerified !== observation.baselineVerified) g.deny(ctx, 'MEASUREMENT_SOURCE_CHANGED')
  const meets = b.criteria.kind === 'QUALITATIVE_VERIFIED' ? observation.qualitativeResult === true
    : observation.value !== null && observation.baselineVerified && observation.value >= b.criteria.threshold!
  if (!meets) g.deny(ctx, 'MEASUREMENT_CRITERIA_NOT_SATISFIED')
  const acceptance = g.boundary.store.append(ctx.target.scope, 'BenefitAcceptance', ctx.requestId, 0, {
    benefitRef: g.localRef(row), observationRef: input.observationRef, outcome: 'ACCEPTED',
    criteriaVersion: b.criteria.version, acceptedBy: ctx.actor.id, acceptedAt: ctx.occurredAt, reason: input.reason,
    evidenceRefs: observation.evidenceRefs, authorityRef: ctx.authorityRef, auditEventId: ctx.requestId,
  })
  return g.append(ctx, c.expectedVersion, 'Benefit', { ...old, status: 'REALIZED',
    acceptanceRefs: [...old.acceptanceRefs, g.localRef(acceptance)], reason: input.reason })
}
export function benefitDisposition(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  g.human(ctx)
  const input = z.object({ next: z.enum(['REJECTED', 'UNPROVEN']), reason: z.string().min(1),
    evidenceRefs: z.array(institutionalReferenceSchema).min(1) }).strict().parse(c.payload)
  const { row, old } = current(g, ctx, c)
  if (old.status === 'REJECTED') g.deny(ctx, 'BENEFIT_REJECTED_TERMINAL')
  for (const ref of input.evidenceRefs) g.reference(ctx, ref)
  const acceptance = g.boundary.store.append(ctx.target.scope, 'BenefitAcceptance', ctx.requestId, 0, {
    benefitRef: g.localRef(row), observationRef: null, outcome: input.next === 'REJECTED' ? 'REJECTED' : 'INSUFFICIENT',
    criteriaVersion: old.benefit.criteria.version, acceptedBy: ctx.actor.id, acceptedAt: ctx.occurredAt,
    reason: input.reason, evidenceRefs: input.evidenceRefs, authorityRef: ctx.authorityRef, auditEventId: ctx.requestId,
  })
  return g.append(ctx, c.expectedVersion, 'Benefit', { ...old, status: input.next, reason: input.reason,
    acceptanceRefs: [...old.acceptanceRefs, g.localRef(acceptance)] })
}
