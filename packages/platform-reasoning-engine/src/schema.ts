/**
 * @nzila/platform-reasoning-engine — Drizzle Schema
 */
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  real,
  index,
} from 'drizzle-orm/pg-core'

// ── Reasoning Chains ────────────────────────────────────────────────────────

export const reasoningChains = pgTable(
  'reasoning_chains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),  // DB column stays tenant_id for migration compat
    reasoningType: varchar('reasoning_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    resourceId: uuid('entity_id').notNull(),
    question: text('question').notNull(),
    steps: jsonb('steps').notNull().default([]),
    conclusion: jsonb('conclusion'),
    allCitations: jsonb('all_citations').notNull().default([]),
    totalConfidence: real('total_confidence').notNull().default(0),
    crossVerticalInsights: jsonb('cross_vertical_insights')
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    requestedBy: text('requested_by').notNull(),
  },
  (t) => [
    index('reasoning_chains_tenant_idx').on(t.tenantId),
    index('reasoning_chains_entity_idx').on(t.entityType, t.resourceId),
    index('reasoning_chains_type_idx').on(t.reasoningType),
    index('reasoning_chains_status_idx').on(t.status),
  ],
)
