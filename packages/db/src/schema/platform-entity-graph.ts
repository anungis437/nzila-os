/**
 * Nzila OS — Platform Entity Graph persistence schema
 *
 * Backing tables for `@nzila/platform-entity-graph` Drizzle store. Mirrors
 * the in-memory store shape — every node is `(tenantId, entityType,
 * entityId)`-addressable, every edge is `(source, relationshipType,
 * target)`. The graph is intentionally schema-light: types are validated at
 * the package boundary against `@nzila/platform-ontology`, the DB only
 * enforces uniqueness and indexes.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const platformEntityNodes = pgTable(
  'platform_entity_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Multi-tenant scope key — typically the org ID */
    tenantId: text('tenant_id').notNull(),
    /** OntologyEntityType value from @nzila/platform-ontology */
    entityType: text('entity_type').notNull(),
    /** Source-of-truth ID in the originating system */
    entityId: text('entity_id').notNull(),
    /** Human-readable display name */
    canonicalName: text('canonical_name').notNull(),
    /** Lifecycle status string (e.g. active, archived, open, closed) */
    status: text('status').notNull(),
    /** Arbitrary structured metadata */
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('platform_entity_nodes_addr_uq').on(t.tenantId, t.entityType, t.entityId),
    index('platform_entity_nodes_tenant_type_idx').on(t.tenantId, t.entityType),
  ],
)

export const platformEntityEdges = pgTable(
  'platform_entity_edges',
  {
    /** Caller-supplied stable edge ID (e.g. `${rel}:${src}-${tgt}`) */
    id: text('id').primaryKey(),
    /** Multi-tenant scope key — typically the org ID */
    tenantId: text('tenant_id').notNull(),
    sourceEntityType: text('source_entity_type').notNull(),
    sourceEntityId: text('source_entity_id').notNull(),
    targetEntityType: text('target_entity_type').notNull(),
    targetEntityId: text('target_entity_id').notNull(),
    /** RelationshipType value from @nzila/platform-ontology */
    relationshipType: text('relationship_type').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('platform_entity_edges_tenant_idx').on(t.tenantId),
    index('platform_entity_edges_source_idx').on(t.tenantId, t.sourceEntityType, t.sourceEntityId),
    index('platform_entity_edges_target_idx').on(t.tenantId, t.targetEntityType, t.targetEntityId),
  ],
)
