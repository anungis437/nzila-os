/**
 * Flow — Domain Event Queries
 *
 * Read-side queries for persisted domain events.
 * Used by control-plane dashboards, audit views, and debug tooling.
 */
import { db, flowDomainEvents } from '@nzila/db'
import { eq, and, desc, gte, lte, type SQL } from 'drizzle-orm'

export interface EventQueryFilter {
  orgId: string
  entityType?: string
  entityId?: string
  eventType?: string
  since?: Date
  until?: Date
  limit?: number
}

export async function queryFlowEvents(filter: EventQueryFilter) {
  const conditions: SQL[] = [eq(flowDomainEvents.orgId, filter.orgId)]

  if (filter.entityType) {
    conditions.push(eq(flowDomainEvents.entityType, filter.entityType))
  }
  if (filter.entityId) {
    conditions.push(eq(flowDomainEvents.entityId, filter.entityId))
  }
  if (filter.eventType) {
    conditions.push(eq(flowDomainEvents.eventType, filter.eventType as never))
  }
  if (filter.since) {
    conditions.push(gte(flowDomainEvents.createdAt, filter.since))
  }
  if (filter.until) {
    conditions.push(lte(flowDomainEvents.createdAt, filter.until))
  }

  return db
    .select()
    .from(flowDomainEvents)
    .where(and(...conditions))
    .orderBy(desc(flowDomainEvents.createdAt))
    .limit(filter.limit ?? 100)
}

export async function getEntityTimeline(orgId: string, entityType: string, entityId: string) {
  return queryFlowEvents({ orgId, entityType, entityId, limit: 500 })
}
