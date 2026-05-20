/**
 * decision_events — Durable, append-only Control Plane authority decisions.
 *
 * Every authorization decision evaluated by the Control Plane (workflow
 * trigger, entitlement resolution, governance action lifecycle, etc.) is
 * persisted here. Rows are IMMUTABLE: UPDATE and DELETE are blocked at the
 * database level by hash-chain immutability triggers (see
 * migrations/platform/hash-chain-immutability-triggers.sql).
 *
 * This is the procurement-grade evidence ledger that proves *what* the
 * platform decided, *under which policy*, *for whom*, and *with what
 * rationale* — without depending on volatile in-memory state.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { orgs } from './orgs'

export const decisionEvents = pgTable(
  'decision_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Scope
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    domain: text('domain').notNull(),
    workflowId: text('workflow_id'),
    caseId: text('case_id'),

    // Actor
    actorUserId: text('actor_user_id'),
    actorRole: text('actor_role').notNull(),

    // Subject of decision
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),

    // Decision outcome — machine + human readable
    decision: text('decision').notNull(), // 'allowed' | 'denied' | 'approval_required'
    reasonCode: text('reason_code').notNull(),
    explanation: text('explanation'),

    // Policy identity
    policyId: text('policy_id').notNull(),
    policyVersion: text('policy_version').notNull(),

    // Evaluation evidence
    evaluatedContext: jsonb('evaluated_context').notNull().default({}),
    requestHash: text('request_hash').notNull(),

    // Correlation
    correlationId: text('correlation_id'),
    traceId: text('trace_id'),

    // Event taxonomy (legacy: re-uses the DecisionEventType enum from the
    // platform contracts; kept as text to avoid a hard enum dependency).
    eventType: text('event_type').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('decision_events_org_idx').on(table.orgId, table.createdAt),
    index('decision_events_domain_idx').on(table.domain, table.createdAt),
    index('decision_events_policy_idx').on(table.policyId, table.policyVersion),
    index('decision_events_workflow_idx').on(table.workflowId),
    index('decision_events_case_idx').on(table.caseId),
    index('decision_events_actor_idx').on(table.actorUserId),
    index('decision_events_resource_idx').on(table.resourceType, table.resourceId),
    index('decision_events_correlation_idx').on(table.correlationId),
    index('decision_events_created_idx').on(table.createdAt),
  ],
)

export type DecisionEventRow = typeof decisionEvents.$inferSelect
export type NewDecisionEventRow = typeof decisionEvents.$inferInsert
