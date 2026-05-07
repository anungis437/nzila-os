/**
 * @nzila/platform-governed-ai — Drizzle Schema
 */
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  real,
  integer,
  index,
} from 'drizzle-orm/pg-core'

// ── AI Run Records ──────────────────────────────────────────────────────────

export const aiRunRecords = pgTable(
  'ai_run_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    operationType: varchar('operation_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    modelVersion: varchar('model_version', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    resourceId: uuid('entity_id').notNull(),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    confidence: real('confidence'),
    evidence: jsonb('evidence').notNull().default([]),
    policyConstraints: jsonb('policy_constraints').notNull().default([]),
    reasoning: text('reasoning'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    latencyMs: real('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    requestedBy: text('requested_by').notNull(),
    decisionNodeId: uuid('decision_node_id'),
  },
  (t) => [
    index('ai_runs_tenant_idx').on(t.tenantId),
    index('ai_runs_entity_idx').on(t.entityType, t.resourceId),
    index('ai_runs_model_idx').on(t.modelId),
    index('ai_runs_status_idx').on(t.status),
    index('ai_runs_operation_idx').on(t.operationType),
  ],
)
