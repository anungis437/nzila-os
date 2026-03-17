/**
 * Flow — Domain Events (Spec §5A)
 *
 * Canonical persisted domain event log for the Flow lifecycle.
 * Not a replacement for domain tables — supplementary audit trail.
 */
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { orgs } from '../orgs'

export const flowDomainEvents = pgTable('flow_domain_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  actorId: text('actor_id'),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
