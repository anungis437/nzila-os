/**
 * Flow — Domain Events (Spec §5A)
 *
 * Canonical persisted domain event log for the Flow lifecycle.
 * Not a replacement for domain tables — supplementary audit trail.
 */
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { orgs } from '../orgs'
import { flowEventTypeEnum } from './enums'

export const flowDomainEvents = pgTable('flow_domain_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: flowEventTypeEnum('event_type').notNull(),
  actorId: text('actor_id'),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
},
  (table) => [
    index('flow_domain_events_org_id_idx').on(table.orgId),
    index('flow_domain_events_entity_idx').on(table.entityType, table.entityId),
    index('flow_domain_events_event_type_idx').on(table.eventType),
    index('flow_domain_events_created_at_idx').on(table.createdAt),
  ],
)
