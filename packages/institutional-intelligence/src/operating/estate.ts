import { z } from 'zod'
import { institutionalReferenceSchema, type InstitutionalMutationContext } from '@nzila/platform-contracts'
import { institutionalRelationshipAllowed, institutionalRelations } from '@nzila/platform-ontology/institutional'
import { traverseDirected, type DirectedNode, type DirectedEdge } from '@nzila/platform-entity-graph/directed'
import { foundationHash, type InstitutionalCommand } from '../foundation/authority'
import type { StoredInstitutionalRecord } from '../foundation/local-store'
import { sourceQuality, sourceReadSchema, type OperatingGuard, type Quality } from './sources'

export const estateKinds = ['InstitutionalProduct', 'Capability', 'Service', 'SharedPlatformPrimitive',
  'Integration', 'InfrastructureDependency', 'ExternalDependency'] as const
const lifecycle = z.enum(['PROPOSED', 'DESIGNED', 'PILOT', 'ACTIVE', 'LIMITED', 'DEGRADED', 'AT_RISK', 'DEPRECATED', 'RETIRED', 'MISSING'])
export const estateInputSchema = z.object({
  sourceRef: institutionalReferenceSchema, classification: z.enum(estateKinds),
  lifecycle, steward: z.string().min(1).nullable(),
  evidenceRefs: z.array(institutionalReferenceSchema),
}).strict()
export const estateStoredSchema = estateInputSchema.extend({
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  auditEventId: z.string().uuid(), authorityRef: z.string(), updatedBy: z.string(),
})
export const relationshipSchema = z.object({
  from: institutionalReferenceSchema, to: institutionalReferenceSchema,
  relation: z.enum(institutionalRelations), purpose: z.string().min(1),
  binding: z.boolean(), status: z.enum(['CURRENT', 'WITHDRAWN']),
}).strict()
export const edgeStoredSchema = relationshipSchema.extend({
  key: z.string(), auditEventId: z.string().uuid(), updatedAt: z.string().datetime(),
  updatedBy: z.string(), authorityRef: z.string(),
})
export const refKey = (ref: z.infer<typeof institutionalReferenceSchema>): string =>
  JSON.stringify([ref.scope.type, ref.scope.id, ref.namespace, ref.kind, ref.sourceId, ref.revision])
const identityKey = (ref: z.infer<typeof institutionalReferenceSchema>): string =>
  JSON.stringify([ref.scope.type, ref.scope.id, ref.namespace, ref.kind, ref.sourceId])

export function estateMutation(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand): StoredInstitutionalRecord {
  g.human(ctx)
  const input = estateInputSchema.parse(c.payload)
  if (input.steward) g.owner(ctx, input.steward)
  if (input.sourceRef.kind !== input.classification) g.deny(ctx, 'ESTATE_SOURCE_KIND_MISMATCH')
  g.reference(ctx, input.sourceRef)
  for (const ref of input.evidenceRefs) g.reference(ctx, ref)
  let createdAt = ctx.occurredAt
  if (c.expectedVersion) {
    const old = estateStoredSchema.parse(g.current(ctx, c.expectedVersion).data)
    createdAt = old.createdAt
    if (old.lifecycle === 'RETIRED') g.deny(ctx, 'ESTATE_RETIRED_TERMINAL')
    if (refKey(old.sourceRef) !== refKey(input.sourceRef)) g.deny(ctx, 'ESTATE_REFERENCE_IMMUTABLE')
    const transitions: Record<z.infer<typeof lifecycle>, string[]> = {
      PROPOSED: ['DESIGNED', 'ACTIVE', 'MISSING'], DESIGNED: ['PILOT', 'MISSING'],
      PILOT: ['ACTIVE', 'LIMITED', 'DEGRADED', 'DESIGNED', 'DEPRECATED', 'MISSING'],
      ACTIVE: ['LIMITED', 'DEGRADED', 'AT_RISK', 'DEPRECATED', 'MISSING'],
      LIMITED: ['ACTIVE', 'DEGRADED', 'DEPRECATED', 'MISSING'],
      DEGRADED: ['ACTIVE', 'LIMITED', 'DEPRECATED', 'MISSING'], AT_RISK: ['ACTIVE', 'DEPRECATED', 'MISSING'],
      DEPRECATED: ['RETIRED', 'MISSING'], RETIRED: [], MISSING: ['ACTIVE', 'DEPRECATED', 'RETIRED'],
    }
    if (old.lifecycle !== input.lifecycle && !transitions[old.lifecycle].includes(input.lifecycle)) g.deny(ctx, 'ESTATE_TRANSITION_DENIED')
    if (old.lifecycle !== input.lifecycle && input.evidenceRefs.length === 0) g.deny(ctx, 'LIFECYCLE_EVIDENCE_REQUIRED')
  }
  return g.append(ctx, c.expectedVersion, 'EstateReference', { ...input, createdAt })
}

export function relationshipMutation(g: OperatingGuard, ctx: InstitutionalMutationContext, c: InstitutionalCommand): StoredInstitutionalRecord {
  g.human(ctx)
  const input = relationshipSchema.parse(c.payload)
  for (const ref of [input.from, input.to]) g.reference(ctx, ref)
  if (!institutionalRelationshipAllowed(input.from.kind, input.relation, input.to.kind)) g.deny(ctx, 'RELATION_TYPE_PAIR_DENIED')
  const key = foundationHash({ from: input.from, to: input.to, relation: input.relation, purpose: input.purpose })
  const existing = g.boundary.store.list(ctx.target.scope, 'InstitutionalRelationship')
  if (existing.some(row => row.id !== ctx.target.sourceId && edgeStoredSchema.parse(row.data).key === key)) g.deny(ctx, 'RELATION_DUPLICATE')
  if (c.expectedVersion) {
    const old = edgeStoredSchema.parse(g.current(ctx, c.expectedVersion).data)
    if (old.key !== key || old.status === 'WITHDRAWN') g.deny(ctx, 'RELATION_IDENTITY_IMMUTABLE')
  }
  const from = identityKey(input.from), to = identityKey(input.to)
  if (from === to) g.deny(ctx, 'RELATION_SELF_REFERENCE')
  if (['HAS', 'BELONGS_TO'].includes(input.relation)
    || (input.binding && input.relation === 'DEPENDS_ON' && ['Mission', 'Raid'].includes(input.from.kind))) {
    const containment = ['HAS', 'BELONGS_TO'].includes(input.relation)
    const start = input.relation === 'BELONGS_TO' ? from : to
    const goal = input.relation === 'BELONGS_TO' ? to : from
    const next = (key: string) => existing.map(row => edgeStoredSchema.parse(row.data))
      .filter(e => e.status === 'CURRENT' && (containment ? ['HAS', 'BELONGS_TO'].includes(e.relation) : e.relation === input.relation && e.binding))
      .map(e => ({ from: identityKey(e.relation === 'BELONGS_TO' ? e.to : e.from), to: identityKey(e.relation === 'BELONGS_TO' ? e.from : e.to) }))
      .filter(e => e.from === key).map(e => e.to)
    const queue = [start], visited = new Set<string>()
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i]!
      if (k === goal) g.deny(ctx, 'REQUIRED_RELATION_CYCLE')
      if (!visited.has(k)) { visited.add(k); queue.push(...next(k)) }
    }
  }
  return g.append(ctx, c.expectedVersion, 'InstitutionalRelationship', { ...input, key })
}

export interface EstateNode extends DirectedNode { sourceRef: z.infer<typeof institutionalReferenceSchema>, sourceStatus: Quality }
export interface EstateEdge extends DirectedEdge { sourceRef: z.infer<typeof institutionalReferenceSchema> }
export async function estateTraversal(g: OperatingGuard, ctx: InstitutionalMutationContext, raw: unknown) {
  const input = z.object({
    seed: institutionalReferenceSchema, direction: z.enum(['incoming', 'outgoing']),
    mode: z.enum(['CURRENT_OPERATING', 'ALL_REGISTERED', 'HISTORICAL_AT']),
    at: z.string().datetime().optional(),
    depthLimit: z.number().int().positive().max(100),
    nodeBudget: z.number().int().positive().max(1000), edgeBudget: z.number().int().positive().max(10000),
  }).strict().parse(raw)
  if (!g.visible(ctx, input.seed)) g.deny(ctx, 'REFERENCE_SCOPE_OR_READ_DENIED')
  if (input.mode === 'HISTORICAL_AT' && (!input.at || input.at > ctx.occurredAt)) g.deny(ctx, 'HISTORICAL_TIME_REQUIRED')
  const select = (kind: string) => {
    const rows = input.mode === 'HISTORICAL_AT'
      ? g.boundary.store.revisions(ctx.target.scope, kind).filter(r => z.object({ updatedAt: z.string() }).parse(r.data).updatedAt <= input.at!)
      : g.boundary.store.list(ctx.target.scope, kind)
    const latest = new Map<string, StoredInstitutionalRecord>()
    for (const row of rows) latest.set(row.id, row)
    return [...latest.values()]
  }
  const rows = select('EstateReference')
  const edges = select('InstitutionalRelationship')
  const visibleNode = (key: string): EstateNode | undefined => {
    const row = rows.find(r => refKey(estateStoredSchema.parse(r.data).sourceRef) === key)
    if (!row || !g.visible(ctx, g.localRef(row))) return undefined
    const data = estateStoredSchema.parse(row.data)
    if (!g.visible(ctx, data.sourceRef)) return undefined
    if (g.boundary.deliveryState(row.scope, data.auditEventId) !== 'RECORDED') return undefined
    if (input.mode === 'CURRENT_OPERATING' && !['ACTIVE', 'PILOT', 'LIMITED', 'DEGRADED', 'AT_RISK', 'DEPRECATED'].includes(data.lifecycle)) return undefined
    const source = sourceReadSchema.parse(g.sources.read(ctx.actor, data.sourceRef))
    if (foundationHash(source.ref) !== foundationHash(data.sourceRef)) g.deny(ctx, 'SOURCE_REFERENCE_MISMATCH')
    const sourceStatus = sourceQuality(source, ctx.occurredAt)
    if (input.mode === 'CURRENT_OPERATING' && (!['OBSERVED', 'ILLUSTRATIVE'].includes(sourceStatus)
      || ['retired', 'deleted', 'archived'].includes(source.value?.status ?? ''))) return undefined
    return { key, lifecycle: data.lifecycle, sourceRef: data.sourceRef, sourceStatus }
  }
  const result = await traverseDirected<EstateNode, EstateEdge>({
    node: async key => visibleNode(key),
    neighbors: async (key, direction) => {
      let complete = ['OBSERVED', 'ILLUSTRATIVE'].includes(visibleNode(key)?.sourceStatus ?? 'UNKNOWN')
      const found: EstateEdge[] = []
      for (const row of edges) {
        const data = edgeStoredSchema.parse(row.data)
        if (data.status !== 'CURRENT' || !data.binding || !['DEPENDS_ON', 'CONSUMES'].includes(data.relation)
          || refKey(direction === 'incoming' ? data.to : data.from) !== key) continue
        if (!g.visible(ctx, g.localRef(row)) || !g.visible(ctx, data.from) || !g.visible(ctx, data.to)
          || !visibleNode(refKey(data.from)) || !visibleNode(refKey(data.to))
          || g.boundary.deliveryState(row.scope, data.auditEventId) !== 'RECORDED') { complete = false; continue }
        found.push({ key: data.key, from: refKey(data.from), to: refKey(data.to), relation: data.relation, sourceRef: g.localRef(row) })
      }
      return { edges: found, complete }
    },
  }, refKey(input.seed), input)
  return { ...result, causalMeaning: 'DEPENDENCY_IMPACT_NOT_CONFIRMED_CAUSATION' as const }
}
