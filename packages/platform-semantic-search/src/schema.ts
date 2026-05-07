/**
 * @nzila/platform-semantic-search — Drizzle Schema
 */
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
} from 'drizzle-orm/pg-core'

// ── Search Documents ────────────────────────────────────────────────────────

export const searchDocuments = pgTable(
  'search_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    resourceId: uuid('entity_id').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    tags: jsonb('tags').notNull().default([]),
    embeddingModelId: varchar('embedding_model_id', { length: 128 }),
    embeddingDimensions: integer('embedding_dimensions'),
    indexedAt: timestamp('indexed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('search_docs_tenant_idx').on(t.tenantId),
    index('search_docs_entity_idx').on(t.entityType, t.resourceId),
    index('search_docs_entity_type_idx').on(t.entityType),
  ],
)
