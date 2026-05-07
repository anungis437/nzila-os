/**
 * @nzila/platform-decision-graph — Drizzle Schema
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

// ── Decision Nodes ──────────────────────────────────────────────────────────

export const decisionNodes = pgTable(
  'decision_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    decisionType: varchar('decision_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    actorType: varchar('actor_type', { length: 32 }).notNull(),
    actorId: text('actor_id').notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    resourceId: uuid('entity_id').notNull(),
    summary: text('summary').notNull(),
    outcome: jsonb('outcome').notNull().default({}),
    confidence: real('confidence'),
    policyRefs: jsonb('policy_refs').notNull().default([]),
    evidenceRefs: jsonb('evidence_refs').notNull().default([]),
    knowledgeRefs: jsonb('knowledge_refs').notNull().default([]),
    reasoning: text('reasoning'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('decision_nodes_tenant_idx').on(t.tenantId),
    index('decision_nodes_entity_idx').on(t.entityType, t.resourceId),
    index('decision_nodes_type_idx').on(t.decisionType),
    index('decision_nodes_status_idx').on(t.status),
  ],
)

// ── Decision Edges ──────────────────────────────────────────────────────────

export const decisionEdges = pgTable(
  'decision_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromDecisionId: uuid('from_decision_id').notNull(),
    toDecisionId: uuid('to_decision_id').notNull(),
    edgeType: varchar('edge_type', { length: 32 }).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('decision_edges_from_idx').on(t.fromDecisionId),
    index('decision_edges_to_idx').on(t.toDecisionId),
  ],
)
