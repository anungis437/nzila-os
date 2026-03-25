/**
 * Dunning & Subscription Lifecycle Schema
 *
 * Manages failed-payment retry sequences, subscription pause/resume,
 * and trial-to-paid conversion workflows.
 *
 * Tables:
 *  - dunning_policies         — retry/escalation sequence definitions
 *  - dunning_steps            — ordered steps within a policy
 *  - dunning_cases            — active dunning case per subscription
 *  - subscription_events_log  — immutable lifecycle events
 *
 * @domain platform-economics
 * @layer 1.5 — Billing Lifecycle
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp,
  integer, boolean, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { orgSubscriptions } from './platform-billing';

// ============================================================================
// ENUMS
// ============================================================================

export const dunningCaseStatusEnum = pgEnum('dunning_case_status', [
  'open',
  'retrying',
  'escalated',
  'resolved',
  'cancelled',
  'terminal',  // all retries exhausted → subscription action taken
]);

export const dunningStepActionEnum = pgEnum('dunning_step_action', [
  'retry_payment',
  'send_email',
  'send_sms',
  'downgrade_plan',
  'pause_subscription',
  'cancel_subscription',
  'notify_admin',
  'custom_webhook',
]);

export const subscriptionLifecycleEventEnum = pgEnum('subscription_lifecycle_event', [
  'created',
  'activated',
  'trial_started',
  'trial_ending_soon',
  'trial_expired',
  'trial_converted',
  'upgraded',
  'downgraded',
  'paused',
  'resumed',
  'payment_failed',
  'payment_retried',
  'payment_recovered',
  'dunning_started',
  'dunning_escalated',
  'dunning_resolved',
  'cancelled',
  'expired',
  'reactivated',
  'renewed',
]);

// ============================================================================
// DUNNING POLICIES
// ============================================================================

export const dunningPolicies = pgTable('dunning_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  maxRetries: integer('max_retries').notNull().default(4),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// DUNNING STEPS  (ordered within a policy)
// ============================================================================

export const dunningSteps = pgTable('dunning_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id')
    .notNull()
    .references(() => dunningPolicies.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull(),
  delayDays: integer('delay_days').notNull(),
  action: dunningStepActionEnum('action').notNull(),
  actionConfig: jsonb('action_config').$type<Record<string, unknown>>(),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  policyOrderIdx: uniqueIndex('dunning_steps_policy_order_idx')
    .on(t.policyId, t.stepOrder),
}));

// ============================================================================
// DUNNING CASES
// ============================================================================

export const dunningCases = pgTable('dunning_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => orgSubscriptions.id, { onDelete: 'restrict' }),
  policyId: uuid('policy_id')
    .notNull()
    .references(() => dunningPolicies.id, { onDelete: 'restrict' }),
  status: dunningCaseStatusEnum('status').notNull().default('open'),
  currentStepOrder: integer('current_step_order').notNull().default(0),
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: varchar('resolved_by', { length: 255 }),
  resolveReason: text('resolve_reason'),
  externalPaymentId: varchar('external_payment_id', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('dunning_cases_org_idx').on(t.organizationId),
  subIdx: index('dunning_cases_sub_idx').on(t.subscriptionId),
  statusIdx: index('dunning_cases_status_idx').on(t.status),
  nextRetryIdx: index('dunning_cases_next_retry_idx').on(t.nextRetryAt),
}));

// ============================================================================
// SUBSCRIPTION EVENTS LOG  (immutable audit trail)
// ============================================================================

export const subscriptionEventsLog = pgTable('subscription_events_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => orgSubscriptions.id, { onDelete: 'restrict' }),
  eventType: subscriptionLifecycleEventEnum('event_type').notNull(),
  previousState: jsonb('previous_state').$type<Record<string, unknown>>(),
  newState: jsonb('new_state').$type<Record<string, unknown>>(),
  triggeredBy: varchar('triggered_by', { length: 255 }),
  reason: text('reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('sub_events_log_org_idx').on(t.organizationId),
  subIdx: index('sub_events_log_sub_idx').on(t.subscriptionId),
  eventIdx: index('sub_events_log_event_idx').on(t.eventType),
  createdIdx: index('sub_events_log_created_idx').on(t.createdAt),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DunningPolicy = typeof dunningPolicies.$inferSelect;
export type NewDunningPolicy = typeof dunningPolicies.$inferInsert;
export type DunningStep = typeof dunningSteps.$inferSelect;
export type NewDunningStep = typeof dunningSteps.$inferInsert;
export type DunningCase = typeof dunningCases.$inferSelect;
export type NewDunningCase = typeof dunningCases.$inferInsert;
export type SubscriptionEventLog = typeof subscriptionEventsLog.$inferSelect;
export type NewSubscriptionEventLog = typeof subscriptionEventsLog.$inferInsert;
