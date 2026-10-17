import { z } from 'zod'
import {
  institutionalReferenceSchema, type InstitutionalActor, type InstitutionalReference,
  type InstitutionalMutationContext, sameInstitutionalScope,
} from '@nzila/platform-contracts'
import type { InstitutionalMutationBoundary } from '../foundation/audit'
import type { StoredInstitutionalRecord } from '../foundation/local-store'
import { foundationHash } from '../foundation/authority'

export const qualityStates = ['OBSERVED', 'STALE', 'UNAVAILABLE', 'ERROR', 'INCOMPLETE', 'ILLUSTRATIVE', 'UNKNOWN'] as const
export type Quality = typeof qualityStates[number]
export const sourceValueSchema = z.object({
  title: z.string().min(1), status: z.string().min(1),
  owner: z.string().nullable(), affectedRefs: z.array(institutionalReferenceSchema),
  evidenceRefs: z.array(institutionalReferenceSchema),
  rootCause: z.enum(['UNKNOWN', 'HYPOTHESIS', 'CONFIRMED']).default('UNKNOWN'),
}).strict()
export const sourceReadSchema = z.object({
  ref: institutionalReferenceSchema, value: sourceValueSchema.nullable(),
  status: z.enum(qualityStates), complete: z.boolean(),
  observedAt: z.string().datetime().nullable(), watermark: z.string().nullable(),
  freshness: z.object({ policyRef: z.string().min(1), maxAgeMs: z.number().nonnegative() }).nullable(),
  error: z.string().nullable(),
}).strict()
export type SourceRead = z.infer<typeof sourceReadSchema>
export interface OperatingSourcePorts {
  readonly localNamespace: string
  read(actor: InstitutionalActor, ref: InstitutionalReference): SourceRead
  measurement?(actor: InstitutionalActor, request: {
    sourceRefs: InstitutionalReference[], evidenceRefs: InstitutionalReference[],
    baselineRef: InstitutionalReference | null, methodVersion: string, unit: string,
    windowStart: string, windowEnd: string,
  }): { value: number | null, qualitativeResult: boolean | null, baselineVerified: boolean }
}

export function sourceQuality(read: SourceRead, now: string): Quality {
  if (['ERROR', 'UNAVAILABLE', 'INCOMPLETE'].includes(read.status)) return read.status
  if (!read.value) return 'UNKNOWN'
  if (read.status === 'ILLUSTRATIVE') return 'ILLUSTRATIVE'
  if (!read.complete) return 'INCOMPLETE'
  if (!read.freshness || !read.observedAt || !read.watermark || read.observedAt > now) return 'UNKNOWN'
  if (read.status === 'STALE' || Date.parse(now) - Date.parse(read.observedAt) > read.freshness.maxAgeMs) return 'STALE'
  return read.status === 'OBSERVED' ? 'OBSERVED' : 'UNKNOWN'
}

export class OperatingGuard {
  constructor(readonly boundary: InstitutionalMutationBoundary, readonly sources: OperatingSourcePorts) {}

  deny(ctx: InstitutionalMutationContext, code: string): never {
    return this.boundary.authority.deny(code, ctx.requestId)
  }
  owner(ctx: InstitutionalMutationContext, id: string): void {
    const p = this.boundary.authority.ports.principal(id)
    if (!p || p.classification !== 'INTERNAL_HUMAN' || !p.internalAffiliation
      || !this.boundary.authority.ports.assignedInternalHuman(id, ctx.target.scope)) this.deny(ctx, 'ASSIGNED_INTERNAL_OWNER_REQUIRED')
  }
  human(ctx: InstitutionalMutationContext, differentFrom?: string): void {
    this.boundary.authority.internalHuman(ctx, differentFrom)
  }
  visible(ctx: InstitutionalMutationContext, ref: InstitutionalReference): boolean {
    return this.boundary.authority.ports.canReadReference(ctx.actor, ref)
      && (sameInstitutionalScope(ctx.target.scope, ref.scope)
        || this.boundary.authority.ports.crossScopeAllowed(ctx.actor, ctx.target.scope, ref.scope, ctx.action))
  }
  reference(ctx: InstitutionalMutationContext, ref: InstitutionalReference): StoredInstitutionalRecord | SourceRead {
    institutionalReferenceSchema.parse(ref)
    if (!this.visible(ctx, ref)) this.deny(ctx, 'REFERENCE_SCOPE_OR_READ_DENIED')
    if (ref.namespace !== this.sources.localNamespace) {
      const read = sourceReadSchema.parse(this.sources.read(ctx.actor, ref))
      if (foundationHash(read.ref) !== foundationHash(ref)) this.deny(ctx, 'SOURCE_REFERENCE_MISMATCH')
      if (!['OBSERVED', 'ILLUSTRATIVE'].includes(sourceQuality(read, ctx.occurredAt))) this.deny(ctx, 'SOURCE_NOT_CURRENT_OR_COMPLETE')
      return read
    }
    const row = this.boundary.store.get(ref.scope, ref.kind, ref.sourceId, ref.revision)
    if (!row) this.deny(ctx, 'REFERENCE_NOT_FOUND')
    this.recorded(row)
    return row
  }
  recorded(row: StoredInstitutionalRecord): void {
    const { auditEventId } = z.object({ auditEventId: z.string().uuid() }).parse(row.data)
    this.boundary.requireRecorded(row.scope, auditEventId)
  }
  current(ctx: InstitutionalMutationContext, version: number): StoredInstitutionalRecord {
    const row = this.boundary.store.get(ctx.target.scope, ctx.target.kind, ctx.target.sourceId)
    if (!row || row.version !== version) this.deny(ctx, 'CONFLICT')
    if (!this.visible(ctx, { ...ctx.target, revision: row.version })) this.deny(ctx, 'REFERENCE_SCOPE_OR_READ_DENIED')
    this.recorded(row)
    return row
  }
  append(ctx: InstitutionalMutationContext, version: number, kind: string, data: object): StoredInstitutionalRecord {
    if (ctx.target.kind !== kind || ctx.target.namespace !== this.sources.localNamespace) this.deny(ctx, 'TARGET_KIND_OR_NAMESPACE_MISMATCH')
    return this.boundary.store.append(ctx.target.scope, kind, ctx.target.sourceId, version, {
      ...data, auditEventId: ctx.requestId, updatedAt: ctx.occurredAt,
      updatedBy: ctx.actor.id, authorityRef: ctx.authorityRef,
    })
  }
  localRef(row: StoredInstitutionalRecord): InstitutionalReference {
    return { scope: row.scope, kind: row.kind, namespace: this.sources.localNamespace, sourceId: row.id, revision: row.version }
  }
}
