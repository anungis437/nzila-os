import { canonicalEntityBaseSchema } from './entity'
import { canonicalEventSchema } from './event'
import { canonicalAuditRecordSchema } from './audit'
import { orgScopeSchema } from './org'
import { correlationContextSchema } from './correlation'

/**
 * Runtime type guards for canonical schemas.
 * Use these for discriminating unknown data at API boundaries.
 */

export function isCanonicalEntity(value: unknown): value is import('./entity').CanonicalEntityBase {
  return canonicalEntityBaseSchema.safeParse(value).success
}

export function isCanonicalEvent(value: unknown): value is import('./event').CanonicalEvent {
  return canonicalEventSchema.safeParse(value).success
}

export function isCanonicalAuditRecord(value: unknown): value is import('./audit').CanonicalAuditRecord {
  return canonicalAuditRecordSchema.safeParse(value).success
}

export function hasOrgScope(value: unknown): value is { orgId: string } {
  return orgScopeSchema.pick({ id: true }).safeParse(value).success
    || (typeof value === 'object' && value !== null && 'orgId' in value && typeof (value as Record<string, unknown>).orgId === 'string')
}

export function hasCorrelation(value: unknown): value is import('./correlation').CorrelationContext {
  return correlationContextSchema.safeParse(value).success
}
