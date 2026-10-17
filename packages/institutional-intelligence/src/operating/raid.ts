import { z } from 'zod'
import { institutionalReferenceSchema, type InstitutionalMutationContext } from '@nzila/platform-contracts'
import type { InstitutionalCommand } from '../foundation/authority'
import { sourceReadSchema, sourceQuality, type OperatingGuard } from './sources'
import { refKey } from './estate'

const status = z.enum(['identified', 'assessed', 'mitigating', 'accepted', 'resolved', 'closed',
  'unvalidated', 'validated', 'invalidated', 'retired', 'open', 'investigating', 'resolving',
  'proposed', 'confirmed', 'unmet', 'satisfied', 'waived'])
export const raidInputSchema = z.object({
  category: z.enum(['RISK', 'ASSUMPTION', 'ISSUE', 'DEPENDENCY']),
  title: z.string().min(1), description: z.string().min(1), owner: z.string().min(1),
  triggerRef: institutionalReferenceSchema, sourceScale: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']),
  normalizationRule: z.string().nullable(),
  evidenceRefs: z.array(institutionalReferenceSchema).min(1),
  missionRefs: z.array(institutionalReferenceSchema), changeRefs: z.array(institutionalReferenceSchema),
  decisionRefs: z.array(institutionalReferenceSchema), estateRefs: z.array(institutionalReferenceSchema),
  technicalDebt: z.boolean(), blockingRuleRef: z.string().min(1).nullable(),
  dependency: z.object({
    dependent: institutionalReferenceSchema, prerequisite: institutionalReferenceSchema,
    requiredCondition: z.string().min(1), evaluatorVersion: z.string().min(1), neededBy: z.string().datetime(),
  }).strict().nullable(),
}).strict()
export const raidStoredSchema = raidInputSchema.extend({
  status, origin: z.object({ actor: z.string(), at: z.string().datetime(), ref: institutionalReferenceSchema }),
  resolution: z.string().nullable(), dispositionExpiresAt: z.string().datetime().nullable(),
  closureDisposition: z.enum(['SATISFIED', 'WAIVED']).nullable().default(null),
  dispositionBy: z.string().nullable(), closureEvidenceRefs: z.array(institutionalReferenceSchema),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  auditEventId: z.string().uuid(), updatedBy: z.string(), authorityRef: z.string(),
})
const transitions: Record<string, Record<string, string[]>> = {
  RISK: { identified: ['assessed'], assessed: ['mitigating', 'accepted', 'resolved'],
    mitigating: ['accepted', 'resolved'], accepted: ['mitigating', 'resolved', 'closed'], resolved: ['closed'], closed: [] },
  ASSUMPTION: { unvalidated: ['validated', 'invalidated', 'retired'], validated: ['invalidated', 'retired'], invalidated: ['retired'], retired: [] },
  ISSUE: { open: ['investigating', 'resolving'], investigating: ['resolving'], resolving: ['resolved'], resolved: ['closed'], closed: [] },
  DEPENDENCY: { proposed: ['confirmed'], confirmed: ['unmet', 'satisfied', 'waived'],
    unmet: ['satisfied', 'waived'], satisfied: ['unmet', 'closed'], waived: ['unmet', 'closed'], closed: [] },
}

function verifyRefs(g: OperatingGuard, ctx: InstitutionalMutationContext, input: z.infer<typeof raidInputSchema>) {
  for (const ref of [input.triggerRef, ...input.evidenceRefs, ...input.missionRefs, ...input.changeRefs,
    ...input.decisionRefs, ...input.estateRefs, ...(input.dependency ? [input.dependency.dependent, input.dependency.prerequisite] : [])]) g.reference(ctx, ref)
}
export function raidCreate(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand, proposal = false) {
  if (c.expectedVersion !== 0) g.deny(ctx, 'RAID_USE_TRANSITION')
  const input = raidInputSchema.parse(c.payload)
  if (!proposal) g.human(ctx)
  g.owner(ctx, input.owner)
  verifyRefs(g, ctx, input)
  if (input.priority !== 'UNKNOWN' && !input.normalizationRule) g.deny(ctx, 'EXPLICIT_PRIORITY_RULE_REQUIRED')
  if ((input.category === 'DEPENDENCY') !== !!input.dependency) g.deny(ctx, 'DEPENDENCY_CONTRACT_REQUIRED')
  if (input.dependency) {
    const { dependent, prerequisite } = input.dependency
    if (refKey(dependent) === refKey(prerequisite)) g.deny(ctx, 'REQUIRED_WORK_CYCLE')
    const rows = g.boundary.store.list(ctx.target.scope, 'Raid').map(row => raidStoredSchema.parse(row.data))
    const key = (ref: z.infer<typeof institutionalReferenceSchema>) =>
      JSON.stringify([ref.scope, ref.namespace, ref.kind, ref.sourceId])
    const queue = [key(prerequisite)], visited = new Set<string>()
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!
      if (current === key(dependent)) g.deny(ctx, 'REQUIRED_WORK_CYCLE')
      if (visited.has(current)) continue
      visited.add(current)
      queue.push(...rows.filter(r => r.dependency && r.blockingRuleRef && !['closed', 'waived'].includes(r.status)
        && key(r.dependency.dependent) === current).map(r => key(r.dependency!.prerequisite)))
    }
  }
  const initial = { RISK: 'identified', ASSUMPTION: 'unvalidated', ISSUE: 'open', DEPENDENCY: 'proposed' } as const
  return g.append(ctx, c.expectedVersion, proposal ? 'RaidProposal' : 'Raid', {
    ...input, status: initial[input.category], origin: { actor: ctx.actor.id, at: ctx.occurredAt, ref: input.triggerRef },
    resolution: null, dispositionExpiresAt: null, closureDisposition: null, dispositionBy: null, closureEvidenceRefs: [], createdAt: ctx.occurredAt,
  })
}
export function raidTransition(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand) {
  const input = z.object({
    next: status, resolution: z.string().min(1), evidenceRefs: z.array(institutionalReferenceSchema).min(1),
    expiresAt: z.string().datetime().nullable(),
  }).strict().parse(c.payload)
  const old = raidStoredSchema.parse(g.current(ctx, c.expectedVersion).data)
  g.owner(ctx, old.owner)
  g.human(ctx, input.next === 'closed' ? old.updatedBy : input.next === 'validated' ? old.origin.actor : undefined)
  if (!transitions[old.category]?.[old.status]?.includes(input.next)) g.deny(ctx, 'RAID_TRANSITION_DENIED')
  for (const ref of input.evidenceRefs) g.reference(ctx, ref)
  if (['accepted', 'waived'].includes(input.next) && (!input.expiresAt || input.expiresAt <= ctx.occurredAt)) g.deny(ctx, 'FINITE_DISPOSITION_REQUIRED')
  if (old.dependency && ['satisfied', 'closed'].includes(input.next) && old.status !== 'waived') {
    const prerequisite = g.reference(ctx, old.dependency.prerequisite)
    const sourceStatus = 'kind' in prerequisite
      ? z.object({ status: z.string() }).parse(prerequisite.data).status : prerequisite.value?.status
    if (sourceStatus !== old.dependency.requiredCondition) g.deny(ctx, 'DEPENDENCY_CONDITION_UNMET')
  }
  if (input.next === 'closed' && old.status === 'waived'
    && (!old.dispositionExpiresAt || old.dispositionExpiresAt <= ctx.occurredAt)) g.deny(ctx, 'DEPENDENCY_WAIVER_EXPIRED')
  return g.append(ctx, c.expectedVersion, 'Raid', {
    ...old, status: input.next, resolution: input.resolution, dispositionBy: ctx.actor.id,
    dispositionExpiresAt: input.next === 'closed' && old.status === 'waived' ? old.dispositionExpiresAt : input.expiresAt,
    closureDisposition: input.next === 'closed' && old.category === 'DEPENDENCY'
      ? old.status === 'waived' ? 'WAIVED' : 'SATISFIED' : null,
    closureEvidenceRefs: input.evidenceRefs,
  })
}

export function missionBlockers(g: OperatingGuard, ctx: InstitutionalMutationContext) {
  const relevant = g.boundary.store.list(ctx.target.scope, 'Raid')
    .filter(row => raidStoredSchema.parse(row.data).missionRefs.some(ref => ref.sourceId === ctx.target.sourceId
      && ref.kind === 'Mission' && ref.scope.type === ctx.target.scope.type && ref.scope.id === ctx.target.scope.id))
  return relevant.flatMap(row => {
    const raid = raidStoredSchema.parse(row.data)
    if (!raid.blockingRuleRef) return []
    const recorded = g.boundary.deliveryState(row.scope, raid.auditEventId) === 'RECORDED'
    const validDisposition = raid.dispositionExpiresAt !== null && raid.dispositionExpiresAt > ctx.occurredAt
    const closedWaiver = raid.category === 'DEPENDENCY' && raid.status === 'closed' && raid.closureDisposition === 'WAIVED'
    let clear = recorded && (['resolved', 'closed', 'validated', 'retired'].includes(raid.status)
      || (['accepted', 'waived'].includes(raid.status) && validDisposition) || raid.status === 'satisfied')
    if (closedWaiver) clear = recorded && validDisposition
    if (raid.dependency && raid.status !== 'waived' && !closedWaiver && clear) {
      const prerequisite = raid.dependency.prerequisite
      if (!g.visible(ctx, prerequisite)) clear = false
      else if (prerequisite.namespace === g.sources.localNamespace) {
        const current = g.boundary.store.get(prerequisite.scope, prerequisite.kind, prerequisite.sourceId)
        clear = current?.version === prerequisite.revision
          && z.object({ status: z.string(), auditEventId: z.string() }).parse(current.data).status === raid.dependency.requiredCondition
          && g.boundary.deliveryState(current.scope, z.object({ auditEventId: z.string() }).parse(current.data).auditEventId) === 'RECORDED'
      } else {
        const read = sourceReadSchema.parse(g.sources.read(ctx.actor, prerequisite))
        clear = ['OBSERVED', 'ILLUSTRATIVE'].includes(sourceQuality(read, ctx.occurredAt))
          && read.value?.status === raid.dependency.requiredCondition
      }
    }
    if (clear) return []
    return [{ state: 'BLOCKED' as const, ref: g.visible(ctx, g.localRef(row)) ? g.localRef(row) : null,
      reason: g.visible(ctx, g.localRef(row)) ? 'UNRESOLVED_REQUIRED_RAID' : 'INCOMPLETE_BLOCKER_COVERAGE' }]
  })
}
